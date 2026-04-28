/**
 * Zod validators for bonus-related inputs.
 *
 * Used for server-side validation of admin bonus management actions
 * and member bonus pick submissions.
 */
import { z } from 'zod'

// ─── Bonus Schedule Schemas ───────────────────────────────────────────────────

/**
 * Validates when George sets or changes the bonus for a gameweek.
 */
export const setBonusSchema = z.object({
  gameweek_id: z.string().uuid({ message: 'Invalid gameweek ID' }),
  bonus_type_id: z.string().uuid({ message: 'Invalid bonus type ID' }),
})

export type SetBonusInput = z.infer<typeof setBonusSchema>

// ─── Bonus Award Schemas ──────────────────────────────────────────────────────

/**
 * Validates when George confirms or rejects a single member's bonus award.
 */
export const confirmBonusAwardSchema = z.object({
  award_id: z.string().uuid({ message: 'Invalid award ID' }),
  awarded: z.boolean(),
  points_awarded: z
    .number()
    .int()
    .min(0, { message: 'Points cannot be negative' })
    .max(1000, { message: 'Points too high' })
    .optional(),
})

export type ConfirmBonusAwardInput = z.infer<typeof confirmBonusAwardSchema>

/**
 * Validates when George bulk-approves or bulk-rejects all pending awards for a gameweek.
 */
export const bulkConfirmBonusSchema = z.object({
  gameweek_id: z.string().uuid({ message: 'Invalid gameweek ID' }),
  action: z.enum(['approve_all', 'reject_all']),
})

export type BulkConfirmBonusInput = z.infer<typeof bulkConfirmBonusSchema>

// ─── Double Bubble Schemas ────────────────────────────────────────────────────

/**
 * Validates when George toggles Double Bubble on or off for a gameweek.
 */
export const toggleDoubleBubbleSchema = z.object({
  gameweek_id: z.string().uuid({ message: 'Invalid gameweek ID' }),
  enabled: z.boolean(),
})

export type ToggleDoubleBubbleInput = z.infer<typeof toggleDoubleBubbleSchema>

// ─── Custom Bonus Type Schemas ────────────────────────────────────────────────

/**
 * Validates when George creates a new custom bonus type.
 */
export const createBonusTypeSchema = z.object({
  name: z.string().min(1, { message: 'Name is required' }).max(100, { message: 'Name must be 100 characters or fewer' }),
  description: z.string().min(1, { message: 'Description is required' }).max(500, { message: 'Description must be 500 characters or fewer' }),
})

export type CreateBonusTypeInput = z.infer<typeof createBonusTypeSchema>

// ─── Member Bonus Pick Schemas ────────────────────────────────────────────────

/**
 * Validates a member's bonus fixture pick.
 * Used in the extended submitPredictions server action (Phase 6 Plan 02).
 *
 * Members submit this alongside their predictions — the bonus pick selects
 * which fixture their bonus condition should be evaluated against.
 */
export const submitBonusPickSchema = z.object({
  gameweek_id: z.string().uuid({ message: 'Invalid gameweek ID' }),
  fixture_id: z.string().uuid({ message: 'Invalid fixture ID' }),
})

export type SubmitBonusPickInput = z.infer<typeof submitBonusPickSchema>
