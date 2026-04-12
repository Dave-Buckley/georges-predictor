'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { importMembersSchema } from '@/lib/validators/import'
import { revalidatePath } from 'next/cache'

// ─── Admin Auth Guard ─────────────────────────────────────────────────────────

async function requireAdmin(): Promise<{ userId: string } | { error: string }> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user || user.app_metadata?.role !== 'admin') {
    return { error: 'Unauthorized — admin access required' }
  }

  return { userId: user.id }
}

// ─── importMembers ────────────────────────────────────────────────────────────

/**
 * Bulk-imports member placeholder rows.
 * Inserts with user_id=null so the handle_new_user trigger can claim them on signup.
 * Uses the admin client to bypass RLS (session client would block user_id=null inserts).
 */
export async function importMembers(
  rows: Array<{ display_name: string; starting_points: number }>
): Promise<{ success?: boolean; imported?: number; error?: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  // Validate input schema
  const validation = importMembersSchema.safeParse(rows)
  if (!validation.success) {
    const firstError = validation.error.issues[0]?.message ?? 'Invalid input'
    return { error: firstError }
  }

  const validatedRows = validation.data
  const supabaseAdmin = createAdminClient()

  // Case-insensitive conflict check — fetch members whose display_name matches any input name
  const inputNames = validatedRows.map((r) => r.display_name.trim().toLowerCase())
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('members')
    .select('display_name')
    .in(
      'display_name',
      // Pass trimmed names; the DB check is done on lowercased comparison
      validatedRows.map((r) => r.display_name.trim())
    )

  if (fetchError) {
    console.error('[importMembers] Conflict check error:', fetchError.message)
    return { error: 'Failed to check for existing members.' }
  }

  // Compare case-insensitively
  const existingNames = (existing ?? []).map((r: { display_name: string }) =>
    r.display_name.toLowerCase()
  )
  const conflicts = inputNames.filter((n) => existingNames.includes(n))

  if (conflicts.length > 0) {
    const conflictList = conflicts.join(', ')
    return { error: `Names already exist: ${conflictList}` }
  }

  // Bulk insert placeholder rows
  const insertPayload = validatedRows.map((row) => ({
    display_name: row.display_name.trim(),
    starting_points: row.starting_points,
    email: '',
    user_id: null,
    approval_status: 'pending' as const,
    email_opt_in: true,
  }))

  const { error: insertError } = await supabaseAdmin.from('members').insert(insertPayload)

  if (insertError) {
    console.error('[importMembers] Insert error:', insertError.message)
    return { error: 'Failed to import members. Please try again.' }
  }

  // Create admin notification
  await supabaseAdmin
    .from('admin_notifications')
    .insert({
      type: 'system',
      title: 'Import complete',
      message: `${validatedRows.length} member${validatedRows.length !== 1 ? 's' : ''} imported`,
      is_read: false,
    })
    .then(({ error }) => {
      if (error) console.error('[importMembers] Notification error:', error.message)
    })

  revalidatePath('/admin/members')
  revalidatePath('/admin/import')

  return { success: true, imported: validatedRows.length }
}

// ─── clearImportedMembers ─────────────────────────────────────────────────────

/**
 * Deletes all placeholder members (user_id IS NULL).
 * This is safe: registered members have a user_id and will NOT be deleted.
 * Orphaned pre_season_picks are removed by ON DELETE CASCADE on the FK.
 */
export async function clearImportedMembers(): Promise<{
  success?: boolean
  deleted?: number
  error?: string
}> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const supabaseAdmin = createAdminClient()

  // Count how many unregistered placeholders exist
  const { count, error: countError } = await supabaseAdmin
    .from('members')
    .select('id', { count: 'exact', head: true })
    .is('user_id', null)

  if (countError) {
    console.error('[clearImportedMembers] Count error:', countError.message)
    return { error: 'Failed to count imported members.' }
  }

  // Delete only placeholder rows (user_id IS NULL)
  const { error: deleteError } = await supabaseAdmin
    .from('members')
    .delete()
    .is('user_id', null)

  if (deleteError) {
    console.error('[clearImportedMembers] Delete error:', deleteError.message)
    return { error: 'Failed to clear imported members. Please try again.' }
  }

  revalidatePath('/admin/import')
  revalidatePath('/admin/members')

  return { success: true, deleted: count ?? 0 }
}

// ─── importPreSeasonPicks ─────────────────────────────────────────────────────

/**
 * Upserts pre-season picks for each member.
 * Matches member_name to the members table (case-insensitive) and upserts
 * picks with onConflict='member_id,season' for idempotency.
 */
export async function importPreSeasonPicks(
  rows: Array<{
    member_name: string
    season: number
    top4: string[]
    tenth_place: string
    relegated: string[]
    promoted: string[]
    promoted_playoff_winner: string
  }>
): Promise<{ success?: boolean; imported?: number; error?: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  if (!rows || rows.length === 0) {
    return { error: 'No rows to import' }
  }

  const supabaseAdmin = createAdminClient()

  // Look up member IDs by display_name (fetch all names provided)
  const memberNames = rows.map((r) => r.member_name.trim())
  const { data: members, error: fetchError } = await supabaseAdmin
    .from('members')
    .select('id, display_name')
    .in('display_name', memberNames)

  if (fetchError) {
    console.error('[importPreSeasonPicks] Member lookup error:', fetchError.message)
    return { error: 'Failed to look up members.' }
  }

  // Build case-insensitive name → id map
  const memberMap = new Map<string, string>()
  for (const m of members ?? []) {
    memberMap.set((m as { id: string; display_name: string }).display_name.toLowerCase().trim(), (m as { id: string; display_name: string }).id)
  }

  // Find unmatched names
  const unmatched = memberNames.filter((name) => !memberMap.has(name.toLowerCase()))
  if (unmatched.length > 0) {
    return { error: `Member names not found: ${unmatched.join(', ')}` }
  }

  // Build upsert payload
  const upsertPayload = rows.map((row) => ({
    member_id: memberMap.get(row.member_name.trim().toLowerCase())!,
    season: row.season,
    top4: row.top4,
    tenth_place: row.tenth_place,
    relegated: row.relegated,
    promoted: row.promoted,
    promoted_playoff_winner: row.promoted_playoff_winner,
    imported_by: auth.userId,
    imported_at: new Date().toISOString(),
  }))

  const { error: upsertError } = await supabaseAdmin
    .from('pre_season_picks')
    .upsert(upsertPayload, { onConflict: 'member_id,season' })

  if (upsertError) {
    console.error('[importPreSeasonPicks] Upsert error:', upsertError.message)
    return { error: 'Failed to import pre-season picks. Please try again.' }
  }

  revalidatePath('/admin/import')

  return { success: true, imported: rows.length }
}
