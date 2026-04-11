'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { confirmPrizeSchema, createPrizeSchema } from '@/lib/validators/prizes'

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

// ─── confirmPrize ─────────────────────────────────────────────────────────────

/**
 * Confirms or rejects a triggered prize award.
 *
 * 1. requireAdmin() guard
 * 2. Validates input with confirmPrizeSchema
 * 3. Fetches award + prize + member details (for notification title)
 * 4. UPDATE prize_awards: set status, confirmed_by, confirmed_at, notes
 * 5. If status='confirmed': INSERT admin_notification
 * 6. revalidatePath('/admin/prizes')
 */
export async function confirmPrize(
  formData: FormData
): Promise<{ success: true } | { error: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const raw = {
    award_id: formData.get('award_id'),
    status: formData.get('status'),
    notes: formData.get('notes') || undefined,
  }

  const parsed = confirmPrizeSchema.safeParse(raw)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Invalid input'
    return { error: firstError }
  }

  const { award_id, status, notes } = parsed.data
  const adminClient = createAdminClient()

  // Fetch award with prize and member details (for notification)
  const { data: award, error: fetchError } = await adminClient
    .from('prize_awards')
    .select(`
      id,
      prize_id,
      member_id,
      status,
      prize:additional_prizes!prize_id(name, emoji),
      member:members!member_id(id, display_name)
    `)
    .eq('id', award_id)
    .single()

  if (fetchError || !award) {
    return { error: 'Prize award not found' }
  }

  // Update the award status
  const { error: updateError } = await adminClient
    .from('prize_awards')
    .update({
      status,
      confirmed_by: auth.userId,
      confirmed_at: new Date().toISOString(),
      notes: notes ?? null,
    })
    .eq('id', award_id)

  if (updateError) {
    console.error('[confirmPrize] Update error:', updateError.message)
    return { error: 'Failed to update prize award. Please try again.' }
  }

  // Create admin notification only on confirmation
  if (status === 'confirmed') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prizeName = (award as any).prize?.name ?? 'Prize'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const memberName = (award as any).member?.display_name ?? 'Group'
    const prizeEmoji = (award as any).prize?.emoji ?? '' // eslint-disable-line @typescript-eslint/no-explicit-any

    await adminClient
      .from('admin_notifications')
      .insert({
        type: 'prize_triggered',
        title: `${prizeEmoji} ${prizeName} awarded to ${memberName}`.trim(),
        message: notes ?? null,
      })
      .then(({ error }) => {
        if (error) console.error('[confirmPrize] Notification error:', error.message)
      })
  }

  revalidatePath('/admin/prizes')
  return { success: true }
}

// ─── createPrize ──────────────────────────────────────────────────────────────

/**
 * Creates a new custom additional prize (mid-season).
 *
 * 1. requireAdmin() guard
 * 2. Validates input with createPrizeSchema
 * 3. INSERT additional_prizes with is_custom=true, trigger_config=null
 * 4. revalidatePath('/admin/prizes')
 */
export async function createPrize(
  formData: FormData
): Promise<{ success: true; id: string } | { error: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const raw = {
    name: formData.get('name'),
    emoji: formData.get('emoji') || undefined,
    description: formData.get('description'),
    trigger_type: formData.get('trigger_type'),
    points_value: formData.get('points_value'),
    cash_value: formData.get('cash_value'),
  }

  const parsed = createPrizeSchema.safeParse(raw)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Invalid input'
    return { error: firstError }
  }

  const { name, emoji, description, trigger_type, points_value, cash_value } = parsed.data
  const adminClient = createAdminClient()

  const { data, error } = await adminClient
    .from('additional_prizes')
    .insert({
      name,
      emoji: emoji ?? null,
      description,
      trigger_type,
      trigger_config: null,
      points_value,
      cash_value,
      is_custom: true,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[createPrize] Insert error:', error?.message)
    return { error: 'Failed to create prize. Please try again.' }
  }

  revalidatePath('/admin/prizes')
  return { success: true, id: data.id }
}

// ─── checkDatePrizes ──────────────────────────────────────────────────────────

/**
 * Checks all date-based prizes against today's date.
 * Called by the /api/check-date-prizes cron route.
 *
 * For each additional_prizes row with trigger_type='date':
 *   - Parses trigger_config to get { month, day }
 *   - Compares to today's date in Europe/London timezone
 *   - If match: checks for existing award (prevent duplicates)
 *   - If no duplicate: snapshots standings, inserts prize_awards row + notification
 *
 * Returns { triggered: string[] } — list of triggered prize names
 */
export async function checkDatePrizes(): Promise<{ triggered: string[] }> {
  const adminClient = createAdminClient()

  // Get today's date in Europe/London timezone
  const now = new Date()
  const londonDate = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)

  // londonDate is like "25/12/2025" — parse it
  const [day, month] = londonDate.split('/').map(Number)

  // Build start/end of today in UTC for duplicate checking
  const todayStart = new Date(now)
  todayStart.setUTCHours(0, 0, 0, 0)
  const todayEnd = new Date(now)
  todayEnd.setUTCHours(23, 59, 59, 999)

  // Fetch all date-based prizes
  const { data: prizes, error: prizesError } = await adminClient
    .from('additional_prizes')
    .select('id, name, emoji, trigger_config')
    .eq('trigger_type', 'date')

  if (prizesError || !prizes) {
    console.error('[checkDatePrizes] Error fetching prizes:', prizesError?.message)
    return { triggered: [] }
  }

  const triggered: string[] = []

  for (const prize of prizes) {
    const config = prize.trigger_config as { month?: number; day?: number } | null
    if (!config || config.month === undefined || config.day === undefined) continue

    // Check if today matches
    if (config.month !== month || config.day !== day) continue

    // Check if award already exists for today (prevent duplicate trigger)
    const { data: existing } = await adminClient
      .from('prize_awards')
      .select('id')
      .eq('prize_id', prize.id)
      .gte('triggered_at', todayStart.toISOString())
      .lt('triggered_at', todayEnd.toISOString())
      .maybeSingle()

    if (existing) {
      // Already triggered today — skip
      continue
    }

    // Snapshot current standings: sum points_awarded per member
    const { data: scores } = await adminClient
      .from('prediction_scores')
      .select('member_id, points_awarded')
      .then(({ data, error: scoresError }) => {
        if (scoresError) console.error('[checkDatePrizes] Scores error:', scoresError.message)
        return { data: data ?? [] }
      })

    // Aggregate totals per member
    const totalsMap: Record<string, number> = {}
    for (const row of scores ?? []) {
      const mid = row.member_id as string
      totalsMap[mid] = (totalsMap[mid] ?? 0) + (row.points_awarded as number)
    }

    const snapshotData = {
      date: londonDate,
      standings: Object.entries(totalsMap)
        .sort(([, a], [, b]) => b - a)
        .map(([member_id, total]) => ({ member_id, total })),
    }

    // Insert prize_awards row
    await adminClient
      .from('prize_awards')
      .insert({
        prize_id: prize.id,
        member_id: null,
        gameweek_id: null,
        triggered_at: now.toISOString(),
        snapshot_data: snapshotData,
        status: 'pending',
        confirmed_by: null,
        confirmed_at: null,
        notes: null,
      })
      .then(({ error }) => {
        if (error) console.error('[checkDatePrizes] Insert award error:', error.message)
      })

    // Insert admin notification
    await adminClient
      .from('admin_notifications')
      .insert({
        type: 'prize_triggered',
        title: `${prize.emoji ?? ''} ${prize.name} triggered`.trim(),
        message: `Date-based prize triggered on ${londonDate}`,
      })
      .then(({ error }) => {
        if (error) console.error('[checkDatePrizes] Notification error:', error.message)
      })

    triggered.push(prize.name)
  }

  return { triggered }
}
