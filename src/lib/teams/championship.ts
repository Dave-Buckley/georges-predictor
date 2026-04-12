/**
 * Championship team helpers — DB-backed (Phase 9 Plan 03).
 *
 * This file was previously a hardcoded array in
 * `src/lib/teams/championship-2025-26.ts`. That constant is preserved
 * there as a reference / seed source for migration 010 but is no longer
 * authoritative. The `championship_teams` table is now the source of
 * truth, editable by George from /admin/pre-season.
 *
 * Callers should `await isChampionshipTeam(name, season)`.
 *
 * Design: kept as a thin module-level export (matching Phase 1-8 helper
 * idiom) rather than a class. `createAdminClient()` reads with RLS admin
 * bypass, but the RLS policy on championship_teams grants SELECT to any
 * authenticated user anyway.
 */

import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Returns true if `name` matches a team in the Championship roster for
 * the given season. Case-insensitive + whitespace-trimmed (project
 * convention — matches handle_new_user trigger + calculatePreSeasonPoints).
 */
export async function isChampionshipTeam(
  name: string | null | undefined,
  season: number,
): Promise<boolean> {
  const norm = (name ?? '').trim().toLowerCase()
  if (!norm) return false

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('championship_teams')
    .select('name')
    .eq('season', season)
  if (error || !data) return false

  return (data as Array<{ name: string | null }>).some(
    (t) => (t.name ?? '').trim().toLowerCase() === norm,
  )
}

/**
 * Fetches the Championship roster for a season as a plain string array
 * (for use by pickers / validators where the ID isn't needed).
 */
export async function getChampionshipTeamNames(season: number): Promise<string[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('championship_teams')
    .select('name')
    .eq('season', season)
    .order('name', { ascending: true })
  if (error || !data) return []
  return (data as Array<{ name: string | null }>)
    .map((t) => t.name ?? '')
    .filter((n) => n.length > 0)
}
