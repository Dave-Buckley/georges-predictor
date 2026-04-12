/**
 * Pure team-usage derivation for Last One Standing.
 *
 * Rule (LOS-03):
 *   - A member may pick each PL team at most once per competition cycle.
 *   - Once every team has been picked, the cycle resets and all 20 are
 *     available again — this is handled entirely by this function.
 *
 * Zero imports, zero side effects.
 */

/**
 * Returns the list of team ids the member is allowed to pick next.
 *
 * @param all_team_ids   - The full pool of selectable team ids (typically the 20 PL clubs).
 * @param picked_team_ids - Team ids already used by this member in the current cycle.
 *                          May contain duplicates; they are de-duplicated internally.
 *
 * Semantics:
 *   - picked_team_ids ids that are NOT in all_team_ids are ignored (no phantom exclusions).
 *   - If the unique picked ids cover every id in all_team_ids, the cycle has
 *     completed → return a copy of all_team_ids (full reset).
 *   - Otherwise return all_team_ids minus picked_team_ids, preserving input order.
 */
export function availableTeams(params: {
  all_team_ids: string[]
  picked_team_ids: string[]
}): string[] {
  const { all_team_ids, picked_team_ids } = params

  // Only count picks that actually belong to the current team pool.
  const pool = new Set(all_team_ids)
  const validPicked = new Set(picked_team_ids.filter((id) => pool.has(id)))

  // Cycle-reset rule: when every team in the pool has been used.
  if (validPicked.size === all_team_ids.length && all_team_ids.length > 0) {
    return [...all_team_ids]
  }

  return all_team_ids.filter((id) => !validPicked.has(id))
}
