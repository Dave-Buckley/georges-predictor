'use server'

/**
 * Member pre-season server action (Phase 9 Plan 02).
 *
 * Submits the 12 pre-season picks (top 4, 10th, relegated, promoted, playoff winner)
 * for the upcoming season. Lockout is enforced server-side: when gw1_kickoff <= now()
 * the window is closed (admin can still override via setPreSeasonPicksForMember).
 *
 * Security:
 *   - member_id is resolved from auth.uid() via the `members` table — never
 *     trusted from the client (STATE.md Phase 3 decision).
 *   - createAdminClient used for DB reads/writes because pre_season_picks has
 *     admin-only write RLS (imports own placeholder rows).
 *
 * Source-list validation:
 *   - top4, tenth_place, relegated must be PL teams (from the `teams` table).
 *   - promoted, promoted_playoff_winner must be Championship teams
 *     (CHAMPIONSHIP_TEAMS_2025_26 constant).
 *   - Comparison is case-insensitive + trim.
 */

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { submitPreSeasonPicksSchema } from '@/lib/validators/pre-season'
import { getUpcomingSeason } from '@/lib/pre-season/seasons'
import { isChampionshipTeam } from '@/lib/teams/championship'

type Result = { success: true } | { error: string }

export async function submitPreSeasonPicks(formData: FormData): Promise<Result> {
  // 1. Auth
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()
  if (authErr || !user) return { error: 'Unauthorized' }

  // 2. Extract payload — client sends JSON.stringify(picks) in `payload`
  const payloadRaw = formData.get('payload')
  if (typeof payloadRaw !== 'string') return { error: 'Invalid payload' }
  let payload: unknown
  try {
    payload = JSON.parse(payloadRaw)
  } catch {
    return { error: 'Invalid JSON payload' }
  }

  // 3. Zod validate
  const parsed = submitPreSeasonPicksSchema.safeParse(payload)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }
  const { season, top4, tenth_place, relegated, promoted, promoted_playoff_winner } =
    parsed.data

  // 4. Lockout check — upcoming season must exist and GW1 must be in the future
  const upcoming = await getUpcomingSeason()
  if (!upcoming || upcoming.season !== season) {
    return { error: 'No upcoming pre-season window is open' }
  }
  if (new Date(upcoming.gw1_kickoff).getTime() <= Date.now()) {
    return { error: 'Pre-season predictions are locked — GW1 has begun' }
  }

  // 5. Resolve member_id server-side from auth.uid()
  const admin = createAdminClient()
  const { data: member } = await admin
    .from('members')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!member) return { error: 'Member profile not found' }

  // 6. Source-list validation
  const { data: plTeams } = await admin.from('teams').select('name')
  const plSet = new Set(
    ((plTeams as Array<{ name: string | null }> | null) ?? []).map((t) =>
      (t.name ?? '').trim().toLowerCase(),
    ),
  )
  const isPL = (n: string) => plSet.has((n ?? '').trim().toLowerCase())

  for (const t of [...top4, tenth_place, ...relegated]) {
    if (!isPL(t)) return { error: `'${t}' is not a Premier League team` }
  }
  for (const t of [...promoted, promoted_playoff_winner]) {
    if (!(await isChampionshipTeam(t, season)))
      return { error: `'${t}' is not a Championship team` }
  }

  // 7. Duplicate detection (case-insensitive)
  const norm = (s: string) => (s ?? '').trim().toLowerCase()
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

  // Cross-category: a team cannot be in top4 AND relegated
  const top4Set = new Set(top4.map(norm))
  if (relegated.some((t) => top4Set.has(norm(t)))) {
    return { error: 'A team cannot be both in the top 4 and relegated' }
  }

  // 8. Upsert
  const { error: upsertErr } = await admin.from('pre_season_picks').upsert(
    {
      member_id: (member as { id: string }).id,
      season,
      top4,
      tenth_place,
      relegated,
      promoted,
      promoted_playoff_winner,
      submitted_by_admin: false,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: 'member_id,season' },
  )
  if (upsertErr) return { error: upsertErr.message }

  revalidatePath('/pre-season')
  return { success: true }
}
