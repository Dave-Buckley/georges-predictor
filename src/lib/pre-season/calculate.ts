/**
 * Pure pre-season scoring library.
 *
 * This module has NO imports, NO DB access, NO side effects.
 * Single source of truth for end-of-season pre-season scoring (mirrors
 * the `scoring/calculate.ts` idiom from Phase 4).
 *
 * Rules (locked per CONTEXT.md):
 *   - 30 pts flat per correct team pick — no tiering, no doubling
 *   - Categories (12 total):
 *       top4 (4 teams, unordered)
 *       tenth (1 team)
 *       relegated (3 teams, unordered)
 *       promoted (3 teams, unordered)
 *       playoff_winner (1 team)
 *   - Unordered categories use SET semantics (picks need only cover the set)
 *   - All string comparisons are case-insensitive + whitespace-trimmed
 *     (matches handle_new_user trigger + import case-insensitive match)
 *   - Four flags emitted independently:
 *       all_top4_correct, all_relegated_correct, all_promoted_correct
 *       all_correct_overall (fires only when all 12 categories fully correct)
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PreSeasonPicks {
  top4: string[]
  tenth_place: string
  relegated: string[]
  promoted: string[]
  promoted_playoff_winner: string
}

export interface PreSeasonActuals {
  final_top4: string[]
  final_tenth: string
  final_relegated: string[]
  final_promoted: string[]
  final_playoff_winner: string
}

export interface PreSeasonFlags {
  all_top4_correct: boolean
  all_relegated_correct: boolean
  all_promoted_correct: boolean
  all_correct_overall: boolean
}

export interface PreSeasonScore {
  correctByCategory: {
    top4: number
    tenth: 0 | 1
    relegated: number
    promoted: number
    playoff_winner: 0 | 1
  }
  totalPoints: number
  flags: PreSeasonFlags
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Case-insensitive + whitespace-trimmed normalisation (project convention). */
function normalize(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase()
}

/** Count how many `picks` appear in `actuals` using set-membership (unordered). */
function countSetOverlap(picks: string[], actuals: string[]): number {
  const actualSet = new Set(actuals.map(normalize))
  // De-dupe picks to avoid double-counting if a member somehow submits duplicates.
  const seen = new Set<string>()
  let count = 0
  for (const pick of picks) {
    const key = normalize(pick)
    if (key.length === 0) continue
    if (seen.has(key)) continue
    seen.add(key)
    if (actualSet.has(key)) count += 1
  }
  return count
}

/** Strict single-value case-insensitive equality. */
function singleMatch(pick: string, actual: string): 0 | 1 {
  const p = normalize(pick)
  const a = normalize(actual)
  return p.length > 0 && p === a ? 1 : 0
}

// ─── Main ─────────────────────────────────────────────────────────────────────

/**
 * Score a member's pre-season picks against end-of-season actuals.
 * Pure — safe to call from any context (server action, admin recalc, tests).
 */
export function calculatePreSeasonPoints(
  picks: PreSeasonPicks,
  actuals: PreSeasonActuals,
): PreSeasonScore {
  const top4Correct = countSetOverlap(picks.top4, actuals.final_top4)
  const tenthCorrect = singleMatch(picks.tenth_place, actuals.final_tenth)
  const relegatedCorrect = countSetOverlap(picks.relegated, actuals.final_relegated)
  const promotedCorrect = countSetOverlap(picks.promoted, actuals.final_promoted)
  const playoffCorrect = singleMatch(
    picks.promoted_playoff_winner,
    actuals.final_playoff_winner,
  )

  const totalCorrect =
    top4Correct + tenthCorrect + relegatedCorrect + promotedCorrect + playoffCorrect

  const flags: PreSeasonFlags = {
    all_top4_correct: top4Correct === 4,
    all_relegated_correct: relegatedCorrect === 3,
    all_promoted_correct: promotedCorrect === 3,
    // all 12 picks across all 5 categories
    all_correct_overall: totalCorrect === 12,
  }

  return {
    correctByCategory: {
      top4: top4Correct,
      tenth: tenthCorrect,
      relegated: relegatedCorrect,
      promoted: promotedCorrect,
      playoff_winner: playoffCorrect,
    },
    totalPoints: totalCorrect * 30,
    flags,
  }
}
