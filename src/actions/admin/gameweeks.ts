'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { closeGameweekSchema, reopenGameweekSchema } from '@/lib/validators/gameweeks'
import { detectH2HForGameweek, resolveStealsForGameweek } from '@/lib/h2h/sync-hook'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CloseGameweekSummary {
  totalFixtures: number
  finishedFixtures: number
  blockingFixtures: Array<{ id: string; label: string; status: string }>
  pendingBonusAwards: number
  bonusConfirmed: boolean
  totalPointsDistributed: number
  canClose: boolean
}

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

// ─── getCloseGameweekSummary ──────────────────────────────────────────────────

/**
 * Fetches a pre-close summary for a gameweek.
 * Not a form action — called directly by the close dialog on open.
 */
export async function getCloseGameweekSummary(
  gameweekId: string
): Promise<CloseGameweekSummary | { error: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const supabase = createAdminClient()

  // Non-terminal statuses — these block close
  const TERMINAL_STATUSES = ['FINISHED', 'CANCELLED', 'POSTPONED']

  // Fetch all fixtures for this gameweek with team names
  const { data: fixtures, error: fixturesError } = await supabase
    .from('fixtures')
    .select('id, status, home_team:teams!home_team_id(name), away_team:teams!away_team_id(name)')
    .eq('gameweek_id', gameweekId)

  if (fixturesError) {
    console.error('[getCloseGameweekSummary] Fixtures error:', fixturesError.message)
    return { error: 'Failed to fetch fixtures' }
  }

  const allFixtures = (fixtures ?? []) as unknown as Array<{
    id: string
    status: string
    home_team: { name: string }
    away_team: { name: string }
  }>

  const blockingFixtures = allFixtures
    .filter((f) => !TERMINAL_STATUSES.includes(f.status))
    .map((f) => ({
      id: f.id,
      label: `${f.home_team.name} vs ${f.away_team.name}`,
      status: f.status,
    }))

  const finishedFixtures = allFixtures.filter((f) =>
    TERMINAL_STATUSES.includes(f.status)
  ).length

  // Count pending bonus awards (awarded IS NULL)
  const { data: pendingAwards, error: awardsError } = await supabase
    .from('bonus_awards')
    .select('id')
    .eq('gameweek_id', gameweekId)
    .is('awarded', null)

  if (awardsError) {
    console.error('[getCloseGameweekSummary] Awards error:', awardsError.message)
  }

  const pendingBonusAwards = (pendingAwards ?? []).length

  // Check if bonus schedule is confirmed for this GW
  const { data: bonusSchedule } = await supabase
    .from('bonus_schedule')
    .select('confirmed')
    .eq('gameweek_id', gameweekId)
    .single()

  const bonusConfirmed = bonusSchedule?.confirmed ?? false

  // Sum total points distributed
  const { data: scores } = await supabase
    .from('prediction_scores')
    .select('points_awarded')
    .eq('gameweek_id', gameweekId)

  const totalPointsDistributed = (scores ?? []).reduce(
    (sum: number, row: { points_awarded: number }) => sum + (row.points_awarded ?? 0),
    0
  )

  const canClose = blockingFixtures.length === 0 && pendingBonusAwards === 0

  return {
    totalFixtures: allFixtures.length,
    finishedFixtures,
    blockingFixtures,
    pendingBonusAwards,
    bonusConfirmed,
    totalPointsDistributed,
    canClose,
  }
}

// ─── closeGameweek ────────────────────────────────────────────────────────────

/**
 * Closes a gameweek — finalises scoring and locks everything down.
 * Re-checks blocking conditions server-side (never trusts client state).
 */
export async function closeGameweek(
  formData: FormData
): Promise<{ success: true } | { error: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const raw = { gameweek_id: formData.get('gameweek_id') }
  const result = closeGameweekSchema.safeParse(raw)
  if (!result.success) {
    const firstError = result.error.issues[0]?.message ?? 'Invalid input'
    return { error: firstError }
  }

  const { gameweek_id } = result.data
  const supabase = createAdminClient()

  // Re-check blocking conditions (never trust client)
  const TERMINAL_STATUSES = ['FINISHED', 'CANCELLED', 'POSTPONED']

  const { data: fixtures } = await supabase
    .from('fixtures')
    .select('id, status, home_team:teams!home_team_id(name), away_team:teams!away_team_id(name)')
    .eq('gameweek_id', gameweek_id)

  const allFixtures = (fixtures ?? []) as unknown as Array<{
    id: string
    status: string
    home_team: { name: string }
    away_team: { name: string }
  }>

  const blockingFixtures = allFixtures.filter(
    (f) => !TERMINAL_STATUSES.includes(f.status)
  )

  if (blockingFixtures.length > 0) {
    const names = blockingFixtures.map((f) => `${f.home_team.name} vs ${f.away_team.name}`).join(', ')
    return { error: `Cannot close: ${blockingFixtures.length} fixture(s) not finished (${names})` }
  }

  const { data: pendingAwards } = await supabase
    .from('bonus_awards')
    .select('id')
    .eq('gameweek_id', gameweek_id)
    .is('awarded', null)

  if ((pendingAwards ?? []).length > 0) {
    return {
      error: `Cannot close: ${(pendingAwards ?? []).length} bonus award(s) still pending review`,
    }
  }

  // Fetch gameweek number for notification title
  const { data: gameweek } = await supabase
    .from('gameweeks')
    .select('id, number')
    .eq('id', gameweek_id)
    .single()

  const gwNumber = gameweek?.number ?? '?'

  // Update gameweek: set closed_at + closed_by
  const { error: updateError } = await supabase
    .from('gameweeks')
    .update({
      closed_at: new Date().toISOString(),
      closed_by: auth.userId,
    })
    .eq('id', gameweek_id)

  if (updateError) {
    console.error('[closeGameweek] Update error:', updateError.message)
    return { error: 'Failed to close gameweek. Please try again.' }
  }

  // Create gw_complete admin notification
  await supabase
    .from('admin_notifications')
    .insert({
      type: 'gw_complete',
      title: `Gameweek ${gwNumber} closed`,
      message: `Closed by admin`,
    })

  // ── Non-blocking H2H integration (Phase 8 Plan 03) ──────────────────────────
  // Run tie detection for this gameweek + resolution for any steals landing in it.
  // Errors here MUST NOT fail the close operation — logged via admin_notifications.
  try {
    await detectH2HForGameweek(supabase, gameweek_id)
  } catch (error) {
    console.error('[closeGameweek] H2H detection failed:', error)
    await supabase.from('admin_notifications').insert({
      type: 'system',
      title: 'H2H detection failed',
      message: `detectH2HForGameweek threw on GW${gwNumber}: ${String(error)}`,
    })
  }
  try {
    await resolveStealsForGameweek(supabase, gameweek_id)
  } catch (error) {
    console.error('[closeGameweek] H2H steal resolution failed:', error)
    await supabase.from('admin_notifications').insert({
      type: 'system',
      title: 'H2H steal resolution failed',
      message: `resolveStealsForGameweek threw on GW${gwNumber}: ${String(error)}`,
    })
  }

  revalidatePath('/admin', 'layout')

  return { success: true }
}

// ─── reopenGameweek ───────────────────────────────────────────────────────────

/**
 * Reopens a previously closed gameweek.
 * Clears closed_at and closed_by.
 */
export async function reopenGameweek(
  formData: FormData
): Promise<{ success: true } | { error: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const raw = { gameweek_id: formData.get('gameweek_id') }
  const result = reopenGameweekSchema.safeParse(raw)
  if (!result.success) {
    const firstError = result.error.issues[0]?.message ?? 'Invalid input'
    return { error: firstError }
  }

  const { gameweek_id } = result.data
  const supabase = createAdminClient()

  // Fetch gameweek number for notification
  const { data: gameweek } = await supabase
    .from('gameweeks')
    .select('id, number')
    .eq('id', gameweek_id)
    .single()

  const gwNumber = gameweek?.number ?? '?'

  // Clear closed_at and closed_by
  const { error: updateError } = await supabase
    .from('gameweeks')
    .update({
      closed_at: null,
      closed_by: null,
    })
    .eq('id', gameweek_id)

  if (updateError) {
    console.error('[reopenGameweek] Update error:', updateError.message)
    return { error: 'Failed to reopen gameweek. Please try again.' }
  }

  // Create system notification
  await supabase
    .from('admin_notifications')
    .insert({
      type: 'system',
      title: `Gameweek ${gwNumber} reopened`,
      message: `Reopened by admin`,
    })

  revalidatePath('/admin', 'layout')

  return { success: true }
}

// ─── updateAdminSettings ──────────────────────────────────────────────────────

/**
 * Upserts email notification toggle preferences for the current admin.
 */
export async function updateAdminSettings(
  formData: FormData
): Promise<{ success: true } | { error: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const email_bonus_reminders = formData.get('email_bonus_reminders') === 'true'
  const email_gw_complete = formData.get('email_gw_complete') === 'true'
  const email_prize_triggered = formData.get('email_prize_triggered') === 'true'

  const supabase = createAdminClient()

  const { error: upsertError } = await supabase.from('admin_settings').upsert(
    {
      admin_user_id: auth.userId,
      email_bonus_reminders,
      email_gw_complete,
      email_prize_triggered,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'admin_user_id' }
  )

  if (upsertError) {
    console.error('[updateAdminSettings] Upsert error:', upsertError.message)
    return { error: 'Failed to update settings. Please try again.' }
  }

  revalidatePath('/admin/settings')

  return { success: true }
}
