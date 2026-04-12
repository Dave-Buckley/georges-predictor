/**
 * Zod validators for Phase 9 pre-season predictions.
 *
 * Zod v4 convention (STATE.md Phase 1):
 *   - Error access uses `.issues[0]?.message` (NOT `.errors`)
 *
 * Source-list refinement (PL teams vs Championship teams):
 *   - NOT enforced in these schemas because the PL team list is in the DB
 *     (`teams` table) and requires a DB round-trip. Enforced instead inside
 *     the server action after calling `.safeParse()`.
 *   - The Championship list is a static constant (`CHAMPIONSHIP_TEAMS_2025_26`)
 *     and could be enforced here with `.refine()`, but for consistency with
 *     the PL side we keep ALL source-list checks co-located in the action.
 *
 * Shape references:
 *   - `importPreSeasonPicksRowSchema` in src/lib/validators/import.ts — parent
 *     shape for 12-pick data. This file adds member-action variants.
 */

import { z } from 'zod'

// ─── Member submission ───────────────────────────────────────────────────────
// Self-submission: member_id is resolved server-side from auth.uid(),
// never trusted from the client.

export const submitPreSeasonPicksSchema = z.object({
  season: z.coerce
    .number()
    .int('Season must be a whole number')
    .min(2020, 'Season must be 2020 or later')
    .max(2030, 'Season must be 2030 or earlier'),
  top4: z
    .array(z.string().min(1, 'Team name cannot be empty'))
    .length(4, 'Exactly 4 top-4 teams required'),
  tenth_place: z.string().min(1, '10th place required'),
  relegated: z
    .array(z.string().min(1, 'Team name cannot be empty'))
    .length(3, 'Exactly 3 relegated teams required'),
  promoted: z
    .array(z.string().min(1, 'Team name cannot be empty'))
    .length(3, 'Exactly 3 promoted teams required'),
  promoted_playoff_winner: z.string().min(1, 'Playoff winner required'),
})

export type SubmitPreSeasonPicksInput = z.infer<typeof submitPreSeasonPicksSchema>

// ─── Admin override (late-joiner entry) ──────────────────────────────────────
// Extends the member submission with member_id so George can enter picks
// on behalf of members who registered after GW1 lockout.

export const setPreSeasonPicksForMemberSchema = submitPreSeasonPicksSchema.extend({
  member_id: z.string().uuid({ message: 'Invalid member id' }),
})

export type SetPreSeasonPicksForMemberInput = z.infer<
  typeof setPreSeasonPicksForMemberSchema
>

// ─── Admin confirmation ──────────────────────────────────────────────────────
// George confirms awards. override_points optional — when provided, replaces
// the system-calculated value. Non-negative so accidental negatives are
// rejected at the validator boundary.

export const confirmPreSeasonAwardSchema = z.object({
  member_id: z.string().uuid({ message: 'Invalid member id' }),
  season: z.coerce.number().int(),
  override_points: z.coerce
    .number()
    .int('Override points must be a whole number')
    .min(0, 'Override points cannot be negative')
    .optional(),
})

export type ConfirmPreSeasonAwardInput = z.infer<typeof confirmPreSeasonAwardSchema>

// ─── End-of-season actuals ───────────────────────────────────────────────────
// Admin enters the real season results so calculatePreSeasonPoints can run.

export const seasonActualsSchema = z.object({
  season: z.coerce.number().int(),
  final_top4: z
    .array(z.string().min(1))
    .length(4, 'Exactly 4 top-4 teams required'),
  final_tenth: z.string().min(1, '10th place required'),
  final_relegated: z
    .array(z.string().min(1))
    .length(3, 'Exactly 3 relegated teams required'),
  final_promoted: z
    .array(z.string().min(1))
    .length(3, 'Exactly 3 promoted teams required'),
  final_playoff_winner: z.string().min(1, 'Playoff winner required'),
})

export type SeasonActualsInput = z.infer<typeof seasonActualsSchema>
