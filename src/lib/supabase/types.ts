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
  type: 'new_signup' | 'approval_needed' | 'system'
  title: string
  message: string | null
  is_read: boolean
  member_id: string | null
  created_at: string
}

// ─── Database Type (placeholder until `supabase gen types` is run) ────────────
// This allows Supabase client to be used without strict DB type checking.
// Replace with generated types after connecting to a Supabase project.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any
