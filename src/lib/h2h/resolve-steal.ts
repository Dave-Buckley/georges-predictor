/**
 * Pure head-to-head steal resolver.
 *
 * Rule (H2H-03):
 *   - Given a set of tied members (from the prior week), look at their totals
 *     in the following week.
 *   - The member(s) with the highest next-week total win the steal.
 *   - If multiple members are still tied at the top, the steal is split
 *     (winner_ids contains all of them).
 *   - Missing member_ids in next_week_totals are treated as 0.
 *
 * Zero imports, zero side effects.
 */

/**
 * Resolve a pending head-to-head steal using next-week totals.
 *
 * @returns `{ winner_ids }` — always non-empty when tied_member_ids is non-empty.
 *          Sorted alphabetically for determinism.
 */
export function resolveSteal(params: {
  tied_member_ids: string[]
  /** member_id → total points the following gameweek (missing = 0) */
  next_week_totals: Record<string, number>
}): { winner_ids: string[] } {
  const { tied_member_ids, next_week_totals } = params

  if (tied_member_ids.length === 0) return { winner_ids: [] }

  const scored = tied_member_ids.map((id) => ({
    member_id: id,
    total: next_week_totals[id] ?? 0,
  }))

  const max = Math.max(...scored.map((s) => s.total))
  const winner_ids = scored
    .filter((s) => s.total === max)
    .map((s) => s.member_id)
    .sort()

  return { winner_ids }
}
