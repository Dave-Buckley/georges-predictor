import { z } from 'zod'

// ─── Prediction Entry ─────────────────────────────────────────────────────────

/**
 * Validates a single fixture prediction entry.
 * Coerces string scores to numbers (form inputs submit as strings).
 */
export const predictionEntrySchema = z.object({
  fixture_id: z.string().uuid('Invalid fixture ID'),
  home_score: z.coerce
    .number()
    .int('Score must be a whole number')
    .min(0, 'Score cannot be negative')
    .max(20, 'Score too high'),
  away_score: z.coerce
    .number()
    .int('Score must be a whole number')
    .min(0, 'Score cannot be negative')
    .max(20, 'Score too high'),
})

export type PredictionEntry = z.infer<typeof predictionEntrySchema>

// ─── Submit Predictions ───────────────────────────────────────────────────────

/**
 * Validates the full submit-predictions payload:
 * gameweek_number (1-38) + at least one entry.
 */
export const submitPredictionsSchema = z.object({
  gameweek_number: z.coerce
    .number()
    .int('Gameweek must be a whole number')
    .min(1, 'Gameweek must be between 1 and 38')
    .max(38, 'Gameweek must be between 1 and 38'),
  entries: z
    .array(predictionEntrySchema)
    .min(1, 'At least one prediction required'),
})

export type SubmitPredictionsInput = z.infer<typeof submitPredictionsSchema>
