/**
 * Head-to-head sync hook orchestrator (Phase 8 Plan 02).
 *
 * Two entry points invoked from the fixture sync pipeline:
 *   - detectH2HForGameweek:   after a gameweek is CLOSED (closed_at set),
 *                             rank members and create h2h_steals rows for
 *                             ties at positions 1 and 2.
 *   - resolveStealsForGameweek: when a later gameweek closes, compute
 *                             next-week totals for the tied members and
 *                             write winner_ids onto any pending steals.
 *
 * Pure logic lives in detect-ties.ts + resolve-steal.ts (Plan 01). This
 * file is DB glue only — all writes use the admin client.
 *
 * CRITICAL: weekly totals MUST exclude unconfirmed bonus awards
 * (bonus_awards.awarded !== true). This respects Phase 6's two-phase bonus
 * confirmation rule (Pitfall 3 in 08-RESEARCH.md).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { detectWeeklyTies, type WeeklyTotal } from './detect-ties'
import { resolveSteal } from './resolve-steal'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DetectH2HResult {
  stealsCreated: number
}

export interface ResolveStealsResult {
  resolvedCount: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build weekly-total rows for a gameweek.
 * Sums prediction_scores.points_awarded + confirmed bonus_awards.points_awarded.
 */
async function loadWeeklyTotals(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminClient: SupabaseClient<any>,
  gameweekId: string,
  filterMemberIds?: string[],
): Promise<WeeklyTotal[]> {
  // Predictions: points_awarded grouped by member
  let predQuery = adminClient
    .from('prediction_scores')
    .select('member_id, points_awarded')
    .eq('gameweek_id' as never, gameweekId)

  // prediction_scores doesn't have gameweek_id directly — it has fixture_id.
  // We need to join via fixtures. Fall back to the supported shape: query
  // fixtures first for the gameweek, then filter prediction_scores by fixture_id IN (...).
  const { data: gwFixtures } = await adminClient
    .from('fixtures')
    .select('id')
    .eq('gameweek_id', gameweekId)

  const fixtureIds: string[] = ((gwFixtures ?? []) as Array<{ id: string }>).map((f) => f.id)

  predQuery = adminClient
    .from('prediction_scores')
    .select('member_id, points_awarded')
    .in('fixture_id', fixtureIds.length > 0 ? fixtureIds : ['__no_fixtures__'])

  if (filterMemberIds && filterMemberIds.length > 0) {
    predQuery = predQuery.in('member_id', filterMemberIds)
  }

  const { data: predRows } = await predQuery

  let bonusQuery = adminClient
    .from('bonus_awards')
    .select('member_id, points_awarded, awarded')
    .eq('gameweek_id', gameweekId)
    .eq('awarded', true) // Pitfall 3: confirmed only

  if (filterMemberIds && filterMemberIds.length > 0) {
    bonusQuery = bonusQuery.in('member_id', filterMemberIds)
  }

  const { data: bonusRows } = await bonusQuery

  const totals = new Map<string, number>()
  for (const row of ((predRows ?? []) as Array<{ member_id: string; points_awarded: number }>)) {
    totals.set(row.member_id, (totals.get(row.member_id) ?? 0) + (row.points_awarded ?? 0))
  }
  for (const row of ((bonusRows ?? []) as Array<{ member_id: string; points_awarded: number }>)) {
    totals.set(row.member_id, (totals.get(row.member_id) ?? 0) + (row.points_awarded ?? 0))
  }

  const out: WeeklyTotal[] = []
  for (const [member_id, total] of totals.entries()) {
    out.push({ member_id, total })
  }
  return out
}

// ─── detectH2HForGameweek ────────────────────────────────────────────────────

/**
 * Detect weekly H2H ties at positions 1 and 2. Only runs when the gameweek
 * has been CLOSED (George confirmed all bonus awards). This respects the
 * Phase 6 two-phase bonus flow — we never count unconfirmed bonuses.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function detectH2HForGameweek(
  adminClient: SupabaseClient<any>,
  gameweekId: string,
): Promise<DetectH2HResult> {
  // 1. Load gameweek, check closed_at
  const { data: gw } = await adminClient
    .from('gameweeks')
    .select('id, number, closed_at')
    .eq('id', gameweekId)
    .single()

  if (!gw || !gw.closed_at) {
    return { stealsCreated: 0 }
  }

  // 2. Weekly totals
  const totals = await loadWeeklyTotals(adminClient, gameweekId)

  // 3. Pure tie detection
  const tieGroups = detectWeeklyTies(totals)
  if (tieGroups.length === 0) return { stealsCreated: 0 }

  // 4. Resolve next-gw id
  const { data: nextGw } = await adminClient
    .from('gameweeks')
    .select('id, number')
    .eq('number', gw.number + 1)
    .single()

  if (!nextGw) {
    // No next gameweek (end of season / missing row) — cannot create steals
    // because we'd have no resolves_in_gw_id. Bail out quietly.
    return { stealsCreated: 0 }
  }

  // 5. Insert h2h_steals rows. DB enforces UNIQUE(detected_in_gw_id, position)
  // so a duplicate will error — we treat that as idempotent no-op.
  let created = 0
  for (const group of tieGroups) {
    const { error } = await adminClient.from('h2h_steals').insert({
      detected_in_gw_id: gameweekId,
      resolves_in_gw_id: nextGw.id,
      position: group.position,
      tied_member_ids: group.member_ids,
    })
    if (!error) {
      created++
    } else if (error.code !== '23505') {
      // Non-duplicate error — log but continue
      console.error('[detectH2HForGameweek] Steal insert error:', error.message)
    }
  }

  // 6. Admin notification (once per run with ties)
  if (created > 0) {
    await adminClient.from('admin_notifications').insert({
      type: 'h2h_steal_detected',
      title: `H2H steal detected in GW${gw.number}`,
      message: `${created} tie group${created !== 1 ? 's' : ''} at position 1/2 — resolves in GW${gw.number + 1}`,
    })
  }

  return { stealsCreated: created }
}

// ─── resolveStealsForGameweek ────────────────────────────────────────────────

/**
 * Resolve all pending H2H steals whose resolves_in_gw_id = given gameweek.
 * Called after that gameweek is closed — uses next-week totals for the tied
 * members to determine winner_ids via pure resolveSteal.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function resolveStealsForGameweek(
  adminClient: SupabaseClient<any>,
  resolvesInGwId: string,
): Promise<ResolveStealsResult> {
  const { data: pendingSteals } = await adminClient
    .from('h2h_steals')
    .select('id, detected_in_gw_id, resolves_in_gw_id, position, tied_member_ids')
    .eq('resolves_in_gw_id', resolvesInGwId)
    .is('resolved_at', null)

  const steals = ((pendingSteals ?? []) as Array<{
    id: string
    detected_in_gw_id: string
    resolves_in_gw_id: string
    position: 1 | 2
    tied_member_ids: string[]
  }>)

  if (steals.length === 0) return { resolvedCount: 0 }

  let resolved = 0
  for (const steal of steals) {
    // Load next-week totals for only the tied members
    const totals = await loadWeeklyTotals(
      adminClient,
      resolvesInGwId,
      steal.tied_member_ids,
    )

    const totalsMap: Record<string, number> = {}
    for (const t of totals) totalsMap[t.member_id] = t.total

    const { winner_ids } = resolveSteal({
      tied_member_ids: steal.tied_member_ids,
      next_week_totals: totalsMap,
    })

    const { error } = await adminClient
      .from('h2h_steals')
      .update({
        winner_ids,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', steal.id)

    if (!error) resolved++
  }

  if (resolved > 0) {
    await adminClient.from('admin_notifications').insert({
      type: 'h2h_steal_resolved',
      title: 'H2H steal resolved',
      message: `${resolved} steal${resolved !== 1 ? 's' : ''} resolved in this gameweek`,
    })
  }

  return { resolvedCount: resolved }
}
