/**
 * Zod validators for prize-related inputs.
 *
 * Used for server-side validation of admin prize management actions.
 */
import { z } from 'zod'

// ─── Prize Award Confirmation ─────────────────────────────────────────────────

/**
 * Validates when George confirms or rejects a triggered prize award.
 * Notes are optional (George can add context to the confirmation).
 */
export const confirmPrizeSchema = z.object({
  award_id: z.string().uuid({ message: 'Invalid award ID' }),
  status: z.enum(['confirmed', 'rejected']),
  notes: z.string().max(500, { message: 'Notes must be 500 characters or fewer' }).optional(),
})

export type ConfirmPrizeInput = z.infer<typeof confirmPrizeSchema>

// ─── Custom Prize Creation ────────────────────────────────────────────────────

/**
 * Validates when George creates a new custom additional prize mid-season.
 * cash_value is in pence (coerced from FormData string). 1000 = £10.
 */
export const createPrizeSchema = z.object({
  name: z.string().min(1, { message: 'Name is required' }).max(100, { message: 'Name must be 100 characters or fewer' }),
  emoji: z.string().max(4, { message: 'Emoji must be 4 characters or fewer' }).optional(),
  description: z.string().min(1, { message: 'Description is required' }).max(500, { message: 'Description must be 500 characters or fewer' }),
  trigger_type: z.enum(['auto', 'date', 'manual']),
  points_value: z.coerce
    .number()
    .int({ message: 'Points value must be a whole number' })
    .min(0, { message: 'Points value cannot be negative' }),
  /** Cash value in pence (1000 = £10). Coerced from FormData string. */
  cash_value: z.coerce
    .number()
    .int({ message: 'Cash value must be a whole number (in pence)' })
    .min(0, { message: 'Cash value cannot be negative' }),
})

export type CreatePrizeInput = z.infer<typeof createPrizeSchema>
