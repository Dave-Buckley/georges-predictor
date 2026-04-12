/**
 * Pre-season export row helper.
 *
 * Consumed by Plan 03 (admin export hook) — returns one row per (member, season)
 * flattened across pre_season_picks + members + pre_season_awards.
 *
 * Design:
 *   - Picks are joined with the member's display_name via Supabase FK embed.
 *   - Awards are fetched separately and map-merged — keeps the query simple
 *     and tolerates the common case where a pick exists but no award has
 *     been written yet (calculated_points / awarded_points → null).
 */

import { createAdminClient } from '@/lib/supabase/admin'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PreSeasonExportRow {
  member_id: string
  member_name: string
  season: number
  top4: string[]
  tenth_place: string
  relegated: string[]
  promoted: string[]
  promoted_playoff_winner: string
  /** Null when no pre_season_awards row exists yet (calc hasn't run). */
  calculated_points: number | null
  /** Null when no pre_season_awards row exists yet. */
  awarded_points: number | null
  confirmed: boolean
  submitted_by_admin: boolean
  submitted_at: string | null
}

// ─── Internal shapes (Supabase embed types are loose — typed locally) ────────

interface PickRow {
  member_id: string
  season: number
  top4: string[] | null
  tenth_place: string | null
  relegated: string[] | null
  promoted: string[] | null
  promoted_playoff_winner: string | null
  submitted_by_admin: boolean | null
  submitted_at: string | null
  members:
    | { id: string; display_name: string }
    | { id: string; display_name: string }[]
    | null
}

interface AwardRow {
  member_id: string
  season: number
  calculated_points: number
  awarded_points: number
  confirmed: boolean
}

// ─── Main ─────────────────────────────────────────────────────────────────────

/**
 * Returns a flat list of export rows for the given season.
 * Shape is stable for Plan 03's XLSX/CSV export layer.
 */
export async function getPreSeasonExportRows(
  season: number,
): Promise<PreSeasonExportRow[]> {
  const client = createAdminClient()

  const { data: picks, error: picksError } = await client
    .from('pre_season_picks')
    .select(
      'member_id, season, top4, tenth_place, relegated, promoted, promoted_playoff_winner, submitted_by_admin, submitted_at, members:members(id, display_name)',
    )
    .eq('season', season)

  if (picksError || !picks) return []

  const { data: awards } = await client
    .from('pre_season_awards')
    .select('member_id, season, calculated_points, awarded_points, confirmed')
    .eq('season', season)

  const awardByMember = new Map<string, AwardRow>()
  for (const a of (awards ?? []) as AwardRow[]) {
    awardByMember.set(a.member_id, a)
  }

  const rows: PreSeasonExportRow[] = []
  for (const p of picks as PickRow[]) {
    const memberRel = Array.isArray(p.members) ? p.members[0] : p.members
    const award = awardByMember.get(p.member_id) ?? null
    rows.push({
      member_id: p.member_id,
      member_name: memberRel?.display_name ?? 'Unknown',
      season: p.season,
      top4: p.top4 ?? [],
      tenth_place: p.tenth_place ?? '',
      relegated: p.relegated ?? [],
      promoted: p.promoted ?? [],
      promoted_playoff_winner: p.promoted_playoff_winner ?? '',
      calculated_points: award?.calculated_points ?? null,
      awarded_points: award?.awarded_points ?? null,
      confirmed: award?.confirmed ?? false,
      submitted_by_admin: p.submitted_by_admin ?? false,
      submitted_at: p.submitted_at,
    })
  }
  return rows
}
