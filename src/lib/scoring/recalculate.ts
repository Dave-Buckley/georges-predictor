/**
 * Scoring recalculation orchestrator.
 *
 * Connects the pure calculatePoints function to the database.
 * Uses the admin client (service role) to bypass RLS since only the
 * system writes to prediction_scores — members never write directly.
 *
 * Safe to call multiple times — the upsert on prediction_id is idempotent.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { calculatePoints } from './calculate'
import { calculateBonusPoints } from './calculate-bonus'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Result returned from a recalculation run */
export interface RecalcResult {
  fixture_id: string
  predictions_scored: number
  bonus_calculated: number
  errors: string[]
}

// ─── Core orchestrator ────────────────────────────────────────────────────────

/**
 * Recalculates scores for all predictions for a given fixture.
 *
 * Steps:
 * 1. Guard: if home_score or away_score is null, return early (no result yet)
 * 2. Query all predictions for the fixture using admin client
 * 3. For each prediction, call calculatePoints()
 * 4. Upsert all prediction_scores rows (idempotent via prediction_id UNIQUE)
 * 5. Return { fixture_id, predictions_scored, errors }
 *
 * @param fixtureId  - UUID of the fixture to recalculate
 * @param homeScore  - Actual home score (null if not yet available)
 * @param awayScore  - Actual away score (null if not yet available)
 */
export async function recalculateFixture(
  fixtureId: string,
  homeScore: number | null,
  awayScore: number | null,
): Promise<RecalcResult> {
  // Guard: cannot score without an actual result
  if (homeScore === null || awayScore === null) {
    return { fixture_id: fixtureId, predictions_scored: 0, bonus_calculated: 0, errors: [] }
  }

  const adminClient = createAdminClient()
  const errors: string[] = []

  // Step 1: Fetch all predictions for this fixture
  const { data: predictions, error: fetchError } = await adminClient
    .from('predictions')
    .select('id, member_id, fixture_id, home_score, away_score')
    .eq('fixture_id', fixtureId)

  if (fetchError) {
    errors.push(`Failed to fetch predictions: ${fetchError.message}`)
    return { fixture_id: fixtureId, predictions_scored: 0, bonus_calculated: 0, errors }
  }

  if (!predictions || predictions.length === 0) {
    return { fixture_id: fixtureId, predictions_scored: 0, bonus_calculated: 0, errors: [] }
  }

  // Step 2: Calculate points for each prediction
  const scoreRows = predictions.map((prediction: {
    id: string
    member_id: string
    fixture_id: string
    home_score: number
    away_score: number
  }) => {
    const result = calculatePoints(
      { home: prediction.home_score, away: prediction.away_score },
      { home: homeScore, away: awayScore },
    )

    return {
      prediction_id: prediction.id,
      fixture_id: fixtureId,
      member_id: prediction.member_id,
      predicted_home: result.predicted_home,
      predicted_away: result.predicted_away,
      actual_home: result.actual_home,
      actual_away: result.actual_away,
      result_correct: result.result_correct,
      score_correct: result.score_correct,
      points_awarded: result.points_awarded,
    }
  })

  // Step 3: Upsert all score rows (idempotent — prediction_id has UNIQUE constraint)
  const { error: upsertError } = await adminClient
    .from('prediction_scores')
    .upsert(scoreRows, { onConflict: 'prediction_id' })

  if (upsertError) {
    errors.push(`Failed to upsert prediction_scores: ${upsertError.message}`)
    return { fixture_id: fixtureId, predictions_scored: 0, bonus_calculated: 0, errors }
  }

  // Step 4: Calculate bonus points for members who picked this fixture
  let bonus_calculated = 0

  const { data: bonusAwards, error: bonusQueryError } = await adminClient
    .from('bonus_awards')
    .select('id, member_id, bonus_type_id, awarded, bonus_type:bonus_types!bonus_type_id(name)')
    .eq('fixture_id', fixtureId)

  if (!bonusQueryError && bonusAwards && bonusAwards.length > 0) {
    for (const award of bonusAwards) {
      // Only recalculate for pending awards (awarded IS NULL) — George hasn't reviewed yet.
      // Skip already-confirmed (true) or already-rejected (false) awards — don't overwrite George's decision.
      if (award.awarded !== null) continue

      const bonusTypeName = (award.bonus_type as unknown as { name: string } | null)?.name ?? ''

      // Find this member's prediction_scores for the same fixture
      const memberScore = scoreRows.find((s: { member_id: string }) => s.member_id === award.member_id)

      if (memberScore) {
        const bonusResult = calculateBonusPoints(
          bonusTypeName,
          { result_correct: memberScore.result_correct, score_correct: memberScore.score_correct },
          { home: homeScore, away: awayScore },
        )

        // Update the bonus_awards row with calculated points.
        // Never touch the `awarded` (confirmation) field — only update points_awarded.
        const { error: bonusUpdateError } = await adminClient
          .from('bonus_awards')
          .update({ points_awarded: bonusResult.points_awarded })
          .eq('id', award.id)

        if (bonusUpdateError) {
          errors.push(`Failed to update bonus for award ${award.id}: ${bonusUpdateError.message}`)
        } else {
          bonus_calculated++
        }
      }
    }
  }

  return {
    fixture_id: fixtureId,
    predictions_scored: scoreRows.length,
    bonus_calculated,
    errors,
  }
}
