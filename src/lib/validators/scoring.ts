/**
 * Zod validators for scoring-related inputs.
 *
 * Used for server-side validation of admin result override submissions.
 */
import { z } from 'zod'

// ─── Result Override Schema ───────────────────────────────────────────────────

/**
 * Validates the payload when George manually overrides a fixture result.
 * Scores are coerced from strings (form inputs) to integers.
 * Valid range: 0–20 (realistic football scores).
 */
export const overrideResultSchema = z.object({
  fixture_id: z.string().uuid({ message: 'Invalid fixture ID' }),
  home_score: z.coerce
    .number()
    .int({ message: 'Home score must be a whole number' })
    .min(0, { message: 'Home score cannot be negative' })
    .max(20, { message: 'Home score cannot exceed 20' }),
  away_score: z.coerce
    .number()
    .int({ message: 'Away score must be a whole number' })
    .min(0, { message: 'Away score cannot be negative' })
    .max(20, { message: 'Away score cannot exceed 20' }),
})

export type OverrideResultInput = z.infer<typeof overrideResultSchema>
