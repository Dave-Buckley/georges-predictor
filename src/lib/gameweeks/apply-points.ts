/**
 * Weekly-points accumulator.
 *
 * Rolls a gameweek's per-member weekly total (predictions + confirmed
 * bonuses, ×2 if double_bubble) into members.starting_points so the public
 * /standings page stays current without manual admin updates.
 *
 * Idempotency is the caller's job: check `gameweeks.points_applied` before
 * invoking apply(), and only call reverse() when it's currently true.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

interface GameweekRow {
  id: string
  double_bubble: boolean | null
}

interface FixtureIdRow {
  id: string
}

interface ScoreRow {
  member_id: string
  fixture_id: string
  points_awarded: number | null
}

interface BonusRow {
  member_id: string
  points_awarded: number | null
  awarded: boolean | null
}

interface AdjustmentRow {
  member_id: string
  delta: number | null
}

/**
 * Computes weekly points per member for a gameweek. Pure once the DB calls
 * have returned. Returned map is member_id → weekly points (already including
 * Double Bubble ×2 if applicable).
 */
async function computeWeeklyByMember(
  supabase: SupabaseClient,
  gwId: string,
): Promise<Map<string, number>> {
  const [
    { data: gw },
    { data: fixtures },
    { data: scores },
    { data: bonuses },
    { data: adjustments },
  ] = await Promise.all([
    supabase
      .from('gameweeks')
      .select('id, double_bubble')
      .eq('id', gwId)
      .single<GameweekRow>(),
    supabase
      .from('fixtures')
      .select('id')
      .eq('gameweek_id', gwId)
      .returns<FixtureIdRow[]>(),
    supabase
      .from('prediction_scores')
      .select('member_id, fixture_id, points_awarded')
      .returns<ScoreRow[]>(),
    supabase
      .from('bonus_awards')
      .select('member_id, points_awarded, awarded')
      .eq('gameweek_id', gwId)
      .eq('awarded', true)
      .returns<BonusRow[]>(),
    supabase
      .from('point_adjustments')
      .select('member_id, delta')
      .eq('gameweek_id', gwId)
      .returns<AdjustmentRow[]>(),
  ])

  const fixtureIds = new Set((fixtures ?? []).map((f) => f.id))
  const weekly = new Map<string, number>()

  for (const s of scores ?? []) {
    if (!fixtureIds.has(s.fixture_id)) continue
    weekly.set(s.member_id, (weekly.get(s.member_id) ?? 0) + (s.points_awarded ?? 0))
  }
  for (const b of bonuses ?? []) {
    weekly.set(b.member_id, (weekly.get(b.member_id) ?? 0) + (b.points_awarded ?? 0))
  }

  if (gw?.double_bubble) {
    for (const [id, pts] of weekly) weekly.set(id, pts * 2)
  }

  // Manual admin adjustments are stored as final (post-Double-Bubble) deltas,
  // so they layer on AFTER the ×2 above.
  for (const a of adjustments ?? []) {
    weekly.set(a.member_id, (weekly.get(a.member_id) ?? 0) + (a.delta ?? 0))
  }

  return weekly
}

/**
 * Adds this gameweek's weekly points to every member's starting_points.
 * Sets `gameweeks.points_applied = true` on success.
 * No-op (returns `{ applied: 0 }`) if points_applied was already true.
 */
export async function applyWeeklyToStartingPoints(
  supabase: SupabaseClient,
  gwId: string,
): Promise<{ applied: number }> {
  const { data: gwRow } = await supabase
    .from('gameweeks')
    .select('points_applied')
    .eq('id', gwId)
    .single<{ points_applied: boolean }>()

  if (gwRow?.points_applied) return { applied: 0 }

  const weekly = await computeWeeklyByMember(supabase, gwId)
  const applied = await adjustStartingPoints(supabase, weekly, +1)

  await supabase
    .from('gameweeks')
    .update({ points_applied: true })
    .eq('id', gwId)

  return { applied }
}

/**
 * Subtracts this gameweek's weekly points from every member's
 * starting_points. Flips `gameweeks.points_applied = false` on success.
 * No-op if points_applied was already false.
 */
export async function reverseWeeklyFromStartingPoints(
  supabase: SupabaseClient,
  gwId: string,
): Promise<{ reversed: number }> {
  const { data: gwRow } = await supabase
    .from('gameweeks')
    .select('points_applied')
    .eq('id', gwId)
    .single<{ points_applied: boolean }>()

  if (!gwRow?.points_applied) return { reversed: 0 }

  const weekly = await computeWeeklyByMember(supabase, gwId)
  const reversed = await adjustStartingPoints(supabase, weekly, -1)

  await supabase
    .from('gameweeks')
    .update({ points_applied: false })
    .eq('id', gwId)

  return { reversed }
}

async function adjustStartingPoints(
  supabase: SupabaseClient,
  weekly: Map<string, number>,
  sign: 1 | -1,
): Promise<number> {
  if (weekly.size === 0) return 0

  const memberIds = [...weekly.keys()]
  const { data: rows } = await supabase
    .from('members')
    .select('id, starting_points')
    .in('id', memberIds)
    .returns<Array<{ id: string; starting_points: number | null }>>()

  let changed = 0
  for (const m of rows ?? []) {
    const delta = (weekly.get(m.id) ?? 0) * sign
    if (delta === 0) continue
    const next = Math.max(0, (m.starting_points ?? 0) + delta)
    const { error } = await supabase
      .from('members')
      .update({ starting_points: next })
      .eq('id', m.id)
    if (error) {
      console.error('[apply-points] update failed', m.id, error.message)
      continue
    }
    changed++
  }
  return changed
}
