/**
 * Pure season-statistics aggregation library — Phase 11 Plan 02 Task 1.
 *
 * This module has NO imports, NO DB access, NO side effects.
 * Single source of truth for member-profile stats aggregation.
 *
 * Mirrors the pure-library idiom from Phase 4 (scoring/calculate.ts) and
 * Phase 9 (pre-season/calculate.ts). The caller is responsible for fetching
 * rows from Supabase and slicing them to (member + season); this function
 * only transforms.
 *
 * DESIGN NOTE: `weeklyLeaderboard` is pre-computed by the caller — the
 * aggregator cannot determine GW winners from per-member scores alone (it
 * would need the full cross-member slice). Keeping cross-member aggregation
 * out of here preserves purity and testability.
 */

// ─── Structural row types (in-file; loose — match DB column shape) ──────────
// These interfaces describe only the fields this library reads. Unknown
// fields on the input rows are ignored. Using `unknown` shapes here avoids
// coupling to @/lib/supabase/types (which imports from @supabase/supabase-js).

interface ScoreRow {
  member_id: string
  gameweek_id: string
  points_awarded: number
  result_correct: boolean
  score_correct: boolean
}

interface BonusRow {
  member_id: string
  /** null = pending, true = confirmed, false = rejected */
  awarded: boolean | null
  points_awarded: number
}

interface PrizeRow {
  member_id: string | null
  status: 'pending' | 'confirmed' | 'rejected'
  points_awarded?: number | null
}

interface PreSeasonAwardInput {
  member_id: string
  season: number
  awarded_points: number
  confirmed: boolean
  flags?: {
    all_top4_correct?: boolean
    all_relegated_correct?: boolean
    all_promoted_correct?: boolean
    all_correct_overall?: boolean
  }
}

interface LosPickInput {
  member_id: string
  competition_id: string
  team_id: string
}

interface LosCompetitionInput {
  id: string
  season: number
  winner_id: string | null
  status: 'active' | 'complete'
  ended_at_gw?: number | null
}

interface LosCompetitionMemberInput {
  competition_id: string
  member_id: string
  status: 'active' | 'eliminated'
  eliminated_at_gw: number | null
}

interface H2hStealInput {
  detected_in_gw_id: string
  winner_ids: string[] | null
  tied_member_ids: string[]
  resolved_at: string | null
}

interface GameweekInput {
  id: string
  number: number
}

interface WeeklyLeaderboardEntry {
  gameweekId: string
  /**
   * Top-scoring member IDs for this gameweek as computed by the caller.
   * Length 1 = sole winner. Length > 1 = tie (does NOT count toward
   * gwWinnerCount per spec — ties surface via h2hSteals instead).
   */
  topMemberIds: string[]
}

// ─── Public output types ────────────────────────────────────────────────────

export type LosStatus =
  | 'active'
  | 'eliminated'
  | 'winner'
  | 'not-participating'

export type AchievementKind =
  | 'gw-winner'
  | 'los-winner'
  | 'h2h-survivor'
  | 'pre-season-all-correct'
  | 'pre-season-category-correct'

export interface Achievement {
  kind: AchievementKind
  label: string
  detail?: string
}

export interface SeasonStats {
  season: number
  totalPoints: number
  /** Dense rank (ties share a rank). `null` if member not in allMemberTotals. */
  rank: number | null
  /** (correctResults + correctScores) / totalPredictions — 0 when zero preds. */
  predictionAccuracy: number
  correctResults: number
  correctScores: number
  /** confirmedBonusCount / (confirmed + pending + rejected). 0 on empty. */
  bonusConfirmationRate: number
  losStatus: LosStatus
  losTeamsUsed: number
  losWins: number
  /** Count of GWs where this member was the SOLE top scorer. Ties excluded. */
  gwWinnerCount: number
  achievements: Achievement[]
}

// ─── Input contract ─────────────────────────────────────────────────────────

export interface AggregateSeasonStatsInput {
  predictionScores: ScoreRow[]
  bonusAwards: BonusRow[]
  prizeAwards: PrizeRow[]
  preSeasonAward: PreSeasonAwardInput | null
  losPicks: LosPickInput[]
  losCompetitions: LosCompetitionInput[]
  /** Optional — if omitted, losStatus cannot resolve 'active'/'eliminated'. */
  losCompetitionMembers?: LosCompetitionMemberInput[]
  h2hSteals: H2hStealInput[]
  gameweeks: GameweekInput[]
  weeklyLeaderboard: WeeklyLeaderboardEntry[]
  allMemberTotals: { memberId: string; totalPoints: number }[]
  memberId: string
  season: number
}

// ─── Helpers (local, pure) ───────────────────────────────────────────────────

/** Dense rank of `memberId` in allMemberTotals (sorted DESC by totalPoints). */
function deriveRank(
  memberId: string,
  allMemberTotals: { memberId: string; totalPoints: number }[],
): number | null {
  if (!allMemberTotals.some((x) => x.memberId === memberId)) return null
  // Build dense-rank map: unique descending point values -> rank 1..n
  const uniqueDesc = Array.from(
    new Set(allMemberTotals.map((x) => x.totalPoints)),
  ).sort((a, b) => b - a)
  const rankByPoints = new Map<number, number>()
  uniqueDesc.forEach((pts, i) => rankByPoints.set(pts, i + 1))
  const entry = allMemberTotals.find((x) => x.memberId === memberId)!
  return rankByPoints.get(entry.totalPoints) ?? null
}

function resolveLosStatus(
  memberId: string,
  losPicks: LosPickInput[],
  losCompetitions: LosCompetitionInput[],
  losCompetitionMembers: LosCompetitionMemberInput[] | undefined,
  season: number,
): LosStatus {
  const memberPicks = losPicks.filter((p) => p.member_id === memberId)
  if (memberPicks.length === 0) return 'not-participating'

  // Winner: any season competition has winner_id === memberId
  const wonThisSeason = losCompetitions.some(
    (c) => c.season === season && c.winner_id === memberId,
  )
  if (wonThisSeason) return 'winner'

  // If we have los_competition_members data, use it to distinguish
  // active vs eliminated within the current season's active cycle.
  if (losCompetitionMembers && losCompetitionMembers.length > 0) {
    const seasonCompIds = new Set(
      losCompetitions.filter((c) => c.season === season).map((c) => c.id),
    )
    const memberStatusEntries = losCompetitionMembers.filter(
      (m) =>
        m.member_id === memberId &&
        (seasonCompIds.size === 0 || seasonCompIds.has(m.competition_id)),
    )
    if (memberStatusEntries.some((m) => m.status === 'eliminated')) {
      return 'eliminated'
    }
    if (memberStatusEntries.some((m) => m.status === 'active')) {
      return 'active'
    }
  }

  // Fallback: if picks exist but no competition-member row, treat as active.
  return 'active'
}

// ─── Main ────────────────────────────────────────────────────────────────────

export function aggregateSeasonStats(
  input: AggregateSeasonStatsInput,
): SeasonStats {
  const {
    predictionScores,
    bonusAwards,
    prizeAwards,
    preSeasonAward,
    losPicks,
    losCompetitions,
    losCompetitionMembers,
    h2hSteals,
    weeklyLeaderboard,
    allMemberTotals,
    memberId,
    season,
  } = input

  // ── Prediction stats (filter to the member, defensive) ────────────────────
  const memberScores = predictionScores.filter((p) => p.member_id === memberId)
  const correctResults = memberScores.filter(
    (p) => p.result_correct && !p.score_correct,
  ).length
  const correctScores = memberScores.filter((p) => p.score_correct).length
  const predictionsTotal = memberScores.length
  const predictionAccuracy =
    predictionsTotal === 0
      ? 0
      : (correctResults + correctScores) / predictionsTotal

  const predictionPoints = memberScores.reduce(
    (acc, p) => acc + (p.points_awarded ?? 0),
    0,
  )

  // ── Bonus stats ───────────────────────────────────────────────────────────
  const memberBonuses = bonusAwards.filter((b) => b.member_id === memberId)
  const confirmedBonuses = memberBonuses.filter((b) => b.awarded === true)
  const bonusConfirmationRate =
    memberBonuses.length === 0
      ? 0
      : confirmedBonuses.length / memberBonuses.length
  const bonusPoints = confirmedBonuses.reduce(
    (acc, b) => acc + (b.points_awarded ?? 0),
    0,
  )

  // ── Prize stats ───────────────────────────────────────────────────────────
  const confirmedPrizes = prizeAwards.filter(
    (p) => p.member_id === memberId && p.status === 'confirmed',
  )
  const prizePoints = confirmedPrizes.reduce(
    (acc, p) => acc + (p.points_awarded ?? 0),
    0,
  )

  // ── Pre-season award ──────────────────────────────────────────────────────
  const preSeasonPoints =
    preSeasonAward &&
    preSeasonAward.member_id === memberId &&
    preSeasonAward.season === season &&
    preSeasonAward.confirmed
      ? preSeasonAward.awarded_points
      : 0

  const totalPoints =
    predictionPoints + bonusPoints + prizePoints + preSeasonPoints

  // ── LOS stats ─────────────────────────────────────────────────────────────
  const memberLosPicks = losPicks.filter((p) => p.member_id === memberId)
  const losTeamsUsed = new Set(memberLosPicks.map((p) => p.team_id)).size

  const losWins = losCompetitions.filter(
    (c) => c.season === season && c.winner_id === memberId,
  ).length

  const losStatus = resolveLosStatus(
    memberId,
    losPicks,
    losCompetitions,
    losCompetitionMembers,
    season,
  )

  // ── GW winner count (sole wins only — ties excluded) ──────────────────────
  const gwWinnerCount = weeklyLeaderboard.filter(
    (w) => w.topMemberIds.length === 1 && w.topMemberIds[0] === memberId,
  ).length

  // ── Achievements ──────────────────────────────────────────────────────────
  const achievements: Achievement[] = []

  // GW wins (one achievement per sole win)
  const gwNumberById = new Map(
    input.gameweeks.map((g) => [g.id, g.number]),
  )
  for (const entry of weeklyLeaderboard) {
    if (
      entry.topMemberIds.length === 1 &&
      entry.topMemberIds[0] === memberId
    ) {
      const gwNumber = gwNumberById.get(entry.gameweekId)
      achievements.push({
        kind: 'gw-winner',
        label: gwNumber ? `GW${gwNumber} winner` : 'Gameweek winner',
      })
    }
  }

  // LOS competition wins (one per competition won this season)
  for (const c of losCompetitions) {
    if (c.season === season && c.winner_id === memberId) {
      achievements.push({
        kind: 'los-winner',
        label: 'Last One Standing winner',
        detail:
          c.ended_at_gw != null ? `Cycle ended GW${c.ended_at_gw}` : undefined,
      })
    }
  }

  // H2H survivor (one per resolved steal where this member won)
  for (const steal of h2hSteals) {
    if (
      steal.resolved_at &&
      steal.winner_ids &&
      steal.winner_ids.includes(memberId)
    ) {
      achievements.push({
        kind: 'h2h-survivor',
        label: 'Head-to-head survivor',
      })
    }
  }

  // Pre-season all-correct (one flat achievement)
  if (
    preSeasonAward &&
    preSeasonAward.member_id === memberId &&
    preSeasonAward.season === season &&
    preSeasonAward.flags?.all_correct_overall === true
  ) {
    achievements.push({
      kind: 'pre-season-all-correct',
      label: 'Pre-season clean sweep',
      detail: 'All 12 pre-season predictions correct',
    })
  }

  // ── Rank ──────────────────────────────────────────────────────────────────
  const rank = deriveRank(memberId, allMemberTotals)

  return {
    season,
    totalPoints,
    rank,
    predictionAccuracy,
    correctResults,
    correctScores,
    bonusConfirmationRate,
    losStatus,
    losTeamsUsed,
    losWins,
    gwWinnerCount,
    achievements,
  }
}
