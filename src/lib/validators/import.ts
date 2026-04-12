import { z } from 'zod'

// ─── Import Members Schemas ───────────────────────────────────────────────────
// Validates parsed import rows before bulk insert into the members table.
// NOTE: Zod v4 uses .issues[] not .errors[] for validation error extraction.

/** Validates a single parsed member import row */
export const importRowSchema = z.object({
  display_name: z
    .string()
    .min(1, 'Display name is required')
    .max(50, 'Display name must be 50 characters or fewer')
    .transform((v) => v.trim()),
  starting_points: z.coerce
    .number()
    .int('Starting points must be a whole number')
    .min(0, 'Starting points cannot be negative'),
})

export type ImportRowInput = z.infer<typeof importRowSchema>

/** Validates an array of member import rows (1–100 rows per import batch) */
export const importMembersSchema = z.array(importRowSchema).min(1, 'At least one row is required').max(100, 'Maximum 100 rows per import')

export type ImportMembersInput = z.infer<typeof importMembersSchema>

// ─── Pre-Season Picks Schemas ─────────────────────────────────────────────────
// Validates parsed pre-season picks rows before inserting into pre_season_picks.

/** Validates a single member's pre-season picks row */
export const importPreSeasonPicksRowSchema = z.object({
  member_name: z
    .string()
    .min(1, 'Member name is required')
    .max(50, 'Member name must be 50 characters or fewer')
    .transform((v) => v.trim()),
  season: z.coerce
    .number()
    .int('Season must be a whole number')
    .min(2020, 'Season must be 2020 or later')
    .max(2030, 'Season must be 2030 or earlier'),
  top4: z
    .array(z.string().min(1, 'Team name cannot be empty'))
    .length(4, 'Exactly 4 top-4 team predictions are required'),
  tenth_place: z.string().min(1, '10th place prediction is required'),
  relegated: z
    .array(z.string().min(1, 'Team name cannot be empty'))
    .length(3, 'Exactly 3 relegated team predictions are required'),
  promoted: z
    .array(z.string().min(1, 'Team name cannot be empty'))
    .length(3, 'Exactly 3 promoted team predictions are required'),
  promoted_playoff_winner: z.string().min(1, 'Playoff winner prediction is required'),
})

export type ImportPreSeasonPicksRowInput = z.infer<typeof importPreSeasonPicksRowSchema>

/** Validates an array of pre-season picks rows */
export const importPreSeasonPicksSchema = z
  .array(importPreSeasonPicksRowSchema)
  .min(1, 'At least one row is required')
  .max(100, 'Maximum 100 rows per import')

export type ImportPreSeasonPicksInput = z.infer<typeof importPreSeasonPicksSchema>
