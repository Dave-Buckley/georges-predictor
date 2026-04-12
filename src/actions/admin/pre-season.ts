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
import { setPreSeasonPicksForMemberSchema } from '@/lib/validators/pre-season'
import { isChampionshipTeam } from '@/lib/teams/championship-2025-26'

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
    if (!isChampionshipTeam(t)) return { error: `'${t}' is not a Championship team` }
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
