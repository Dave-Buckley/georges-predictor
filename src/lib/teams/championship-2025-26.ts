/**
 * Championship teams for the 2025-26 season.
 *
 * ⚠️ DEPRECATED as source of truth (Phase 9 Plan 03, 2026-04-12).
 *
 * The `championship_teams` table (migration 010) is now the authoritative
 * Championship roster. George manages it from /admin/pre-season; the
 * end-of-season rollover button swaps relegated / promoted teams automatically.
 *
 * This constant is preserved as:
 *   (a) the seed source for migration 010 (keep them in sync if you add teams)
 *   (b) an offline fallback for tests / edge cases that don't want a DB round-trip
 *
 * Callers should prefer the async `isChampionshipTeam(name, season)` helper
 * in `./championship.ts` which reads the DB.
 */

export const CHAMPIONSHIP_TEAMS_2025_26 = [
  'Birmingham City',
  'Blackburn Rovers',
  'Bristol City',
  'Charlton Athletic',
  'Coventry City',
  'Derby County',
  'Hull City',
  'Ipswich Town',
  'Leeds United',
  'Leicester City',
  'Middlesbrough',
  'Millwall',
  'Norwich City',
  'Oxford United',
  'Portsmouth',
  'Preston North End',
  'Queens Park Rangers',
  'Sheffield United',
  'Sheffield Wednesday',
  'Southampton',
  'Stoke City',
  'Swansea City',
  'Watford',
  'West Bromwich Albion',
] as const

export type ChampionshipTeam2025_26 = (typeof CHAMPIONSHIP_TEAMS_2025_26)[number]

/**
 * Returns true if `name` matches a team in the 2025-26 Championship.
 * Case-insensitive + whitespace-trimmed — matches project convention
 * (handle_new_user trigger, calculatePreSeasonPoints).
 */
export function isChampionshipTeam(name: string | null | undefined): boolean {
  const norm = (name ?? '').trim().toLowerCase()
  if (norm.length === 0) return false
  return CHAMPIONSHIP_TEAMS_2025_26.some(
    (t) => t.trim().toLowerCase() === norm,
  )
}
