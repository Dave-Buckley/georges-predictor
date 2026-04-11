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

// ─── Types ────────────────────────────────────────────────────────────────────

/** Result returned from a recalculation run */
export interface RecalcResult {
  fixture_id: string
  predictions_scored: number
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
    return { fixture_id: fixtureId, predictions_scored: 0, errors: [] }
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
    return { fixture_id: fixtureId, predictions_scored: 0, errors }
  }

  if (!predictions || predictions.length === 0) {
    return { fixture_id: fixtureId, predictions_scored: 0, errors: [] }
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
    return { fixture_id: fixtureId, predictions_scored: 0, errors }
  }

  return {
    fixture_id: fixtureId,
    predictions_scored: scoreRows.length,
    errors: [],
  }
}
