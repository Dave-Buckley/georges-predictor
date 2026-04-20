'use server'

/**
 * Admin pre-season server actions (Phase 9 Plan 02).
 *
 * setPreSeasonPicksForMember: George enters pre-season picks on behalf of a
 * late-joiner member, bypassing the gw1_kickoff lockout (admin override —
 * matches editFixture admin_override pattern from Phase 2).
 *
 * Plan 03 extends this file with confirmPreSeasonAward + calculate actions.
 */

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  setPreSeasonPicksForMemberSchema,
  seasonActualsSchema,
  confirmPreSeasonAwardSchema,
} from '@/lib/validators/pre-season'
import { isChampionshipTeam } from '@/lib/teams/championship'
import { calculatePreSeasonPoints } from '@/lib/pre-season/calculate'

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

// ─── setPreSeasonPicksForMember ───────────────────────────────────────────────

export async function setPreSeasonPicksForMember(formData: FormData): Promise<Result> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const payloadRaw = formData.get('payload')
  if (typeof payloadRaw !== 'string') return { error: 'Invalid payload' }
  let payload: unknown
  try {
    payload = JSON.parse(payloadRaw)
  } catch {
    return { error: 'Invalid JSON' }
  }

  const parsed = setPreSeasonPicksForMemberSchema.safeParse(payload)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }
  const {
    member_id,
    season,
    top4,
    tenth_place,
    relegated,
    promoted,
    promoted_playoff_winner,
  } = parsed.data

  // Source-list + duplicate validation (same logic as member action)
  const admin = createAdminClient()
  const { data: plTeams } = await admin.from('teams').select('name')
  const plSet = new Set(
    ((plTeams as Array<{ name: string | null }> | null) ?? []).map((t) =>
      (t.name ?? '').trim().toLowerCase(),
    ),
  )
  const isPL = (n: string) => plSet.has((n ?? '').trim().toLowerCase())
  const norm = (s: string) => (s ?? '').trim().toLowerCase()

  for (const t of [...top4, tenth_place, ...relegated]) {
    if (!isPL(t)) return { error: `'${t}' is not a Premier League team` }
  }
  for (const t of [...promoted, promoted_playoff_winner]) {
    if (!(await isChampionshipTeam(t, season)))
      return { error: `'${t}' is not a Championship team` }
  }

  const checkUnique = (arr: string[], label: string): string | null => {
    if (new Set(arr.map(norm)).size !== arr.length) {
      return `Duplicate team in ${label}`
    }
    return null
  }
  const dupErr =
    checkUnique(top4, 'top 4') ??
    checkUnique(relegated, 'relegated') ??
    checkUnique(promoted, 'promoted')
  if (dupErr) return { error: dupErr }

  const top4Set = new Set(top4.map(norm))
  if (relegated.some((t) => top4Set.has(norm(t)))) {
    return { error: 'A team cannot be both in the top 4 and relegated' }
  }

  // NO LOCKOUT CHECK — admin override by design
  const nowIso = new Date().toISOString()
  const { error: upsertErr } = await admin.from('pre_season_picks').upsert(
    {
      member_id,
      season,
      top4,
      tenth_place,
      relegated,
      promoted,
      promoted_playoff_winner,
      submitted_by_admin: true,
      submitted_at: nowIso,
      imported_by: auth.userId,
      imported_at: nowIso,
    },
    { onConflict: 'member_id,season' },
  )
  if (upsertErr) return { error: upsertErr.message }

  revalidatePath('/admin/pre-season')
  return { success: true }
}

// ─── setSeasonActuals ─────────────────────────────────────────────────────────

/**
 * Admin enters end-of-season actuals (final_top4/tenth/relegated/promoted/playoff).
 * Sets actuals_locked_at=now() so calculatePreSeasonAwards becomes available.
 * Can be called multiple times (UPDATE with idempotent semantics).
 */
export async function setSeasonActuals(formData: FormData): Promise<Result> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const payloadRaw = formData.get('payload')
  if (typeof payloadRaw !== 'string') return { error: 'Invalid payload' }
  let payload: unknown
  try {
    payload = JSON.parse(payloadRaw)
  } catch {
    return { error: 'Invalid JSON' }
  }

  const parsed = seasonActualsSchema.safeParse(payload)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const {
    season,
    final_top4,
    final_tenth,
    final_relegated,
    final_promoted,
    final_playoff_winner,
  } = parsed.data

  const admin = createAdminClient()
  const nowIso = new Date().toISOString()

  const { error: updateErr } = await admin
    .from('seasons')
    .update({
      final_top4,
      final_tenth,
      final_relegated,
      final_promoted,
      final_playoff_winner,
      actuals_locked_at: nowIso,
    })
    .eq('season', season)

  if (updateErr) return { error: updateErr.message }

  revalidatePath('/admin/pre-season')
  return { success: true }
}

// ─── calculatePreSeasonAwards ─────────────────────────────────────────────────

interface CalcSuccess {
  success: true
  awardsCreated: number
  flagsEmitted: { all_correct: number; category: number }
}

interface PickDbRow {
  member_id: string
  season: number
  top4: string[] | null
  tenth_place: string | null
  relegated: string[] | null
  promoted: string[] | null
  promoted_playoff_winner: string | null
}

/**
 * Iterates all members with pre_season_picks for the season, invokes
 * calculatePreSeasonPoints, upserts pre_season_awards rows (confirmed=false
 * for new rows; already-confirmed rows keep their confirmed + awarded_points).
 * Emits admin_notifications for all-correct + category-correct flags
 * (failures wrapped in try/catch — do not fail the calc). Idempotent.
 */
export async function calculatePreSeasonAwards(
  formData: FormData,
): Promise<CalcSuccess | { error: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const season = Number(formData.get('season'))
  if (!Number.isInteger(season)) return { error: 'Invalid season' }

  const admin = createAdminClient()

  // Fetch season row; gate on actuals_locked_at
  const { data: seasonRow } = await admin
    .from('seasons')
    .select('*')
    .eq('season', season)
    .single()

  const sr = seasonRow as
    | {
        season: number
        final_top4: string[]
        final_tenth: string | null
        final_relegated: string[]
        final_promoted: string[]
        final_playoff_winner: string | null
        actuals_locked_at: string | null
      }
    | null

  if (!sr || !sr.actuals_locked_at) {
    return { error: 'Season-end actuals are not locked yet' }
  }

  const actuals = {
    final_top4: sr.final_top4 ?? [],
    final_tenth: sr.final_tenth ?? '',
    final_relegated: sr.final_relegated ?? [],
    final_promoted: sr.final_promoted ?? [],
    final_playoff_winner: sr.final_playoff_winner ?? '',
  }

  // Fetch all picks for this season
  const { data: picksData } = await admin
    .from('pre_season_picks')
    .select(
      'member_id, season, top4, tenth_place, relegated, promoted, promoted_playoff_winner',
    )
    .eq('season', season)

  const picks = (picksData as PickDbRow[] | null) ?? []

  // Resolve member display names upfront so notifications can use friendly
  // names instead of raw UUIDs. Wrapped in try/catch so a lookup failure
  // (or stubbed test client) never breaks the calc.
  const memberIds = picks.map((p) => p.member_id)
  const memberNameById = new Map<string, string>()
  try {
    const { data: memberRows } = await admin
      .from('members')
      .select('id, display_name')
      .in('id', memberIds)
    for (const row of ((memberRows ?? []) as Array<{ id: string; display_name: string | null }>)) {
      const name = (row.display_name ?? '').trim()
      memberNameById.set(row.id, name || 'A member')
    }
  } catch {
    /* fall through — notifications will use the generic "A member" fallback */
  }

  let flagsAllCorrect = 0
  let flagsCategory = 0

  for (const row of picks) {
    const score = calculatePreSeasonPoints(
      {
        top4: row.top4 ?? [],
        tenth_place: row.tenth_place ?? '',
        relegated: row.relegated ?? [],
        promoted: row.promoted ?? [],
        promoted_playoff_winner: row.promoted_playoff_winner ?? '',
      },
      actuals,
    )

    // Check for existing award — preserve confirmed + awarded_points if confirmed
    const { data: existingRaw } = await admin
      .from('pre_season_awards')
      .select('confirmed')
      .eq('member_id', row.member_id)
      .eq('season', season)
      .maybeSingle()
    const existing = existingRaw as { confirmed: boolean } | null
    const preserveConfirmed = existing?.confirmed === true

    // Build upsert payload — omit awarded_points + confirmed fields when preserving
    const upsertPayload: Record<string, unknown> = {
      member_id: row.member_id,
      season,
      calculated_points: score.totalPoints,
      flags: score.flags,
    }
    if (!preserveConfirmed) {
      upsertPayload.awarded_points = score.totalPoints
      upsertPayload.confirmed = false
      upsertPayload.confirmed_by = null
      upsertPayload.confirmed_at = null
    }

    await admin
      .from('pre_season_awards')
      .upsert(upsertPayload, { onConflict: 'member_id,season' })

    // Emit notifications (Pattern 5 — failures swallowed)
    const memberName = memberNameById.get(row.member_id) ?? 'A member'
    try {
      if (score.flags.all_correct_overall) {
        await admin.from('admin_notifications').insert({
          type: 'pre_season_all_correct',
          title: `${memberName} got every pre-season pick right!`,
          message: `${memberName} got all 12 pre-season predictions correct for the ${season} season. That's a clean sweep.`,
          member_id: row.member_id,
        })
        flagsAllCorrect++
      } else {
        const cats: string[] = []
        if (score.flags.all_top4_correct) cats.push('top 4')
        if (score.flags.all_relegated_correct) cats.push('relegated teams')
        if (score.flags.all_promoted_correct) cats.push('promoted teams')
        if (cats.length) {
          const catsList =
            cats.length === 1
              ? cats[0]
              : cats.length === 2
                ? `${cats[0]} and ${cats[1]}`
                : `${cats.slice(0, -1).join(', ')} and ${cats[cats.length - 1]}`
          await admin.from('admin_notifications').insert({
            type: 'pre_season_category_correct',
            title: `${memberName} got a pre-season category 100% correct`,
            message: `${memberName} got every pick right in the ${catsList} category for the ${season} season.`,
            member_id: row.member_id,
          })
          flagsCategory++
        }
      }
    } catch {
      /* notification failure does not fail calc */
    }
  }

  // Single "awards_ready" notification
  try {
    await admin.from('admin_notifications').insert({
      type: 'pre_season_awards_ready',
      title: `Pre-season scores are ready for George to review`,
      message: `The pre-season points for the ${season} season have been worked out — ${picks.length} member${picks.length !== 1 ? 's' : ''} ready for George to confirm.`,
    })
  } catch {
    /* noop */
  }

  revalidatePath('/admin/pre-season')
  return {
    success: true,
    awardsCreated: picks.length,
    flagsEmitted: { all_correct: flagsAllCorrect, category: flagsCategory },
  }
}

// ─── confirmPreSeasonAward ────────────────────────────────────────────────────

/**
 * Confirms a single member's pre-season award. Override points optional —
 * defaults to calculated_points. Idempotent (upsert).
 */
export async function confirmPreSeasonAward(formData: FormData): Promise<Result> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const parsed = confirmPreSeasonAwardSchema.safeParse(
    Object.fromEntries(formData.entries()),
  )
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }
  const { member_id, season, override_points } = parsed.data

  const admin = createAdminClient()
  const { data: existingRaw } = await admin
    .from('pre_season_awards')
    .select('calculated_points')
    .eq('member_id', member_id)
    .eq('season', season)
    .maybeSingle()
  const existing = existingRaw as { calculated_points: number } | null
  if (!existing) {
    return { error: 'No calculated award found — run calculation first' }
  }

  const awarded = override_points ?? existing.calculated_points

  const { error: upsertErr } = await admin.from('pre_season_awards').upsert(
    {
      member_id,
      season,
      awarded_points: awarded,
      confirmed: true,
      confirmed_by: auth.userId,
      confirmed_at: new Date().toISOString(),
    },
    { onConflict: 'member_id,season' },
  )
  if (upsertErr) return { error: upsertErr.message }

  revalidatePath('/admin/pre-season')
  return { success: true }
}

// ─── bulkConfirmPreSeasonAwards ───────────────────────────────────────────────

interface BulkSuccess {
  success: true
  confirmedCount: number
}

/**
 * Confirms every unconfirmed pre_season_awards row for the given season,
 * using each row's calculated_points as awarded_points. Idempotent —
 * already-confirmed rows are skipped (filtered at the SQL level via
 * .eq('confirmed', false)).
 */
export async function bulkConfirmPreSeasonAwards(
  formData: FormData,
): Promise<BulkSuccess | { error: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const season = Number(formData.get('season'))
  if (!Number.isInteger(season)) return { error: 'Invalid season' }

  const admin = createAdminClient()
  const { data: pendingRaw } = await admin
    .from('pre_season_awards')
    .select('member_id, calculated_points')
    .eq('season', season)
    .eq('confirmed', false)

  const pending =
    (pendingRaw as Array<{ member_id: string; calculated_points: number }> | null) ?? []

  let confirmedCount = 0
  const nowIso = new Date().toISOString()
  for (const row of pending) {
    const { error } = await admin
      .from('pre_season_awards')
      .update({
        awarded_points: row.calculated_points,
        confirmed: true,
        confirmed_by: auth.userId,
        confirmed_at: nowIso,
      })
      .eq('member_id', row.member_id)
      .eq('season', season)
    if (!error) confirmedCount++
  }

  revalidatePath('/admin/pre-season')
  return { success: true, confirmedCount }
}
