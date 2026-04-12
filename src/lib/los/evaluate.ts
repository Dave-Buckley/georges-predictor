/**
 * Pure Last One Standing evaluator library.
 *
 * This module has NO imports, NO DB access, NO side effects.
 * It is the single source of truth for LOS pick outcome + round resolution.
 *
 * LOS rules:
 *   - Pick one team per gameweek; if they win you survive.
 *   - Draw or loss → eliminated.
 *   - Missed submission → eliminated (evaluateLosRound responsibility).
 *   - Down to one survivor → that member wins the cycle.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** Outcome of a single LOS pick once its fixture has finished */
export type LosOutcome = 'win' | 'lose' | 'draw' | 'pending'

/** Evaluation of a single LOS pick */
export interface LosPickEvaluation {
  pick_id: string
  outcome: LosOutcome
  /** True when the member should be eliminated based on this pick alone */
  eliminated: boolean
}

/** Full input needed to evaluate a single LOS pick */
export interface LosPickEvaluationInput {
  pick_id: string
  picked_team_id: string
  home_team_id: string
  away_team_id: string
  home_score: number | null
  away_score: number | null
  fixture_status: string
}

/** Full input shape for a round-level pick (adds member_id + fixture_id) */
export interface LosRoundPickInput {
  pick_id: string
  member_id: string
  team_id: string
  fixture_id: string
  home_team_id: string
  away_team_id: string
  home_score: number | null
  away_score: number | null
  fixture_status: string
}

/** Result of evaluating an entire LOS round for a gameweek */
export interface LosRoundEvaluation {
  evaluations: LosPickEvaluation[]
  /** Active members who had no pick row for this round */
  missed_submission_member_ids: string[]
  /** Members who remain in the competition after this round */
  survivors: string[]
  /** The sole winner's member_id when survivors.length === 1; null otherwise */
  winner_id: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns 'H' | 'D' | 'A' from the home team's perspective.
 * Returns null when either score is null (fixture not yet scored).
 */
function resultDirection(
  home: number | null,
  away: number | null,
): 'H' | 'D' | 'A' | null {
  if (home === null || away === null) return null
  if (home > away) return 'H'
  if (home < away) return 'A'
  return 'D'
}

// ─── Single-pick evaluator ───────────────────────────────────────────────────

/**
 * Evaluate a single LOS pick.
 *
 * Guarantees:
 *   - Returns 'pending' (not eliminated) if fixture_status !== 'FINISHED'.
 *   - Returns 'pending' (not eliminated) if scores are null.
 *   - Returns 'pending' (not eliminated) if picked_team_id does not match
 *     either side of the fixture (guard against stale/corrupt data).
 *   - Draw → outcome='draw', eliminated=true.
 *   - Loss → outcome='lose', eliminated=true.
 *   - Win  → outcome='win',  eliminated=false.
 */
export function evaluateLosPick(input: LosPickEvaluationInput): LosPickEvaluation {
  const { pick_id, picked_team_id, home_team_id, away_team_id } = input

  // Guard: fixture not yet final, or scores missing → pending.
  if (input.fixture_status !== 'FINISHED') {
    return { pick_id, outcome: 'pending', eliminated: false }
  }

  const direction = resultDirection(input.home_score, input.away_score)
  if (direction === null) {
    return { pick_id, outcome: 'pending', eliminated: false }
  }

  // Guard: picked team must actually be in the fixture.
  const pickedHome = picked_team_id === home_team_id
  const pickedAway = picked_team_id === away_team_id
  if (!pickedHome && !pickedAway) {
    return { pick_id, outcome: 'pending', eliminated: false }
  }

  if (direction === 'D') {
    return { pick_id, outcome: 'draw', eliminated: true }
  }

  const won =
    (direction === 'H' && pickedHome) || (direction === 'A' && pickedAway)

  return won
    ? { pick_id, outcome: 'win', eliminated: false }
    : { pick_id, outcome: 'lose', eliminated: true }
}

// ─── Round-level evaluator ───────────────────────────────────────────────────

/**
 * Evaluate an entire LOS round for a gameweek.
 *
 * Inputs:
 *   - active_member_ids: members still in the competition before this round.
 *   - picks: every pick submitted for this round (one per member at most).
 *
 * Output:
 *   - evaluations: per-pick LosPickEvaluation, one entry per input pick.
 *   - missed_submission_member_ids: active members with no pick row.
 *   - survivors: active members who neither missed nor got eliminated.
 *   - winner_id: sole survivor's member_id; null if 0 or 2+ survivors.
 */
export function evaluateLosRound(params: {
  active_member_ids: string[]
  picks: LosRoundPickInput[]
}): LosRoundEvaluation {
  const { active_member_ids, picks } = params

  // Evaluate every pick.
  const evaluations: LosPickEvaluation[] = picks.map((p) =>
    evaluateLosPick({
      pick_id: p.pick_id,
      picked_team_id: p.team_id,
      home_team_id: p.home_team_id,
      away_team_id: p.away_team_id,
      home_score: p.home_score,
      away_score: p.away_score,
      fixture_status: p.fixture_status,
    }),
  )

  // Build member → eliminated lookup via pick_id join.
  const eliminatedByPickId = new Map<string, boolean>()
  for (const ev of evaluations) {
    eliminatedByPickId.set(ev.pick_id, ev.eliminated)
  }

  const memberToEliminated = new Map<string, boolean>()
  for (const p of picks) {
    memberToEliminated.set(p.member_id, eliminatedByPickId.get(p.pick_id) === true)
  }

  // Members with no pick row → missed submission → eliminated.
  const pickedMemberIds = new Set(picks.map((p) => p.member_id))
  const missed_submission_member_ids = active_member_ids.filter(
    (id) => !pickedMemberIds.has(id),
  )

  // Survivors: active, had a pick, and pick did not eliminate them.
  const survivors = active_member_ids.filter((id) => {
    if (!pickedMemberIds.has(id)) return false // missed
    return memberToEliminated.get(id) === false
  })

  // Track pending outcomes by member_id so we only declare a winner once all
  // survivors have settled picks (avoids premature winner when fixtures are
  // still in progress).
  const memberToOutcome = new Map<string, LosOutcome>()
  for (const p of picks) {
    const ev = evaluations.find((e) => e.pick_id === p.pick_id)
    if (ev) memberToOutcome.set(p.member_id, ev.outcome)
  }
  const anySurvivorPending = survivors.some(
    (id) => memberToOutcome.get(id) === 'pending',
  )

  const winner_id =
    survivors.length === 1 && !anySurvivorPending ? survivors[0] : null

  return {
    evaluations,
    missed_submission_member_ids,
    survivors,
    winner_id,
  }
}
