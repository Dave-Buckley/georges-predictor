/**
 * Zod validators for gameweek lifecycle actions.
 *
 * Used for server-side validation of admin gameweek close/reopen operations.
 */
import { z } from 'zod'

// ─── Gameweek Close / Reopen ──────────────────────────────────────────────────

/**
 * Validates when George closes a gameweek.
 * Closing finalises all scores + predictions and requires bonus confirmation first.
 */
export const closeGameweekSchema = z.object({
  gameweek_id: z.string().uuid({ message: 'Invalid gameweek ID' }),
})

export type CloseGameweekInput = z.infer<typeof closeGameweekSchema>

/**
 * Validates when George reopens a previously closed gameweek.
 * Comes with a confirmation dialog warning that reports may need regenerating.
 */
export const reopenGameweekSchema = z.object({
  gameweek_id: z.string().uuid({ message: 'Invalid gameweek ID' }),
})

export type ReopenGameweekInput = z.infer<typeof reopenGameweekSchema>
