'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { adjustPointsSchema } from '@/lib/validators/admin'

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

interface CurrentTotalResult {
  currentTotal: number
  doubleBubble: boolean
  pointsApplied: boolean
}

/**
 * Returns the current display weekly total for a member in a gameweek —
 * predictions + confirmed bonuses (×2 if Double Bubble) + existing
 * adjustments. Used by the dialog to prefill the "new total" input.
 */
export async function getMemberGameweekTotal(
  memberId: string,
  gameweekId: string,
): Promise<CurrentTotalResult | { error: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const admin = createAdminClient()

  const [gwRes, fixturesRes, scoresRes, bonusesRes, adjustmentsRes] =
    await Promise.all([
      admin
        .from('gameweeks')
        .select('id, double_bubble, points_applied')
        .eq('id', gameweekId)
        .single(),
      admin.from('fixtures').select('id').eq('gameweek_id', gameweekId),
      admin
        .from('prediction_scores')
        .select('fixture_id, points_awarded')
        .eq('member_id', memberId),
      admin
        .from('bonus_awards')
        .select('points_awarded, awarded')
        .eq('member_id', memberId)
        .eq('gameweek_id', gameweekId)
        .eq('awarded', true),
      admin
        .from('point_adjustments')
        .select('delta')
        .eq('member_id', memberId)
        .eq('gameweek_id', gameweekId),
    ])

  if (gwRes.error || !gwRes.data) return { error: 'Gameweek not found' }

  const gw = gwRes.data as { double_bubble: boolean | null; points_applied: boolean }
  const fixtureIds = new Set(
    ((fixturesRes.data ?? []) as Array<{ id: string }>).map((f) => f.id),
  )

  let subtotal = 0
  for (const s of (scoresRes.data ?? []) as Array<{
    fixture_id: string
    points_awarded: number | null
  }>) {
    if (fixtureIds.has(s.fixture_id)) subtotal += s.points_awarded ?? 0
  }
  for (const b of (bonusesRes.data ?? []) as Array<{
    points_awarded: number | null
  }>) {
    subtotal += b.points_awarded ?? 0
  }

  if (gw.double_bubble) subtotal *= 2

  for (const a of (adjustmentsRes.data ?? []) as Array<{ delta: number | null }>) {
    subtotal += a.delta ?? 0
  }

  return {
    currentTotal: subtotal,
    doubleBubble: !!gw.double_bubble,
    pointsApplied: !!gw.points_applied,
  }
}

export async function getMemberOverallTotal(
  memberId: string,
): Promise<{ currentTotal: number } | { error: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('members')
    .select('starting_points')
    .eq('id', memberId)
    .single()

  if (error || !data) return { error: 'Member not found' }
  return { currentTotal: (data as { starting_points: number | null }).starting_points ?? 0 }
}

/**
 * Applies a manual point adjustment for a member.
 *
 *  • scope=gameweek — writes the delta (newTotal − currentDisplayTotal) to
 *    point_adjustments for that GW. If the GW is already points_applied,
 *    also bumps members.starting_points by the same delta so the public
 *    standings update immediately.
 *
 *  • scope=overall — writes the delta (newTotal − starting_points) to
 *    point_adjustments with gameweek_id = NULL for audit, and sets
 *    members.starting_points to newTotal.
 */
export async function adjustPoints(
  formData: FormData,
): Promise<{ success: true; delta: number } | { error: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const { userId } = auth

  const raw = {
    member_id: formData.get('member_id'),
    scope: formData.get('scope'),
    gameweek_id: formData.get('gameweek_id') || undefined,
    new_total: formData.get('new_total'),
    note: formData.get('note') || undefined,
  }

  const parsed = adjustPointsSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { member_id, scope, gameweek_id, new_total, note } = parsed.data
  const admin = createAdminClient()

  if (scope === 'overall') {
    const current = await getMemberOverallTotal(member_id)
    if ('error' in current) return current

    const delta = new_total - current.currentTotal
    if (delta === 0) return { success: true, delta: 0 }

    const { error: insertErr } = await admin.from('point_adjustments').insert({
      member_id,
      gameweek_id: null,
      delta,
      note: note ?? null,
      created_by: userId,
    })
    if (insertErr) return { error: insertErr.message }

    const { error: updateErr } = await admin
      .from('members')
      .update({ starting_points: Math.max(0, new_total) })
      .eq('id', member_id)
    if (updateErr) return { error: updateErr.message }

    revalidatePath('/standings')
    revalidatePath('/admin')
    revalidatePath('/dashboard')
    return { success: true, delta }
  }

  // scope === 'gameweek'
  const gwId = gameweek_id as string
  const current = await getMemberGameweekTotal(member_id, gwId)
  if ('error' in current) return current

  const delta = new_total - current.currentTotal
  if (delta === 0) return { success: true, delta: 0 }

  const { error: insertErr } = await admin.from('point_adjustments').insert({
    member_id,
    gameweek_id: gwId,
    delta,
    note: note ?? null,
    created_by: userId,
  })
  if (insertErr) return { error: insertErr.message }

  // If points already applied to starting_points, bump it so standings update.
  if (current.pointsApplied) {
    const { data: mRow } = await admin
      .from('members')
      .select('starting_points')
      .eq('id', member_id)
      .single()
    const curr = (mRow as { starting_points: number | null } | null)?.starting_points ?? 0
    const next = Math.max(0, curr + delta)
    const { error: updateErr } = await admin
      .from('members')
      .update({ starting_points: next })
      .eq('id', member_id)
    if (updateErr) return { error: updateErr.message }
  }

  revalidatePath('/standings')
  revalidatePath('/admin')
  revalidatePath(`/admin/gameweeks`)
  revalidatePath(`/gameweeks`)
  revalidatePath('/dashboard')
  return { success: true, delta }
}
