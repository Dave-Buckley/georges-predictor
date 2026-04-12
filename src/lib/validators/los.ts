import { z } from 'zod'

/**
 * Zod validators for the Last One Standing sub-competition.
 *
 * Follows the project's Zod v4 conventions (see predictions.ts):
 *   - Use .safeParse() then inspect `.issues[]` on failure (NOT .errors[]).
 *   - No zodResolver — server actions validate directly.
 */

// ─── Shared primitives ───────────────────────────────────────────────────────

/** A LOS team id is the standard Supabase UUID of the picked team. */
export const losTeamIdSchema = z.string().uuid('Invalid team id')

// ─── Member-facing: submit a pick ────────────────────────────────────────────

/**
 * Payload shape used when a member submits (or clears) their LOS pick.
 * `los_team_id` may be null — used when a member wants to withdraw a pick
 * before kick-off.
 */
export const submitLosPickSchema = z.object({
  los_team_id: losTeamIdSchema.nullable(),
})

export type SubmitLosPickInput = z.infer<typeof submitLosPickSchema>

// ─── Admin-facing: override elimination ──────────────────────────────────────

/**
 * Admin action: mark a member eliminated from the current competition.
 * Reason must match the enum on los_competition_members.eliminated_reason.
 */
export const adminOverrideEliminateSchema = z.object({
  member_id: z.string().uuid('Invalid member id'),
  competition_id: z.string().uuid('Invalid competition id'),
  reason: z.enum(['draw', 'lose', 'missed', 'admin_override']),
})

export type AdminOverrideEliminateInput = z.infer<typeof adminOverrideEliminateSchema>

// ─── Admin-facing: reinstate an eliminated member ────────────────────────────

/** Admin action: flip an eliminated member back to `active`. */
export const adminReinstateSchema = z.object({
  member_id: z.string().uuid('Invalid member id'),
  competition_id: z.string().uuid('Invalid competition id'),
})

export type AdminReinstateInput = z.infer<typeof adminReinstateSchema>
