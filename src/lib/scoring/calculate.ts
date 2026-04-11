/**
 * Pure scoring calculation library.
 *
 * This module has NO imports, NO DB access, NO side effects.
 * It is the single source of truth for all point calculation logic.
 *
 * Scoring rules:
 *   - Exact score match  → 30 points
 *   - Correct result only → 10 points
 *   - Wrong result        → 0 points
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** Match result direction from the home team's perspective */
export type Outcome = 'H' | 'D' | 'A'

/** Full breakdown of a single prediction's score calculation */
export interface PointsResult {
  predicted_home: number
  predicted_away: number
  actual_home: number
  actual_away: number
  result_correct: boolean
  score_correct: boolean
  points_awarded: 0 | 10 | 30
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the match outcome direction from the home team's perspective.
 * - 'H' = home win
 * - 'D' = draw
 * - 'A' = away win
 */
export function getOutcome(home: number, away: number): Outcome {
  if (home > away) return 'H'
  if (home < away) return 'A'
  return 'D'
}

// ─── Core scoring function ────────────────────────────────────────────────────

/**
 * Calculates points awarded for a single prediction against an actual result.
 *
 * @param predicted - The member's predicted score { home, away }
 * @param actual    - The actual final score { home, away }
 * @returns PointsResult with full breakdown including points_awarded
 */
export function calculatePoints(
  predicted: { home: number; away: number },
  actual: { home: number; away: number },
): PointsResult {
  const predictedOutcome = getOutcome(predicted.home, predicted.away)
  const actualOutcome = getOutcome(actual.home, actual.away)

  const score_correct =
    predicted.home === actual.home && predicted.away === actual.away

  const result_correct = predictedOutcome === actualOutcome

  let points_awarded: 0 | 10 | 30
  if (score_correct) {
    points_awarded = 30
  } else if (result_correct) {
    points_awarded = 10
  } else {
    points_awarded = 0
  }

  return {
    predicted_home: predicted.home,
    predicted_away: predicted.away,
    actual_home: actual.home,
    actual_away: actual.away,
    result_correct,
    score_correct,
    points_awarded,
  }
}
