// ─── Enums ────────────────────────────────────────────────────────────────────

export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export type UserRole = 'admin' | 'member'

// ─── Table Row Types ──────────────────────────────────────────────────────────

/** Row shape for the public.members table */
export interface MemberRow {
  id: string
  user_id: string
  email: string
  display_name: string
  approval_status: ApprovalStatus
  email_opt_in: boolean
  starting_points: number
  created_at: string
  approved_at: string | null
  approved_by: string | null
}

/** Row shape for the public.admin_security_questions table */
export interface AdminSecurityQuestionRow {
  id: string
  admin_user_id: string
  question: string
  answer_hash: string
  created_at: string
  updated_at: string
}

/** Row shape for the public.blocked_emails table */
export interface BlockedEmailRow {
  email: string
  blocked_at: string
  blocked_by: string | null
}

/** Row shape for the public.admin_notifications table */
export interface AdminNotificationRow {
  id: string
  type: 'new_signup' | 'approval_needed' | 'system' | 'sync_failure' | 'fixture_rescheduled' | 'fixture_moved'
  title: string
  message: string | null
  is_read: boolean
  member_id: string | null
  created_at: string
}

// ─── Fixture Layer Types ──────────────────────────────────────────────────────

/** Union of all valid fixture status values (mirrors CHECK constraint in migration) */
export type FixtureStatus =
  | 'SCHEDULED'
  | 'TIMED'
  | 'IN_PLAY'
  | 'PAUSED'
  | 'FINISHED'
  | 'POSTPONED'
  | 'SUSPENDED'
  | 'CANCELLED'
  | 'AWARDED'

/** Union of all valid gameweek status values */
export type GameweekStatus = 'scheduled' | 'active' | 'complete'

/** Row shape for the public.teams table */
export interface TeamRow {
  id: string
  external_id: number
  name: string
  short_name: string | null
  tla: string | null
  crest_url: string | null
  updated_at: string
}

/** Row shape for the public.gameweeks table */
export interface GameweekRow {
  id: string
  number: number
  season: number
  status: GameweekStatus
  created_at: string
}

/** Row shape for the public.fixtures table */
export interface FixtureRow {
  id: string
  external_id: number
  gameweek_id: string
  home_team_id: string
  away_team_id: string
  kickoff_time: string
  status: FixtureStatus
  is_rescheduled: boolean
  home_score: number | null
  away_score: number | null
  created_at: string
  updated_at: string
}

/** Row shape for the public.sync_log table */
export interface SyncLogRow {
  id: string
  synced_at: string
  success: boolean
  fixtures_updated: number
  error_message: string | null
}

/** Fixture row joined with both teams and the gameweek (for display queries) */
export interface FixtureWithTeams extends FixtureRow {
  home_team: TeamRow
  away_team: TeamRow
  gameweek: GameweekRow
}

// ─── Database Type (placeholder until `supabase gen types` is run) ────────────
// This allows Supabase client to be used without strict DB type checking.
// Replace with generated types after connecting to a Supabase project.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any
