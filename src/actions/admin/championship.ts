'use server'

/**
 * DB-backed Championship team management + end-of-season rollover
 * (Phase 9 Plan 03).
 *
 * Replaces the hardcoded CHAMPIONSHIP_TEAMS_2025_26 constant with a DB table
 * George manages from /admin/pre-season. One-button rollover at season end
 * swaps the 3 relegated PL teams and 3 promoted Championship teams between
 * `teams` and `championship_teams`, using the season-end actuals already
 * entered by George.
 *
 * All actions mirror the admin-action idiom from Phase 5 (bonuses):
 *   - requireAdmin() guard
 *   - Zod input parse (inline where lightweight)
 *   - createAdminClient() for DB ops
 *   - revalidatePath('/admin/pre-season')
 */

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'

type Result = { success: true } | { error: string }

// ─── Admin Auth Guard ─────────────────────────────────────────────────────────

async function requireAdmin(): Promise<{ userId: string } | { error: string }> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user || user.app_metadata?.role !== 'admin') {
    return { error: 'Unauthorized — admin access required' }
  }

  return { userId: user.id }
}

// ─── getChampionshipTeams ─────────────────────────────────────────────────────

export interface ChampionshipTeamRow {
  id: string
  name: string
}

/**
 * Returns the Championship team roster for a season, sorted alphabetically.
 * Uses the admin client (session client would also work since RLS grants
 * SELECT to authenticated users, but admin client is consistent with other
 * pre-season helpers).
 */
export async function getChampionshipTeams(
  season: number,
): Promise<ChampionshipTeamRow[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('championship_teams')
    .select('id, name')
    .eq('season', season)
    .order('name', { ascending: true })

  if (error || !data) return []
  return data as ChampionshipTeamRow[]
}

// ─── addChampionshipTeam ──────────────────────────────────────────────────────

export async function addChampionshipTeam(formData: FormData): Promise<Result> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const nameRaw = formData.get('name')
  const seasonRaw = formData.get('season')
  if (typeof nameRaw !== 'string' || typeof seasonRaw !== 'string') {
    return { error: 'Invalid input' }
  }
  const name = nameRaw.trim()
  const season = Number(seasonRaw)
  if (!name) return { error: 'Team name is required' }
  if (!Number.isInteger(season)) return { error: 'Invalid season' }

  const admin = createAdminClient()

  // Case-insensitive duplicate check (DB also enforces via unique index but
  // we short-circuit for a clearer error message).
  const { data: existing } = await admin
    .from('championship_teams')
    .select('id, name')
    .eq('season', season)
  const dup = ((existing as Array<{ name: string }> | null) ?? []).some(
    (t) => t.name.trim().toLowerCase() === name.toLowerCase(),
  )
  if (dup) return { error: `'${name}' is already in the Championship list` }

  const { error } = await admin
    .from('championship_teams')
    .insert({ season, name })
  if (error) return { error: error.message }

  revalidatePath('/admin/pre-season')
  return { success: true }
}

// ─── removeChampionshipTeam ───────────────────────────────────────────────────

export async function removeChampionshipTeam(
  formData: FormData,
): Promise<Result> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const id = formData.get('id')
  if (typeof id !== 'string' || !id) return { error: 'Invalid id' }

  const admin = createAdminClient()
  const { error } = await admin.from('championship_teams').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/admin/pre-season')
  return { success: true }
}

// ─── renameChampionshipTeam ───────────────────────────────────────────────────

export async function renameChampionshipTeam(
  formData: FormData,
): Promise<Result> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const id = formData.get('id')
  const nameRaw = formData.get('name')
  if (typeof id !== 'string' || !id) return { error: 'Invalid id' }
  if (typeof nameRaw !== 'string') return { error: 'Invalid name' }
  const name = nameRaw.trim()
  if (!name) return { error: 'Team name is required' }

  const admin = createAdminClient()

  // Fetch current row so we can report nice errors + detect no-op renames.
  const { data: current } = await admin
    .from('championship_teams')
    .select('id, season, name')
    .eq('id', id)
    .single()
  if (!current) return { error: 'Team not found' }

  const { error } = await admin
    .from('championship_teams')
    .update({ name })
    .eq('id', id)
  if (error) {
    // Postgres unique violation on the case-insensitive index
    if (
      error.code === '23505' ||
      /duplicate|already exists/i.test(error.message)
    ) {
      return { error: `'${name}' is already in the Championship list` }
    }
    return { error: error.message }
  }

  revalidatePath('/admin/pre-season')
  return { success: true }
}

// ─── endOfSeasonRollover ──────────────────────────────────────────────────────

/**
 * Swaps the 3 relegated PL teams and 3 promoted Championship teams between
 * `teams` and `championship_teams` based on the fromSeason's locked actuals.
 *
 * Rollover flow:
 *   1. Read seasons[fromSeason] — require actuals_locked_at
 *   2. Sanity check: all 3 final_relegated must currently be in `teams`
 *   3. Sanity check: all 3 final_promoted must currently be in
 *      championship_teams (season = fromSeason)
 *   4. Delete the 3 relegated PL rows from `teams`
 *   5. Insert the 3 relegated team names into championship_teams at
 *      season = fromSeason + 1
 *   6. Delete the 3 promoted championship_teams rows
 *   7. Insert the 3 promoted team names into `teams` (plain {name}; badge
 *      metadata will hydrate on next fixture sync)
 *   8. Write an admin_notifications type='system' audit entry
 *
 * Idempotency: re-running the same rollover after it has already been
 * applied will fail step 2 or 3 (teams are no longer where we expect them).
 * That's acceptable — we return a safe error rather than double-applying.
 */
export async function endOfSeasonRollover(formData: FormData): Promise<Result> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const fromSeason = Number(formData.get('from_season'))
  if (!Number.isInteger(fromSeason)) return { error: 'Invalid from_season' }

  const admin = createAdminClient()

  // 1. Fetch season row + actuals
  const { data: seasonRowRaw } = await admin
    .from('seasons')
    .select('*')
    .eq('season', fromSeason)
    .single()
  const seasonRow = seasonRowRaw as
    | {
        season: number
        final_relegated: string[]
        final_promoted: string[]
        actuals_locked_at: string | null
      }
    | null

  if (!seasonRow || !seasonRow.actuals_locked_at) {
    return { error: 'Season-end actuals are not locked yet' }
  }

  const relegated = seasonRow.final_relegated ?? []
  const promoted = seasonRow.final_promoted ?? []

  if (relegated.length !== 3) {
    return { error: `Expected 3 relegated teams, got ${relegated.length}` }
  }
  if (promoted.length !== 3) {
    return { error: `Expected 3 promoted teams, got ${promoted.length}` }
  }

  // 2. Sanity check: all relegated names exist in `teams`
  const { data: plRowsRaw } = await admin
    .from('teams')
    .select('id, name')
    .in('name', relegated)
  const plRows = (plRowsRaw as Array<{ id: string; name: string }> | null) ?? []
  if (plRows.length !== 3) {
    const found = plRows.map((r) => r.name)
    const missing = relegated.filter((n) => !found.includes(n))
    return {
      error: `Could not find these relegated teams in Premier League teams: ${missing.join(', ')}`,
    }
  }

  // 3. Sanity check: all promoted names exist in championship_teams at fromSeason
  const { data: chRowsRaw } = await admin
    .from('championship_teams')
    .select('id, name')
    .eq('season', fromSeason)
    .in('name', promoted)
  const chRows = (chRowsRaw as Array<{ id: string; name: string }> | null) ?? []
  if (chRows.length !== 3) {
    const found = chRows.map((r) => r.name)
    const missing = promoted.filter((n) => !found.includes(n))
    return {
      error: `Could not find these promoted teams in Championship (season ${fromSeason}): ${missing.join(', ')}`,
    }
  }

  // 4. Delete relegated rows from PL teams
  for (const row of plRows) {
    const { error } = await admin.from('teams').delete().eq('id', row.id)
    if (error) return { error: `Failed to remove ${row.name} from PL: ${error.message}` }
  }

  // 5. Insert relegated names into championship_teams at fromSeason+1
  for (const name of relegated) {
    const { error } = await admin
      .from('championship_teams')
      .insert({ season: fromSeason + 1, name })
    if (error) {
      return {
        error: `Failed to add ${name} to Championship ${fromSeason + 1}: ${error.message}`,
      }
    }
  }

  // 6. Delete promoted rows from championship_teams
  for (const row of chRows) {
    const { error } = await admin
      .from('championship_teams')
      .delete()
      .eq('id', row.id)
    if (error) {
      return { error: `Failed to remove ${row.name} from Championship: ${error.message}` }
    }
  }

  // 7. Insert promoted names into PL teams (fixture sync will hydrate crest, tla, etc.)
  for (const name of promoted) {
    const { error } = await admin.from('teams').insert({ name })
    if (error) {
      return { error: `Failed to add ${name} to Premier League: ${error.message}` }
    }
  }

  // 8. Audit notification (failures swallowed — rollover already succeeded)
  try {
    await admin.from('admin_notifications').insert({
      type: 'system',
      title: `Season ${fromSeason} rollover complete`,
      message: `Relegated to Championship ${fromSeason + 1}: ${relegated.join(', ')}. Promoted to Premier League: ${promoted.join(', ')}.`,
    })
  } catch {
    /* noop */
  }

  revalidatePath('/admin/pre-season')
  return { success: true }
}
