/**
 * Pure weekly head-to-head tie detection.
 *
 * Rule (H2H-01):
 *   - Rank members by weekly total DESC using dense rank.
 *   - A "tie" only matters at position 1 (steal) or position 2 (steal target).
 *   - Members with total <= 0 are excluded (nothing to steal / be stolen).
 *   - Only groups with 2+ members are returned.
 *
 * Zero imports, zero side effects.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WeeklyTotal {
  member_id: string
  /** Total points scored this gameweek (prediction_scores + confirmed bonus_awards) */
  total: number
}

export interface TieGroup {
  position: 1 | 2
  /** Member ids tied at this position, always length >= 2 and sorted alphabetically */
  member_ids: string[]
  total: number
}

// ─── Core ─────────────────────────────────────────────────────────────────────

/**
 * Detect weekly ties at positions 1 and 2.
 *
 * Returns an array containing 0, 1, or 2 TieGroup entries (position 1 first).
 */
export function detectWeeklyTies(totals: WeeklyTotal[]): TieGroup[] {
  // SQL parity: only consider members with strictly positive totals.
  const relevant = totals.filter((t) => t.total > 0)
  if (relevant.length === 0) return []

  // Dense rank: group by total (DESC), assign rank 1 to top group, 2 to next, etc.
  const totalsByValue = new Map<number, string[]>()
  for (const row of relevant) {
    const bucket = totalsByValue.get(row.total) ?? []
    bucket.push(row.member_id)
    totalsByValue.set(row.total, bucket)
  }

  const distinctDescending = [...totalsByValue.keys()].sort((a, b) => b - a)

  const result: TieGroup[] = []
  for (let i = 0; i < Math.min(2, distinctDescending.length); i++) {
    const total = distinctDescending[i]
    const member_ids = [...(totalsByValue.get(total) ?? [])].sort()
    if (member_ids.length < 2) continue
    result.push({ position: (i + 1) as 1 | 2, member_ids, total })
  }

  return result
}
