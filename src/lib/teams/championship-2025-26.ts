/**
 * Hardcoded list of Championship teams for the 2025-26 season.
 *
 * Source-list for the pre-season "promoted" + "promoted playoff winner" picks.
 * Championship teams are not in the `teams` table (which tracks PL teams only),
 * so this constant is the single source of truth for validation.
 *
 * When a new Championship season begins, the developer replaces this file
 * with the new 24-team list before the pre-season submission window opens.
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
