/**
 * gatherGameweekData — the single source of truth for every Phase 10 report
 * artifact (personal PDF, group PDF, admin XLSX, kickoff-backup doc).
 *
 * Design:
 *   - One parallel `Promise.all` admin-client fetch of all raw tables.
 *   - Pure `shapeData` transform — no DB calls, testable in isolation.
 *   - Renderers must never talk to Supabase directly; they consume
 *     GameweekReportData and nothing else.
 *
 * Non-goals:
 *   - Filtering by kickoff (backup doc and post-close reports both need
 *     the full picture — caller can post-process).
 *   - Formatting (currency, dates) — renderers own presentation.
 */

import { createAdminClient } from '@/lib/supabase/admin'

// ─── Public types ────────────────────────────────────────────────────────────

export interface GameweekReportData {
  gwNumber: number
  gwId: string
  /** Null if the gameweek hasn't been closed yet (backup/preview path). */
  closedAtIso: string | null
  /** e.g. "2025-26" (derived from season + 1). */
  seasonLabel: string
  doubleBubbleActive: boolean
  standings: Array<{
    memberId: string
    displayName: string
    totalPoints: number
    rank: number
    weeklyPoints: number
  }>
  fixtures: Array<{
    id: string
    home: string
    away: string
    homeScore: number | null
    awayScore: number | null
    status: string
    kickoffIso: string
  }>
  predictionsByMember: Record<
    string,
    Array<{
      fixtureId: string
      homePrediction: number
      awayPrediction: number
      pointsAwarded: number
      isBonusFixture: boolean
      bonusPointsAwarded: number
    }>
  >
  bonus: {
    type: string | null
    pickByMember: Record<
      string,
      { fixtureId: string | null; awarded: boolean | null }
    >
  }
  losStatus: Array<{
    memberId: string
    teamPicked: string | null
    survived: boolean | null
    eliminated: boolean
  }>
  h2hSteals: Array<{
    detectedInGwId: string
    resolvesInGwId: string | null
    resolvedAt: string | null
    position: number
    memberIds: string[]
    winnerId: string | null
  }>
  topWeekly: Array<{
    memberId: string
    displayName: string
    weeklyPoints: number
  }>
}

// ─── Internal raw-row shapes (loose — Supabase returns untyped `any`) ────────

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ShapeDataInput {
  gameweek: any
  fixtures: any[]
  predictions: any[]
  predictionScores: any[]
  bonusAwards: any[]
  losPicks: any[]
  losMembers: any[]
  h2hSteals: any[]
  members: any[]
  pointAdjustments: any[]
  gwId: string
}

// ─── Pure transform ──────────────────────────────────────────────────────────

/**
 * Maps raw DB rows into the GameweekReportData shape. Exported so downstream
 * tests can assert on the transform without mocking the admin client.
 */
export function shapeData(input: ShapeDataInput): GameweekReportData {
  const {
    gameweek,
    fixtures,
    predictions,
    predictionScores,
    bonusAwards,
    losPicks,
    losMembers,
    h2hSteals,
    members,
    pointAdjustments,
    gwId,
  } = input

  // ─── Season label ──────────────────────────────────────────────────────────
  const season: number = gameweek?.season ?? 0
  const seasonLabel = season
    ? `${season}-${String((season + 1) % 100).padStart(2, '0')}`
    : ''

  // ─── Indices ───────────────────────────────────────────────────────────────
  const predictionById = new Map<string, any>(predictions.map((p) => [p.id, p]))
  const scoreByPredictionId = new Map<string, any>(
    predictionScores.map((s) => [s.prediction_id, s]),
  )
  const bonusByMember = new Map<string, any>(
    bonusAwards.map((b) => [b.member_id, b]),
  )
  const losPickByMember = new Map<string, any>(
    losPicks.map((l) => [l.member_id, l]),
  )
  const losMemberByMember = new Map<string, any>(
    losMembers.map((m) => [m.member_id, m]),
  )
  const memberById = new Map<string, any>(members.map((m) => [m.id, m]))

  // ─── Weekly points per member (base scores + confirmed bonuses) ───────────
  const weeklyByMember = new Map<string, number>()
  for (const score of predictionScores) {
    const prev = weeklyByMember.get(score.member_id) ?? 0
    weeklyByMember.set(score.member_id, prev + (score.points_awarded ?? 0))
  }
  for (const bonus of bonusAwards) {
    if (bonus.awarded === true) {
      const prev = weeklyByMember.get(bonus.member_id) ?? 0
      weeklyByMember.set(
        bonus.member_id,
        prev + (bonus.points_awarded ?? 0),
      )
    }
  }

  // ─── Double Bubble ×2 (Phase 11 Plan 01 Task 4) ───────────────────────────
  // Apply the display-layer multiplier once here, before any consumer reads
  // `weeklyPoints`. Personal PDF, group PDF, admin XLSX, and the public
  // standings top-3 weekly all pull from this same aggregator so they now
  // agree on GW10/20/30 numbers. Pending bonuses remain excluded above
  // (still `awarded === true` gate), so pending picks are NOT doubled.
  if (gameweek?.double_bubble) {
    for (const [memberId, pts] of weeklyByMember) {
      weeklyByMember.set(memberId, pts * 2)
    }
  }

  // Manual admin adjustments (migration 020) are final post-Double-Bubble
  // deltas, so they layer on AFTER the ×2 above.
  for (const adj of pointAdjustments) {
    const prev = weeklyByMember.get(adj.member_id) ?? 0
    weeklyByMember.set(adj.member_id, prev + (adj.delta ?? 0))
  }

  // ─── Standings ────────────────────────────────────────────────────────────
  // Once closeGameweek has rolled weekly into starting_points (migration 014,
  // tracked via gameweeks.points_applied), total = starting_points. Otherwise
  // (pre-close preview / backup doc) total = starting_points + weekly.
  // Explicit `total_points` on a member row still wins for callers that
  // pre-aggregate history.
  const pointsApplied = !!gameweek?.points_applied
  const standingsRaw = members.map((m) => {
    const weekly = weeklyByMember.get(m.id) ?? 0
    const total =
      typeof m.total_points === 'number'
        ? m.total_points
        : pointsApplied
          ? (m.starting_points ?? 0)
          : (m.starting_points ?? 0) + weekly
    return {
      memberId: m.id,
      displayName: m.display_name,
      totalPoints: total,
      weeklyPoints: weekly,
    }
  })
  standingsRaw.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
    return a.displayName.localeCompare(b.displayName)
  })
  const standings = standingsRaw.map((s, i) => ({ ...s, rank: i + 1 }))

  // ─── Fixtures (team-embedded) ─────────────────────────────────────────────
  const shapedFixtures = fixtures.map((f) => ({
    id: f.id,
    home: f.home_team?.name ?? '',
    away: f.away_team?.name ?? '',
    homeScore: f.home_score ?? null,
    awayScore: f.away_score ?? null,
    status: f.status ?? 'SCHEDULED',
    kickoffIso: f.kickoff_time ?? '',
  }))

  // ─── predictionsByMember ──────────────────────────────────────────────────
  const predictionsByMember: GameweekReportData['predictionsByMember'] = {}
  for (const pred of predictions) {
    const score = scoreByPredictionId.get(pred.id)
    const memberBonus = bonusByMember.get(pred.member_id)
    const isBonusFixture = memberBonus?.fixture_id === pred.fixture_id
    const bonusPointsAwarded =
      isBonusFixture && memberBonus?.awarded === true
        ? (memberBonus.points_awarded ?? 0)
        : 0
    const entry = {
      fixtureId: pred.fixture_id,
      homePrediction: pred.home_score,
      awayPrediction: pred.away_score,
      pointsAwarded: score?.points_awarded ?? 0,
      isBonusFixture,
      bonusPointsAwarded,
    }
    if (!predictionsByMember[pred.member_id]) {
      predictionsByMember[pred.member_id] = []
    }
    predictionsByMember[pred.member_id].push(entry)
  }

  // ─── Bonus block ──────────────────────────────────────────────────────────
  const bonusType: string | null =
    bonusAwards[0]?.bonus_type?.name ?? null
  const pickByMember: Record<
    string,
    { fixtureId: string | null; awarded: boolean | null }
  > = {}
  for (const b of bonusAwards) {
    pickByMember[b.member_id] = {
      fixtureId: b.fixture_id ?? null,
      awarded: b.awarded ?? null,
    }
  }

  // ─── losStatus (per member) ───────────────────────────────────────────────
  const losStatus: GameweekReportData['losStatus'] = members.map((m) => {
    const pick = losPickByMember.get(m.id)
    const compMember = losMemberByMember.get(m.id)
    const eliminated =
      compMember?.status === 'eliminated' || compMember?.eliminated_at_gw != null
    let survived: boolean | null = null
    if (pick) {
      if (pick.outcome === 'win') survived = true
      else if (pick.outcome === 'lose' || pick.outcome === 'draw') survived = false
      // 'pending' or null → survived stays null
    }
    return {
      memberId: m.id,
      teamPicked: pick?.team?.name ?? null,
      survived,
      eliminated,
    }
  })

  // ─── H2H steals (both newly-detected AND resolving this gw) ───────────────
  const shapedSteals: GameweekReportData['h2hSteals'] = h2hSteals.map((s) => ({
    detectedInGwId: s.detected_in_gw_id,
    resolvesInGwId: s.resolves_in_gw_id ?? null,
    resolvedAt: s.resolved_at ?? null,
    position: s.position,
    memberIds: [...(s.tied_member_ids ?? [])].sort(),
    winnerId:
      Array.isArray(s.winner_ids) && s.winner_ids.length > 0
        ? s.winner_ids[0]
        : null,
  }))

  // ─── Top 3 weekly ─────────────────────────────────────────────────────────
  const topWeekly = members
    .map((m) => ({
      memberId: m.id,
      displayName: m.display_name,
      weeklyPoints: weeklyByMember.get(m.id) ?? 0,
    }))
    .filter((x) => predictionsByMember[x.memberId]?.length) // require participation
    .sort((a, b) => {
      if (b.weeklyPoints !== a.weeklyPoints) return b.weeklyPoints - a.weeklyPoints
      return a.displayName.localeCompare(b.displayName)
    })
    .slice(0, 3)

  return {
    gwNumber: gameweek?.number ?? 0,
    gwId,
    closedAtIso: gameweek?.closed_at ?? null,
    seasonLabel,
    doubleBubbleActive: !!gameweek?.double_bubble,
    standings,
    fixtures: shapedFixtures,
    predictionsByMember,
    bonus: { type: bonusType, pickByMember },
    losStatus,
    h2hSteals: shapedSteals,
    topWeekly,
  }
  // unused-var suppression (memberById held for future join-based renderers)
  void memberById
  void predictionById
}

// ─── Aggregator (single parallel fetch) ──────────────────────────────────────

/**
 * Fetches every table the Phase 10 renderers need in one parallel round-trip,
 * then hands the raw rows off to `shapeData` for pure transformation.
 */
export async function gatherGameweekData(
  gwId: string,
): Promise<GameweekReportData> {
  const admin = createAdminClient()

  const [
    { data: gameweek },
    { data: fixtures },
    { data: predictions },
    { data: predictionScores },
    { data: bonusAwards },
    { data: losPicks },
    { data: losMembers },
    { data: h2hSteals },
    { data: members },
    { data: pointAdjustments },
  ] = await Promise.all([
    admin
      .from('gameweeks')
      .select('*')
      .eq('id', gwId)
      .single(),
    admin
      .from('fixtures')
      .select('*, home_team:teams!fixtures_home_team_id_fkey(id, name), away_team:teams!fixtures_away_team_id_fkey(id, name)')
      .eq('gameweek_id', gwId),
    admin
      .from('predictions')
      .select('id, member_id, fixture_id, home_score, away_score'),
    admin
      .from('prediction_scores')
      .select('prediction_id, fixture_id, member_id, points_awarded'),
    admin
      .from('bonus_awards')
      .select('gameweek_id, member_id, fixture_id, awarded, points_awarded, bonus_type:bonus_types(id, name)')
      .eq('gameweek_id', gwId),
    admin
      .from('los_picks')
      .select('member_id, gameweek_id, fixture_id, outcome, team:teams(id, name)')
      .eq('gameweek_id', gwId),
    admin
      .from('los_competition_members')
      .select('member_id, status, eliminated_at_gw'),
    admin
      .from('h2h_steals')
      .select('detected_in_gw_id, resolves_in_gw_id, position, tied_member_ids, winner_ids, resolved_at')
      .or(`detected_in_gw_id.eq.${gwId},resolves_in_gw_id.eq.${gwId}`),
    admin
      .from('members')
      .select('id, display_name, starting_points, email_weekly_personal, email_weekly_group')
      .eq('approval_status', 'approved'),
    admin
      .from('point_adjustments')
      .select('member_id, delta')
      .eq('gameweek_id', gwId),
  ])

  // Filter predictions + scores to only those in this gw (we can't cheaply
  // add a WHERE on the client without a JOIN — do it post-fetch).
  const fixtureIds = new Set((fixtures ?? []).map((f: any) => f.id))
  const filteredPredictions = (predictions ?? []).filter((p: any) =>
    fixtureIds.has(p.fixture_id),
  )
  const filteredScores = (predictionScores ?? []).filter((s: any) =>
    fixtureIds.has(s.fixture_id),
  )

  return shapeData({
    gameweek: gameweek ?? {},
    fixtures: fixtures ?? [],
    predictions: filteredPredictions,
    predictionScores: filteredScores,
    bonusAwards: bonusAwards ?? [],
    losPicks: losPicks ?? [],
    losMembers: losMembers ?? [],
    h2hSteals: h2hSteals ?? [],
    members: members ?? [],
    pointAdjustments: pointAdjustments ?? [],
    gwId,
  })
}
/* eslint-enable @typescript-eslint/no-explicit-any */
