'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { closeGameweekSchema, reopenGameweekSchema } from '@/lib/validators/gameweeks'
import { detectH2HForGameweek, resolveStealsForGameweek } from '@/lib/h2h/sync-hook'
import {
  applyWeeklyToStartingPoints,
  reverseWeeklyFromStartingPoints,
} from '@/lib/gameweeks/apply-points'

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

  // Roll weekly points into members.starting_points so /standings stays
  // current without manual admin updates. Idempotent — applyWeeklyToStartingPoints
  // is a no-op if points_applied is already true (e.g. historical closes
  // back-filled by migration 014).
  try {
    await applyWeeklyToStartingPoints(supabase, gameweek_id)
  } catch (error) {
    console.error('[closeGameweek] applyWeeklyToStartingPoints failed:', error)
    await supabase.from('admin_notifications').insert({
      type: 'system',
      title: `Gameweek ${gwNumber} points didn't save — Dave needs to check`,
      message: `The weekly points for Gameweek ${gwNumber} could not be added to the season totals. Standings may be out of date until Dave takes a look.`,
    })
  }

  // Create gw_complete admin notification
  await supabase
    .from('admin_notifications')
    .insert({
      type: 'gw_complete',
      title: `Gameweek ${gwNumber} closed`,
      message: `Gameweek ${gwNumber} has been closed. Weekly points have been added to the season totals.`,
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
      title: `Head-to-head check didn't finish for Gameweek ${gwNumber}`,
      message: `The app couldn't work out head-to-head ties for Gameweek ${gwNumber}. Dave needs to take a look before prizes are confirmed.`,
    })
  }
  try {
    await resolveStealsForGameweek(supabase, gameweek_id)
  } catch (error) {
    console.error('[closeGameweek] H2H steal resolution failed:', error)
    await supabase.from('admin_notifications').insert({
      type: 'system',
      title: `Head-to-head tie-break didn't finish for Gameweek ${gwNumber}`,
      message: `A head-to-head tie from a previous gameweek needed to be settled in Gameweek ${gwNumber} and the app ran into a problem. Dave needs to take a look.`,
    })
  }

  // ── Fire-and-forget: trigger weekly reports endpoint ────────────────────────
  // New serverless invocation so the report batch has its own 60s Vercel Hobby
  // budget. Failures are logged inside the endpoint — closeGameweek never awaits.
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
    const cronSecret = process.env.CRON_SECRET ?? ''
    if (appUrl && cronSecret) {
      void fetch(`${appUrl}/api/reports/send-weekly`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cronSecret}`,
        },
        body: JSON.stringify({ gameweek_id }),
      }).catch((err) => {
        console.error('[closeGameweek] reports trigger failed:', err)
      })
    } else {
      console.warn(
        '[closeGameweek] Skipping reports trigger — NEXT_PUBLIC_APP_URL or CRON_SECRET not set',
      )
    }
  } catch (triggerErr) {
    // Never throw — closeGameweek success MUST stand regardless of trigger outcome
    console.error('[closeGameweek] reports trigger threw synchronously:', triggerErr)
  }

  revalidatePath('/admin', 'layout')
  // Refresh the public standings page + home so the latest closed GW results,
  // new rankings, and updated top-3 weekly appear immediately.
  revalidatePath('/standings')
  revalidatePath('/')

  return { success: true }
}

// ─── resumeReportSend ─────────────────────────────────────────────────────────

/**
 * Admin recovery action — manually re-fire /api/reports/send-weekly for a
 * gameweek. Used when a batch partial-fails and George needs to retry.
 * Idempotency is handled downstream (member_report_log UNIQUE + reports_sent_at).
 */
export async function resumeReportSend(
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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const cronSecret = process.env.CRON_SECRET ?? ''

  if (!appUrl || !cronSecret) {
    return { error: 'Server not configured (NEXT_PUBLIC_APP_URL or CRON_SECRET missing)' }
  }

  // Fire-and-forget — same contract as closeGameweek.
  void fetch(`${appUrl}/api/reports/send-weekly`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cronSecret}`,
    },
    body: JSON.stringify({ gameweek_id }),
  }).catch((err) => {
    console.error('[resumeReportSend] trigger failed:', err)
  })

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

  // Reverse any previously-applied weekly points from members.starting_points
  // so a subsequent close re-applies cleanly. No-op if points_applied=false.
  try {
    await reverseWeeklyFromStartingPoints(supabase, gameweek_id)
  } catch (error) {
    console.error('[reopenGameweek] reverseWeeklyFromStartingPoints failed:', error)
    await supabase.from('admin_notifications').insert({
      type: 'system',
      title: `Gameweek ${gwNumber} re-open didn't tidy up — Dave needs to check`,
      message: `Gameweek ${gwNumber} was re-opened but the weekly points could not be taken back out of the season totals. Standings may be off until Dave takes a look.`,
    })
  }

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
