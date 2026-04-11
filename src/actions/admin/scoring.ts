'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { overrideResultSchema } from '@/lib/validators/scoring'
import { recalculateFixture } from '@/lib/scoring/recalculate'

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

// ─── Get Override Impact ──────────────────────────────────────────────────────

/**
 * Returns the number of predictions that will be recalculated if a result
 * is overridden, plus the current scores on the fixture.
 *
 * Used by the ResultOverrideDialog to show George the impact before confirming.
 */
export async function getOverrideImpact(
  fixtureId: string
): Promise<
  | {
      prediction_count: number
      current_home: number | null
      current_away: number | null
      current_source: string | null
    }
  | { error: string }
> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const adminClient = createAdminClient()

  const [predictionsResult, fixtureResult] = await Promise.all([
    adminClient
      .from('predictions')
      .select('id', { count: 'exact', head: true })
      .eq('fixture_id', fixtureId),
    adminClient
      .from('fixtures')
      .select('home_score, away_score, result_source')
      .eq('id', fixtureId)
      .single(),
  ])

  if (fixtureResult.error) {
    return { error: 'Fixture not found' }
  }

  return {
    prediction_count: predictionsResult.count ?? 0,
    current_home: fixtureResult.data.home_score,
    current_away: fixtureResult.data.away_score,
    current_source: fixtureResult.data.result_source,
  }
}

// ─── Apply Result Override ────────────────────────────────────────────────────

/**
 * Applies a manual result override for a fixture:
 * 1. Validates input with overrideResultSchema
 * 2. Updates fixture: home_score, away_score, status=FINISHED, result_source=manual
 * 3. Calls recalculateFixture to update all prediction_scores
 * 4. Inserts an audit record into result_overrides
 * 5. Creates an admin notification
 * 6. Revalidates admin and member pages
 *
 * Auth: only callable by admin users. Returns { error } for non-admins.
 */
export async function applyResultOverride(
  formData: FormData
): Promise<{ success: true; recalculated: number } | { error: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const { userId } = auth

  // Validate input
  const raw = {
    fixture_id: formData.get('fixture_id'),
    home_score: formData.get('home_score'),
    away_score: formData.get('away_score'),
  }

  const parsed = overrideResultSchema.safeParse(raw)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Invalid input'
    return { error: firstError }
  }

  const { fixture_id, home_score, away_score } = parsed.data

  const adminClient = createAdminClient()

  // Fetch current fixture scores (for audit log old values) and team names (for notification)
  const { data: fixture, error: fetchError } = await adminClient
    .from('fixtures')
    .select(`
      home_score,
      away_score,
      home_team:teams!home_team_id(name),
      away_team:teams!away_team_id(name)
    `)
    .eq('id', fixture_id)
    .single()

  if (fetchError || !fixture) {
    return { error: 'Fixture not found' }
  }

  const oldHome = fixture.home_score
  const oldAway = fixture.away_score
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const homeTeamName = (fixture as any).home_team?.name ?? 'Home'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const awayTeamName = (fixture as any).away_team?.name ?? 'Away'

  // Update fixture with new result
  const { error: updateError } = await adminClient
    .from('fixtures')
    .update({
      home_score,
      away_score,
      status: 'FINISHED',
      result_source: 'manual',
    })
    .eq('id', fixture_id)

  if (updateError) {
    console.error('[applyResultOverride] Update error:', updateError.message)
    return { error: 'Failed to update fixture result. Please try again.' }
  }

  // Recalculate all predictions for this fixture
  const recalcResult = await recalculateFixture(fixture_id, home_score, away_score)

  if (recalcResult.errors.length > 0) {
    console.error('[applyResultOverride] Recalc errors:', recalcResult.errors)
    // Don't fail the whole operation — audit log the result anyway
  }

  // Insert audit record into result_overrides
  const { error: auditError } = await adminClient.from('result_overrides').insert({
    fixture_id,
    changed_by: userId,
    old_home: oldHome,
    old_away: oldAway,
    new_home: home_score,
    new_away: away_score,
    predictions_recalculated: recalcResult.predictions_scored,
  })

  if (auditError) {
    console.error('[applyResultOverride] Audit insert error:', auditError.message)
    // Non-fatal — operation succeeded, log the warning
  }

  // Create admin notification
  await adminClient
    .from('admin_notifications')
    .insert({
      type: 'result_override',
      title: `Result override: ${homeTeamName} ${home_score}-${away_score} ${awayTeamName}`,
      message: `${recalcResult.predictions_scored} predictions recalculated. Previous: ${oldHome ?? '?'}-${oldAway ?? '?'}`,
    })
    .then(({ error }) => {
      if (error) console.error('[applyResultOverride] Notification error:', error.message)
    })

  // Revalidate both admin and member-facing pages
  revalidatePath('/admin/gameweeks')
  revalidatePath('/gameweeks')

  return { success: true, recalculated: recalcResult.predictions_scored }
}
