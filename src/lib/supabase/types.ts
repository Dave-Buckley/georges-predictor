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
  /** Added by migration 007 — tracks last update time (e.g. when an imported placeholder is claimed) */
  updated_at: string | null
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

/** Union of all valid admin notification types */
export type AdminNotificationType =
  | 'new_signup'
  | 'approval_needed'
  | 'system'
  | 'sync_failure'
  | 'fixture_rescheduled'
  | 'fixture_moved'
  | 'result_override'
  | 'scoring_complete'
  | 'bonus_reminder'
  | 'gw_complete'
  | 'prize_triggered'
  | 'bonus_award_needed'
  | 'import_complete'
  | 'los_winner_found'
  | 'los_competition_started'
  | 'h2h_steal_detected'
  | 'h2h_steal_resolved'

/** Row shape for the public.admin_notifications table */
export interface AdminNotificationRow {
  id: string
  type: AdminNotificationType
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
  double_bubble: boolean
  closed_at: string | null
  closed_by: string | null
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
  result_source: 'api' | 'manual' | null
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

// ─── Prediction Types ─────────────────────────────────────────────────────────

/** Row shape for the public.predictions table */
export interface PredictionRow {
  id: string
  member_id: string
  fixture_id: string
  home_score: number
  away_score: number
  submitted_at: string
  updated_at: string
}

/** Prediction joined with the member's display info (for admin table view) */
export interface PredictionWithMember extends PredictionRow {
  member: Pick<MemberRow, 'id' | 'display_name'>
}

// ─── Scoring Types ────────────────────────────────────────────────────────────

/** Row shape for the public.prediction_scores table */
export interface PredictionScoreRow {
  id: string
  prediction_id: string
  fixture_id: string
  member_id: string
  predicted_home: number
  predicted_away: number
  actual_home: number
  actual_away: number
  result_correct: boolean
  score_correct: boolean
  points_awarded: 0 | 10 | 30
  calculated_at: string
}

/** Row shape for the public.result_overrides table */
export interface ResultOverrideRow {
  id: string
  fixture_id: string
  changed_by: string
  old_home: number | null
  old_away: number | null
  new_home: number
  new_away: number
  predictions_recalculated: number
  created_at: string
}

// ─── Admin Panel Types ────────────────────────────────────────────────────────

/** Row shape for the public.bonus_types table */
export interface BonusTypeRow {
  id: string
  name: string
  description: string
  is_custom: boolean
  created_at: string
}

/** Row shape for the public.bonus_schedule table */
export interface BonusScheduleRow {
  id: string
  gameweek_id: string
  bonus_type_id: string
  confirmed: boolean
  confirmed_at: string | null
  confirmed_by: string | null
  created_at: string
}

/** Row shape for the public.bonus_awards table */
export interface BonusAwardRow {
  id: string
  gameweek_id: string
  member_id: string
  bonus_type_id: string
  fixture_id: string | null
  /** null = pending, true = confirmed, false = rejected */
  awarded: boolean | null
  confirmed_by: string | null
  confirmed_at: string | null
  /** Calculated bonus points for this award. Added by migration 006. */
  points_awarded: number
  created_at: string
}

/** Row shape for the public.additional_prizes table */
export interface AdditionalPrizeRow {
  id: string
  name: string
  emoji: string | null
  description: string
  trigger_type: 'auto' | 'date' | 'manual'
  trigger_config: Record<string, unknown> | null
  points_value: number
  /** Cash value stored in pence (1000 = £10) */
  cash_value: number
  is_custom: boolean
  created_at: string
}

/** Row shape for the public.prize_awards table */
export interface PrizeAwardRow {
  id: string
  prize_id: string
  member_id: string | null
  gameweek_id: string | null
  triggered_at: string
  snapshot_data: Record<string, unknown> | null
  status: 'pending' | 'confirmed' | 'rejected'
  confirmed_by: string | null
  confirmed_at: string | null
  notes: string | null
}

/** Row shape for the public.admin_settings table */
export interface AdminSettingsRow {
  id: string
  admin_user_id: string
  email_bonus_reminders: boolean
  email_gw_complete: boolean
  email_prize_triggered: boolean
  created_at: string
  updated_at: string
}

/** BonusSchedule joined with bonus type info */
export interface BonusScheduleWithType extends BonusScheduleRow {
  bonus_type: BonusTypeRow
}

/** BonusAward joined with bonus type info (for member display) */
export interface BonusAwardWithType extends BonusAwardRow {
  bonus_type: BonusTypeRow
}

/** PrizeAward joined with prize info and member */
export interface PrizeAwardWithDetails extends PrizeAwardRow {
  prize: AdditionalPrizeRow
  member: Pick<MemberRow, 'id' | 'display_name'> | null
}

// ─── Mid-Season Import Types ──────────────────────────────────────────────────

/** Row shape for the public.pre_season_picks table */
export interface PreSeasonPickRow {
  id: string
  member_id: string
  season: number
  /** Ordered array of up to 4 team names. Order matters for Phase 9 scoring. */
  top4: string[]
  /** Team name predicted to finish 10th */
  tenth_place: string | null
  /** Array of up to 3 team names predicted to be relegated */
  relegated: string[]
  /** Array of up to 3 Championship team names predicted to be promoted */
  promoted: string[]
  /** Championship promotion playoff winner team name */
  promoted_playoff_winner: string | null
  imported_by: string | null
  imported_at: string
}

// ─── Last One Standing + Head-to-Head Types (Phase 8) ────────────────────────

/** Lifecycle status for a LOS competition cycle */
export type LosCompetitionStatus = 'active' | 'complete'

/** Per-member status within a LOS competition cycle */
export type LosMemberStatus = 'active' | 'eliminated'

/** Reason a member was eliminated from a LOS competition cycle */
export type LosEliminationReason = 'draw' | 'lose' | 'missed' | 'admin_override'

/** Outcome of a single LOS pick once its fixture has finished */
export type LosPickOutcome = 'win' | 'lose' | 'draw' | 'pending'

/** Row shape for the public.los_competitions table */
export interface LosCompetitionRow {
  id: string
  season: number
  competition_num: number
  status: LosCompetitionStatus
  starts_at_gw: number
  ended_at_gw: number | null
  winner_id: string | null
  created_at: string
  ended_at: string | null
}

/** Row shape for the public.los_competition_members table */
export interface LosCompetitionMemberRow {
  id: string
  competition_id: string
  member_id: string
  status: LosMemberStatus
  eliminated_at_gw: number | null
  eliminated_reason: LosEliminationReason | null
  created_at: string
}

/** Row shape for the public.los_picks table */
export interface LosPickRow {
  id: string
  competition_id: string
  member_id: string
  gameweek_id: string
  team_id: string
  fixture_id: string
  outcome: LosPickOutcome | null
  evaluated_at: string | null
  created_at: string
  updated_at: string
}

/** Row shape for the public.h2h_steals table */
export interface H2hStealRow {
  id: string
  detected_in_gw_id: string
  resolves_in_gw_id: string
  /** 1 = tied for 1st place; 2 = tied for 2nd place */
  position: 1 | 2
  tied_member_ids: string[]
  /** NULL until resolved in the following gameweek */
  winner_ids: string[] | null
  resolved_at: string | null
  created_at: string
}

// ─── Database Type (placeholder until `supabase gen types` is run) ────────────
// This allows Supabase client to be used without strict DB type checking.
// Replace with generated types after connecting to a Supabase project.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any
