'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { addFixtureSchema, editFixtureSchema, moveFixtureSchema } from '@/lib/validators/admin'
import { syncFixtures } from '@/lib/fixtures/sync'
import type { SyncResult } from '@/lib/fixtures/sync'

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

// ─── Add Fixture ──────────────────────────────────────────────────────────────

/**
 * Manually adds a fixture to a gameweek.
 * Uses a negative external_id to avoid collision with football-data.org IDs (which are positive).
 */
export async function addFixture(
  formData: FormData
): Promise<{ success?: boolean; fixtureId?: string; error?: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const raw = {
    home_team_id: formData.get('home_team_id'),
    away_team_id: formData.get('away_team_id'),
    kickoff_time: formData.get('kickoff_time'),
    gameweek_number: formData.get('gameweek_number'),
  }

  const result = addFixtureSchema.safeParse(raw)
  if (!result.success) {
    const firstError = result.error.issues[0]?.message ?? 'Invalid input'
    return { error: firstError }
  }

  const { home_team_id, away_team_id, kickoff_time, gameweek_number } = result.data

  const supabaseAdmin = createAdminClient()

  // Look up gameweek UUID by gameweek_number
  const { data: gameweek, error: gwError } = await supabaseAdmin
    .from('gameweeks')
    .select('id')
    .eq('number', gameweek_number)
    .single()

  if (gwError || !gameweek) {
    return { error: `Gameweek ${gameweek_number} not found. Run a sync first to populate gameweeks.` }
  }

  // Generate negative external_id for manually added fixtures
  const external_id = -Date.now()

  const { data: fixture, error: insertError } = await supabaseAdmin
    .from('fixtures')
    .insert({
      external_id,
      gameweek_id: gameweek.id,
      home_team_id,
      away_team_id,
      kickoff_time: new Date(kickoff_time).toISOString(),
      status: 'SCHEDULED',
      is_rescheduled: false,
      home_score: null,
      away_score: null,
    })
    .select('id')
    .single()

  if (insertError || !fixture) {
    console.error('[addFixture] Insert error:', insertError?.message)
    return { error: 'Failed to add fixture. Please try again.' }
  }

  revalidatePath('/admin/gameweeks')
  return { success: true, fixtureId: fixture.id }
}

// ─── Edit Fixture ─────────────────────────────────────────────────────────────

/**
 * Edits a fixture's details.
 *
 * KICKOFF GUARD (FIX-03):
 * - After kickoff: scores and status can always be updated.
 * - After kickoff: kickoff_time changes are BLOCKED unless admin_override=true.
 * - Teams are not editable via this action (use add/delete).
 *
 * If kickoff_time changes, is_rescheduled is set to true.
 */
export async function editFixture(
  formData: FormData
): Promise<{ success?: boolean; error?: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const raw = {
    fixture_id: formData.get('fixture_id'),
    kickoff_time: formData.get('kickoff_time') || undefined,
    status: formData.get('status') || undefined,
    home_score: formData.get('home_score') !== null && formData.get('home_score') !== ''
      ? formData.get('home_score')
      : undefined,
    away_score: formData.get('away_score') !== null && formData.get('away_score') !== ''
      ? formData.get('away_score')
      : undefined,
  }

  const result = editFixtureSchema.safeParse(raw)
  if (!result.success) {
    const firstError = result.error.issues[0]?.message ?? 'Invalid input'
    return { error: firstError }
  }

  const { fixture_id, kickoff_time, status, home_score, away_score } = result.data

  const supabaseAdmin = createAdminClient()

  // Fetch current fixture to check kickoff guard
  const { data: fixture, error: fetchError } = await supabaseAdmin
    .from('fixtures')
    .select('id, kickoff_time, home_team_id, away_team_id, status')
    .eq('id', fixture_id)
    .single()

  if (fetchError || !fixture) {
    return { error: 'Fixture not found' }
  }

  // ── Kickoff Guard ────────────────────────────────────────────────────────────
  const hasKickedOff = new Date() >= new Date(fixture.kickoff_time)

  if (hasKickedOff && kickoff_time !== undefined) {
    const isAdminOverride = formData.get('admin_override') === 'true'

    if (!isAdminOverride) {
      return {
        error:
          'Cannot edit fixture details after kick-off. Use admin override if this is intentional.',
      }
    }
  }
  // ─────────────────────────────────────────────────────────────────────────────

  // Build update payload — only include defined fields
  const updatePayload: Record<string, unknown> = {}

  if (kickoff_time !== undefined) {
    const kickoffIso = new Date(kickoff_time).toISOString()
    // Mark as rescheduled if kickoff time changed
    if (kickoffIso !== new Date(fixture.kickoff_time).toISOString()) {
      updatePayload.kickoff_time = kickoffIso
      updatePayload.is_rescheduled = true
    }
  }

  if (status !== undefined) {
    updatePayload.status = status
  }

  if (home_score !== undefined) {
    updatePayload.home_score = home_score
  }

  if (away_score !== undefined) {
    updatePayload.away_score = away_score
  }

  if (Object.keys(updatePayload).length === 0) {
    return { success: true } // Nothing to update
  }

  const { error: updateError } = await supabaseAdmin
    .from('fixtures')
    .update(updatePayload)
    .eq('id', fixture_id)

  if (updateError) {
    console.error('[editFixture] Update error:', updateError.message)
    return { error: 'Failed to update fixture. Please try again.' }
  }

  revalidatePath('/admin/gameweeks')
  return { success: true }
}

// ─── Move Fixture ─────────────────────────────────────────────────────────────

/**
 * Moves a fixture to a different gameweek.
 * Creates an admin notification so George is aware of the change.
 */
export async function moveFixture(
  formData: FormData
): Promise<{ success?: boolean; error?: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const raw = {
    fixture_id: formData.get('fixture_id'),
    target_gameweek_number: formData.get('target_gameweek_number'),
  }

  const result = moveFixtureSchema.safeParse(raw)
  if (!result.success) {
    const firstError = result.error.issues[0]?.message ?? 'Invalid input'
    return { error: firstError }
  }

  const { fixture_id, target_gameweek_number } = result.data

  const supabaseAdmin = createAdminClient()

  // Look up target gameweek UUID
  const { data: targetGameweek, error: gwError } = await supabaseAdmin
    .from('gameweeks')
    .select('id, number')
    .eq('number', target_gameweek_number)
    .single()

  if (gwError || !targetGameweek) {
    return { error: `Gameweek ${target_gameweek_number} not found.` }
  }

  // Fetch current fixture with its current gameweek number (for notification)
  const { data: fixture, error: fetchError } = await supabaseAdmin
    .from('fixtures')
    .select('id, gameweek_id, home_team_id, away_team_id, gameweeks(number)')
    .eq('id', fixture_id)
    .single()

  if (fetchError || !fixture) {
    return { error: 'Fixture not found' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentGwNumber = (fixture as any).gameweeks?.number ?? '?'

  // Update fixture's gameweek_id
  const { error: updateError } = await supabaseAdmin
    .from('fixtures')
    .update({ gameweek_id: targetGameweek.id })
    .eq('id', fixture_id)

  if (updateError) {
    console.error('[moveFixture] Update error:', updateError.message)
    return { error: 'Failed to move fixture. Please try again.' }
  }

  // Create admin notification about the move
  await supabaseAdmin
    .from('admin_notifications')
    .insert({
      type: 'fixture_moved',
      title: `Fixture moved manually: GW${currentGwNumber} → GW${target_gameweek_number}`,
      message: `Fixture ${fixture_id} moved from GW${currentGwNumber} to GW${target_gameweek_number} by admin.`,
    })
    .then(({ error }) => {
      if (error) console.error('[moveFixture] Notification error:', error.message)
    })

  revalidatePath('/admin/gameweeks')
  return { success: true }
}

// ─── Trigger Sync ─────────────────────────────────────────────────────────────

/**
 * Manually triggers a fixture sync from football-data.org.
 * Requires admin auth — returns the full sync result.
 */
export async function triggerSync(): Promise<
  SyncResult | { error: string }
> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const syncResult = await syncFixtures()

  revalidatePath('/admin/gameweeks')
  revalidatePath('/admin')

  return syncResult
}
