'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  setBonusSchema,
  toggleDoubleBubbleSchema,
  confirmBonusAwardSchema,
  bulkConfirmBonusSchema,
  createBonusTypeSchema,
} from '@/lib/validators/bonuses'

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

// ─── Set Bonus for Gameweek ───────────────────────────────────────────────────

/**
 * Sets or changes the active bonus type for a gameweek.
 *
 * 1. Validates admin auth
 * 2. Validates input with setBonusSchema
 * 3. Checks for existing member picks (bonus_awards count)
 * 4. Upserts bonus_schedule row with confirmed=true
 * 5. Creates admin notification if this is a change with existing picks
 * 6. Revalidates /admin/bonuses and /admin/gameweeks
 */
export async function setBonusForGameweek(
  formData: FormData
): Promise<{ success: true; existingPickCount: number } | { error: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const { userId } = auth

  const raw = {
    gameweek_id: formData.get('gameweek_id'),
    bonus_type_id: formData.get('bonus_type_id'),
  }

  const parsed = setBonusSchema.safeParse(raw)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Invalid input'
    return { error: firstError }
  }

  const { gameweek_id, bonus_type_id } = parsed.data
  const adminClient = createAdminClient()

  // Check for existing member picks on this gameweek's bonus
  const { count: existingPickCount } = await adminClient
    .from('bonus_awards')
    .select('id', { count: 'exact', head: true })
    .eq('gameweek_id', gameweek_id)

  const pickCount = existingPickCount ?? 0

  // Resolve old + new bonus type names to detect Double Bubble transitions.
  // If George switches this gw INTO Double Bubble we flip gw.double_bubble=true;
  // if he switches OUT OF Double Bubble we flip it back to false. Any other
  // transition leaves the flag alone so George's manual toggles are preserved.
  const { data: newBonus } = await adminClient
    .from('bonus_types')
    .select('name')
    .eq('id', bonus_type_id)
    .single()

  const { data: currentSchedule } = await adminClient
    .from('bonus_schedule')
    .select('bonus_type:bonus_types!bonus_type_id(name)')
    .eq('gameweek_id', gameweek_id)
    .maybeSingle()

  const newIsDoubleBubble = (newBonus as { name?: string } | null)?.name === 'Double Bubble'
  const wasDoubleBubble =
    (currentSchedule as { bonus_type?: { name?: string } | null } | null)?.bonus_type?.name ===
    'Double Bubble'

  // Upsert bonus_schedule — on conflict (gameweek_id), update the bonus type
  const { error: upsertError } = await adminClient.from('bonus_schedule').upsert(
    {
      gameweek_id,
      bonus_type_id,
      confirmed: true,
      confirmed_at: new Date().toISOString(),
      confirmed_by: userId,
    },
    { onConflict: 'gameweek_id' }
  )

  if (upsertError) {
    console.error('[setBonusForGameweek] Upsert error:', upsertError.message)
    return { error: 'Failed to set bonus. Please try again.' }
  }

  if (newIsDoubleBubble !== wasDoubleBubble) {
    const { error: flagError } = await adminClient
      .from('gameweeks')
      .update({ double_bubble: newIsDoubleBubble })
      .eq('id', gameweek_id)
    if (flagError) {
      console.error('[setBonusForGameweek] Double Bubble flag sync error:', flagError.message)
    }
  }

  // Create notification if changing a bonus that already has picks
  if (pickCount > 0) {
    await adminClient
      .from('admin_notifications')
      .insert({
        type: 'bonus_reminder',
        title: `Bonus changed with ${pickCount} existing pick${pickCount !== 1 ? 's' : ''}`,
        message: `George changed the bonus for this gameweek. ${pickCount} member pick${pickCount !== 1 ? 's' : ''} may be affected.`,
      })
      .then(({ error }) => {
        if (error) console.error('[setBonusForGameweek] Notification error:', error.message)
      })
  } else {
    // Always log the bonus set action
    await adminClient
      .from('admin_notifications')
      .insert({
        type: 'bonus_reminder',
        title: 'Bonus set for gameweek',
        message: `Admin set bonus type for gameweek.`,
      })
      .then(({ error }) => {
        if (error) console.error('[setBonusForGameweek] Notification error:', error.message)
      })
  }

  revalidatePath('/admin/bonuses')
  revalidatePath('/admin/gameweeks')

  return { success: true, existingPickCount: pickCount }
}

// ─── Toggle Double Bubble ─────────────────────────────────────────────────────

/**
 * Toggles Double Bubble on or off for a gameweek.
 *
 * Double Bubble doubles bonus points if a member gets their bonus right.
 * Pre-set on GW10, GW20, GW30, but George can change any gameweek.
 */
export async function toggleDoubleBubble(
  formData: FormData
): Promise<{ success: true } | { error: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const raw = {
    gameweek_id: formData.get('gameweek_id'),
    // FormData returns string — parse explicitly before Zod
    enabled: formData.get('enabled') === 'true',
  }

  const parsed = toggleDoubleBubbleSchema.safeParse(raw)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Invalid input'
    return { error: firstError }
  }

  const { gameweek_id, enabled } = parsed.data
  const adminClient = createAdminClient()

  const { error: updateError } = await adminClient
    .from('gameweeks')
    .update({ double_bubble: enabled })
    .eq('id', gameweek_id)

  if (updateError) {
    console.error('[toggleDoubleBubble] Update error:', updateError.message)
    return { error: 'Failed to toggle Double Bubble. Please try again.' }
  }

  // Audit notification
  await adminClient
    .from('admin_notifications')
    .insert({
      type: 'bonus_reminder',
      title: `Double Bubble ${enabled ? 'enabled' : 'disabled'}`,
      message: `Admin ${enabled ? 'enabled' : 'disabled'} Double Bubble for gameweek.`,
    })
    .then(({ error }) => {
      if (error) console.error('[toggleDoubleBubble] Notification error:', error.message)
    })

  revalidatePath('/admin/bonuses')
  revalidatePath('/admin/gameweeks')

  return { success: true }
}

// ─── Confirm Bonus Award ──────────────────────────────────────────────────────

/**
 * Confirms or rejects a single bonus award for a member.
 *
 * Updates awarded (true/false from NULL), confirmed_by, and confirmed_at.
 */
export async function confirmBonusAward(
  formData: FormData
): Promise<{ success: true } | { error: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const { userId } = auth

  const raw = {
    award_id: formData.get('award_id'),
    // Parse boolean from string
    awarded: formData.get('awarded') === 'true',
  }

  const parsed = confirmBonusAwardSchema.safeParse(raw)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Invalid input'
    return { error: firstError }
  }

  const { award_id, awarded } = parsed.data
  const adminClient = createAdminClient()

  const { error: updateError } = await adminClient
    .from('bonus_awards')
    .update({
      awarded,
      confirmed_by: userId,
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', award_id)

  if (updateError) {
    console.error('[confirmBonusAward] Update error:', updateError.message)
    return { error: 'Failed to confirm bonus award. Please try again.' }
  }

  revalidatePath('/admin/bonuses')

  return { success: true }
}

// ─── Bulk Confirm Bonus Awards ────────────────────────────────────────────────

/**
 * Bulk-approves or bulk-rejects all pending (awarded IS NULL) bonus awards
 * for a specific gameweek.
 */
export async function bulkConfirmBonusAwards(
  formData: FormData
): Promise<{ success: true } | { error: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const { userId } = auth

  const raw = {
    gameweek_id: formData.get('gameweek_id'),
    action: formData.get('action'),
  }

  const parsed = bulkConfirmBonusSchema.safeParse(raw)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Invalid input'
    return { error: firstError }
  }

  const { gameweek_id, action } = parsed.data
  const adminClient = createAdminClient()

  const awarded = action === 'approve_all'

  const { error: updateError } = await adminClient
    .from('bonus_awards')
    .update({
      awarded,
      confirmed_by: userId,
      confirmed_at: new Date().toISOString(),
    })
    .eq('gameweek_id', gameweek_id)
    .is('awarded', null)

  if (updateError) {
    console.error('[bulkConfirmBonusAwards] Update error:', updateError.message)
    return { error: 'Failed to bulk confirm bonus awards. Please try again.' }
  }

  revalidatePath('/admin/bonuses')

  return { success: true }
}

// ─── Create Bonus Type ────────────────────────────────────────────────────────

/**
 * Creates a new custom bonus type.
 *
 * Custom bonus types allow George to define unique challenges beyond the
 * 14 predefined types.
 */
export async function createBonusType(
  formData: FormData
): Promise<{ success: true; id: string } | { error: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const raw = {
    name: formData.get('name'),
    description: formData.get('description'),
  }

  const parsed = createBonusTypeSchema.safeParse(raw)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Invalid input'
    return { error: firstError }
  }

  const { name, description } = parsed.data
  const adminClient = createAdminClient()

  const { data, error: insertError } = await adminClient
    .from('bonus_types')
    .insert({
      name,
      description,
      is_custom: true,
    })
    .select('id')
    .single()

  if (insertError || !data) {
    console.error('[createBonusType] Insert error:', insertError?.message)
    return { error: 'Failed to create bonus type. Please try again.' }
  }

  revalidatePath('/admin/bonuses')

  return { success: true, id: data.id }
}
