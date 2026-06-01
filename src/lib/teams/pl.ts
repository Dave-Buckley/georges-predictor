/**
 * Premier League team helpers — DB-backed, per-season.
 *
 * Mirrors `src/lib/teams/championship.ts` but for the `pl_teams` table
 * (migration 023). This is the source list for the pre-season picker
 * (top4, tenth-place, relegated picks) and replaces the old
 * "query the `teams` table" path.
 *
 * `teams` remains the source of truth for FIXTURE data (every match row
 * FKs into it). `pl_teams` is season-scoped so we can swap relegated /
 * promoted clubs without breaking historical fixture FKs.
 */

import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Returns true if `name` matches a team in the Premier League roster for
 * the given season. Case-insensitive + whitespace-trimmed.
 */
export async function isPremierLeagueTeam(
  name: string | null | undefined,
  season: number,
): Promise<boolean> {
  const norm = (name ?? '').trim().toLowerCase()
  if (!norm) return false

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('pl_teams')
    .select('name')
    .eq('season', season)
  if (error || !data) return false

  return (data as Array<{ name: string | null }>).some(
    (t) => (t.name ?? '').trim().toLowerCase() === norm,
  )
}

/**
 * Fetches the PL roster for a season as a plain alphabetised string array.
 */
export async function getPlTeamNames(season: number): Promise<string[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('pl_teams')
    .select('name')
    .eq('season', season)
    .order('name', { ascending: true })
  if (error || !data) return []
  return (data as Array<{ name: string | null }>)
    .map((t) => t.name ?? '')
    .filter((n) => n.length > 0)
}
