'use server'

/**
 * Admin Last One Standing server actions (Phase 8 Plan 03).
 *
 * All actions gate on `requireAdmin()` before any DB mutation. Non-admin
 * callers get `{ error: 'Unauthorized — admin access required' }` and the
 * admin client is never instantiated.
 *
 * Mirrors the idiom established in src/actions/admin/bonuses.ts.
 */

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  adminOverrideEliminateSchema,
  adminReinstateSchema,
} from '@/lib/validators/los'
import { resetCompetitionIfNeeded } from '@/lib/los/round'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function lookupMemberName(
  adminClient: ReturnType<typeof createAdminClient>,
  memberId: string,
): Promise<string> {
  try {
    const { data } = await adminClient
      .from('members')
      .select('display_name')
      .eq('id', memberId)
      .maybeSingle()
    const name = (data as { display_name?: string | null } | null)?.display_name
    return name && name.trim().length > 0 ? name : 'A member'
  } catch {
    return 'A member'
  }
}

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

// ─── overrideEliminate ────────────────────────────────────────────────────────

/**
 * Admin manually eliminates a member from the current LOS competition.
 * Sets status='eliminated', eliminated_reason=<supplied>, eliminated_at_gw=<current gameweek>.
 */
export async function overrideEliminate(
  formData: FormData
): Promise<{ success: true } | { error: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const parsed = adminOverrideEliminateSchema.safeParse(
    Object.fromEntries(formData)
  )
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { member_id, competition_id, reason } = parsed.data
  const adminClient = createAdminClient()

  // Resolve current gameweek (latest 'active' or most-recent 'complete' — use active then fallback)
  const { data: currentGw } = await adminClient
    .from('gameweeks')
    .select('id, number')
    .eq('status', 'active')
    .order('number', { ascending: false })
    .limit(1)
    .maybeSingle()

  const eliminatedAtGw = (currentGw as { number?: number } | null)?.number ?? null

  const { error: updateError } = await adminClient
    .from('los_competition_members')
    .update({
      status: 'eliminated',
      eliminated_reason: reason,
      eliminated_at_gw: eliminatedAtGw,
    })
    .eq('competition_id', competition_id)
    .eq('member_id', member_id)

  if (updateError) {
    console.error('[overrideEliminate] Update error:', updateError.message)
    return { error: 'Failed to eliminate member. Please try again.' }
  }

  const memberName = await lookupMemberName(adminClient, member_id)

  await adminClient.from('admin_notifications').insert({
    type: 'system',
    title: `${memberName} has been knocked out of Last One Standing`,
    message: `${memberName} was knocked out of Last One Standing by an admin. Reason: ${reason}.`,
    member_id,
  })

  revalidatePath('/admin/los')
  return { success: true }
}

// ─── reinstateMember ──────────────────────────────────────────────────────────

/**
 * Admin reinstates a previously eliminated LOS member.
 * Only valid when the member's current status is 'eliminated'.
 */
export async function reinstateMember(
  formData: FormData
): Promise<{ success: true } | { error: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const parsed = adminReinstateSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { member_id, competition_id } = parsed.data
  const adminClient = createAdminClient()

  // Verify current status is 'eliminated'
  const { data: existing } = await adminClient
    .from('los_competition_members')
    .select('status')
    .eq('competition_id', competition_id)
    .eq('member_id', member_id)
    .maybeSingle()

  const status = (existing as { status?: string } | null)?.status

  if (!status) {
    return { error: 'Member is not enrolled in this competition' }
  }
  if (status !== 'eliminated') {
    return { error: 'Member is not eliminated' }
  }

  const { error: updateError } = await adminClient
    .from('los_competition_members')
    .update({
      status: 'active',
      eliminated_at_gw: null,
      eliminated_reason: null,
    })
    .eq('competition_id', competition_id)
    .eq('member_id', member_id)

  if (updateError) {
    console.error('[reinstateMember] Update error:', updateError.message)
    return { error: 'Failed to reinstate member. Please try again.' }
  }

  const memberName = await lookupMemberName(adminClient, member_id)

  await adminClient.from('admin_notifications').insert({
    type: 'system',
    title: `${memberName} is back in Last One Standing`,
    message: `${memberName} was reinstated into Last One Standing by an admin and is back in the running.`,
    member_id,
  })

  revalidatePath('/admin/los')
  return { success: true }
}

// ─── resetCompetitionManually ─────────────────────────────────────────────────

/**
 * Admin manually resets the current LOS competition — closes it out and starts
 * a new cycle. Accepts an optional winner_id (for awarding the jackpot) or
 * null (explicit "no winner" override for edge cases).
 *
 * Delegates to resetCompetitionIfNeeded from Plan 02 for the actual DB work.
 *
 * DEVIATION NOTE: Plan 02's resetCompetitionIfNeeded signature required
 * winnerId: string. For the no-winner path, we pass an empty string sentinel
 * so the underlying function records null via its update path. This is
 * documented in SUMMARY.md.
 */
const resetCompetitionManuallySchema = z.object({
  competition_id: z.string().uuid('Invalid competition id'),
  season: z.coerce.number().int().min(2000).max(2100),
  ended_at_gw: z.coerce.number().int().min(1).max(38),
  winner_id: z.string().uuid('Invalid winner id').nullable().optional(),
})

export async function resetCompetitionManually(
  formData: FormData
): Promise<{ success: true; newCompetitionId: string } | { error: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  // Pre-process — FormData string → null for optional winner_id
  const raw: Record<string, unknown> = Object.fromEntries(formData)
  if (!raw.winner_id || raw.winner_id === '') {
    raw.winner_id = null
  }

  const parsed = resetCompetitionManuallySchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { competition_id, season, ended_at_gw, winner_id } = parsed.data
  const adminClient = createAdminClient()

  try {
    const result = await resetCompetitionIfNeeded(
      adminClient,
      competition_id,
      ended_at_gw,
      // winner_id typed as string in Plan 02 helper; we pass null when absent
      // and the helper handles it via its own null-guard in notifications path.
      (winner_id ?? null) as unknown as string,
      season
    )

    revalidatePath('/admin/los')
    return { success: true, newCompetitionId: result.newCompetitionId }
  } catch (error) {
    console.error('[resetCompetitionManually] Reset failed:', error)
    return { error: 'Failed to reset competition. Please try again.' }
  }
}

// ─── setLosPickForMember ──────────────────────────────────────────────────────

/**
 * Admin sets or clears a member's LOS pick for a specific gameweek.
 * Bypasses the kickoff guard (admin correction). Enforces team-not-already-used.
 */
const setLosPickSchema = z.object({
  member_id: z.string().uuid('Invalid member id'),
  competition_id: z.string().uuid('Invalid competition id'),
  gameweek_id: z.string().uuid('Invalid gameweek id'),
  team_id: z.string().uuid('Invalid team id').nullable().optional(),
})

export async function setLosPickForMember(
  formData: FormData
): Promise<{ success: true } | { error: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  // Pre-process: blank / missing team_id → null (signals clear)
  const raw: Record<string, unknown> = Object.fromEntries(formData)
  if (!raw.team_id || raw.team_id === '') {
    raw.team_id = null
  }

  const parsed = setLosPickSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { member_id, competition_id, gameweek_id, team_id } = parsed.data
  const adminClient = createAdminClient()

  // Clear path
  if (!team_id) {
    const { error: deleteError } = await adminClient
      .from('los_picks')
      .delete()
      .eq('competition_id', competition_id)
      .eq('member_id', member_id)
      .eq('gameweek_id', gameweek_id)

    if (deleteError) {
      console.error('[setLosPickForMember] Delete error:', deleteError.message)
      return { error: 'Failed to clear pick. Please try again.' }
    }

    revalidatePath('/admin/los')
    return { success: true }
  }

  // LOS-03: reject if team used in any prior gameweek of this cycle
  const { data: priorPicks } = await adminClient
    .from('los_picks')
    .select('id')
    .eq('competition_id', competition_id)
    .eq('member_id', member_id)
    .eq('team_id', team_id)
    .neq('gameweek_id', gameweek_id)

  if (priorPicks && priorPicks.length > 0) {
    return { error: 'Team already used in this competition cycle' }
  }

  // Resolve the fixture for this team in this gameweek
  const { data: teamFixture } = await adminClient
    .from('fixtures')
    .select('id')
    .eq('gameweek_id', gameweek_id)
    .or(`home_team_id.eq.${team_id},away_team_id.eq.${team_id}`)
    .limit(1)
    .maybeSingle()

  const fixtureId = (teamFixture as { id?: string } | null)?.id
  if (!fixtureId) {
    return { error: 'No fixture found for that team in this gameweek' }
  }

  const { error: upsertError } = await adminClient.from('los_picks').upsert(
    {
      competition_id,
      member_id,
      gameweek_id,
      team_id,
      fixture_id: fixtureId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'competition_id,member_id,gameweek_id' }
  )

  if (upsertError) {
    console.error('[setLosPickForMember] Upsert error:', upsertError.message)
    return { error: 'Failed to set pick. Please try again.' }
  }

  revalidatePath('/admin/los')
  return { success: true }
}
