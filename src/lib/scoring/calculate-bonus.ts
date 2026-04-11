/**
 * Pure bonus scoring calculation library.
 *
 * This module has NO imports, NO DB access, NO side effects.
 * It is the single source of truth for bonus point calculation logic.
 *
 * Bonus scoring rules:
 *   - Score-evaluable bonuses (Golden Glory, Jose Park The Bus) are calculated automatically.
 *   - All other bonus types require George to confirm manually (requires_manual_review: true).
 *
 *   Golden Glory:
 *     - Exact score match → 60 points
 *     - Correct result only → 20 points
 *     - Wrong result → 0 points
 *
 *   Jose Park The Bus:
 *     - score_correct AND actual score is 0-0, 1-0, or 0-1 → 20 points
 *     - Otherwise → 0 points
 *
 *   Double Bubble:
 *     - Applied at display/calculation time only (raw scores stay clean).
 *     - Confirmed bonuses are included in the doubled total.
 *     - Pending bonuses are NOT included until George confirms.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** Result of evaluating a bonus condition against a fixture outcome */
export type BonusEvalResult = {
  /** Whether the bonus condition was met */
  condition_met: boolean
  /** Points awarded: 0 if condition not met or event-dependent, 20 or 60 for score-evaluable */
  points_awarded: 0 | 20 | 60
  /** True for bonus types that need George's manual review (cannot be auto-calculated) */
  requires_manual_review: boolean
}

/** Result of computing a member's display total including bonus and Double Bubble */
export interface DisplayTotal {
  /** Base prediction points + confirmed bonus points (before Double Bubble) */
  rawTotal: number
  /** Final displayed total, doubled if Double Bubble is active */
  displayTotal: number
  /** Whether the bonus was included in the total (only true when confirmed) */
  bonusIncluded: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Bonus types whose condition can be evaluated directly from the match score.
 * All other types require manual review by George.
 */
const SCORE_EVALUABLE_BONUSES = new Set(['Golden Glory', 'Jose Park The Bus'])

/**
 * Low-scoring results that satisfy the Jose Park The Bus condition.
 * The actual score must be exactly one of these to qualify.
 */
const JOSE_QUALIFYING_SCORES: ReadonlyArray<{ home: number; away: number }> = [
  { home: 0, away: 0 },
  { home: 1, away: 0 },
  { home: 0, away: 1 },
]

// ─── Core bonus calculation function ─────────────────────────────────────────

/**
 * Calculates bonus points for a single member's bonus pick.
 *
 * @param bonusTypeName  - The name of the active bonus type (e.g. 'Golden Glory')
 * @param scoreResult    - Whether the member's prediction was result-correct and/or score-correct
 * @param actualScore    - The final score of the chosen fixture { home, away }
 * @returns BonusEvalResult with condition_met, points_awarded, and requires_manual_review
 */
export function calculateBonusPoints(
  bonusTypeName: string,
  scoreResult: { result_correct: boolean; score_correct: boolean },
  actualScore: { home: number; away: number },
): BonusEvalResult {
  // All non-score-evaluable types require George's manual review
  if (!SCORE_EVALUABLE_BONUSES.has(bonusTypeName)) {
    return { condition_met: false, points_awarded: 0, requires_manual_review: true }
  }

  if (bonusTypeName === 'Golden Glory') {
    return evaluateGoldenGlory(scoreResult)
  }

  if (bonusTypeName === 'Jose Park The Bus') {
    return evaluateJoseParkTheBus(scoreResult, actualScore)
  }

  // Unreachable given the Set check above, but TypeScript requires exhaustiveness
  return { condition_met: false, points_awarded: 0, requires_manual_review: true }
}

// ─── Golden Glory evaluator ───────────────────────────────────────────────────

function evaluateGoldenGlory(
  scoreResult: { result_correct: boolean; score_correct: boolean },
): BonusEvalResult {
  if (scoreResult.score_correct) {
    return { condition_met: true, points_awarded: 60, requires_manual_review: false }
  }
  if (scoreResult.result_correct) {
    return { condition_met: true, points_awarded: 20, requires_manual_review: false }
  }
  return { condition_met: false, points_awarded: 0, requires_manual_review: false }
}

// ─── Jose Park The Bus evaluator ─────────────────────────────────────────────

function evaluateJoseParkTheBus(
  scoreResult: { result_correct: boolean; score_correct: boolean },
  actualScore: { home: number; away: number },
): BonusEvalResult {
  const isLowScoring = JOSE_QUALIFYING_SCORES.some(
    (qualifying) => qualifying.home === actualScore.home && qualifying.away === actualScore.away,
  )

  if (scoreResult.score_correct && isLowScoring) {
    return { condition_met: true, points_awarded: 20, requires_manual_review: false }
  }

  return { condition_met: false, points_awarded: 0, requires_manual_review: false }
}

// ─── Display total helper ─────────────────────────────────────────────────────

/**
 * Computes the final displayed point total for a member in a gameweek,
 * factoring in confirmed bonus points and the Double Bubble multiplier.
 *
 * Design rule: Bonus points are only included in the total when George has
 * confirmed the award (bonusConfirmed=true). The Double Bubble multiplier
 * then applies to the combined total.
 *
 * @param basePoints     - Points from base predictions (sum of prediction_scores)
 * @param bonusPoints    - Points from the bonus award (bonus_awards.points_awarded)
 * @param bonusConfirmed - Whether George has confirmed the bonus award
 * @param isDoubleBubble - Whether this gameweek has Double Bubble active
 * @returns DisplayTotal with rawTotal, displayTotal, and bonusIncluded
 */
export function computeDisplayTotal(
  basePoints: number,
  bonusPoints: number,
  bonusConfirmed: boolean,
  isDoubleBubble: boolean,
): DisplayTotal {
  // Only confirmed bonuses count toward the total
  const bonusIncluded = bonusConfirmed
  const rawTotal = basePoints + (bonusIncluded ? bonusPoints : 0)
  const displayTotal = isDoubleBubble ? rawTotal * 2 : rawTotal

  return { rawTotal, displayTotal, bonusIncluded }
}
