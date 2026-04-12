/**
 * Pure competition-lifecycle helpers for Last One Standing.
 *
 * Zero imports, zero side effects. These are the smallest pieces of logic that
 * Plan 02 (orchestration) will compose when deciding whether to end a cycle
 * and start a new one.
 */

/**
 * Returns true when the current LOS competition should be marked complete
 * and a new cycle should be started.
 *
 * Rule (LOS-06):
 *   - Exactly one survivor means we have a winner — reset.
 *   - Zero survivors (freak tie-elimination) does NOT reset; Plan 02 handles
 *     that case with an admin prompt (out of scope for this pure helper).
 */
export function shouldResetCompetition(survivor_count: number): boolean {
  return survivor_count === 1
}

/**
 * Derives the next competition_num for a new LOS cycle.
 *
 * Rule (LOS-06):
 *   - When no prior competitions exist → start at 1.
 *   - Otherwise → max(prior_numbers) + 1.
 *   - Handles non-contiguous prior numbers gracefully (never re-use a gap).
 */
export function nextCompetitionNumber(prior_numbers: number[]): number {
  if (prior_numbers.length === 0) return 1
  return Math.max(...prior_numbers) + 1
}
