-- ============================================================
-- George's Predictor — Phase 1 Initial Schema
-- ============================================================
-- Apply via Supabase SQL Editor or: supabase db push
-- ============================================================

-- ─── Members Table ─────────────────────────────────────────────────────────
-- Stores one row per registered user with their approval state and point balance.
-- A Postgres trigger (below) creates this row automatically when a user signs up.

CREATE TABLE public.members (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email           text        NOT NULL,
  display_name    text        NOT NULL,
  approval_status text        NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  email_opt_in    boolean     NOT NULL DEFAULT true,
  starting_points int         NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  approved_at     timestamptz,
  approved_by     uuid        REFERENCES auth.users(id)
);

COMMENT ON TABLE public.members IS
  'One row per registered user. approval_status gates prediction access.';
COMMENT ON COLUMN public.members.starting_points IS
  'Points carried over from previous season or awarded by admin for late joiners.';

-- ─── Blocked Emails Table ──────────────────────────────────────────────────
-- Prevents rejected users from re-registering with the same email.

CREATE TABLE public.blocked_emails (
  email       text        PRIMARY KEY,
  blocked_at  timestamptz NOT NULL DEFAULT now(),
  blocked_by  uuid        REFERENCES auth.users(id)
);

COMMENT ON TABLE public.blocked_emails IS
  'Emails blocked by admin to prevent re-registration after rejection.';

-- ─── Admin Notifications Table ─────────────────────────────────────────────
-- Dashboard inbox for George — new signups, pending approvals, system alerts.

CREATE TABLE public.admin_notifications (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  type       text        NOT NULL CHECK (type IN ('new_signup', 'approval_needed', 'system')),
  title      text        NOT NULL,
  message    text,
  is_read    boolean     NOT NULL DEFAULT false,
  member_id  uuid        REFERENCES public.members(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.admin_notifications IS
  'Action-required alerts for admin dashboard. Think of it as a to-do list for George.';

-- ─── Admin Security Questions Table ────────────────────────────────────────
-- Fallback recovery: either admin can reset the other using security questions
-- if they lose email access. This was a locked decision (see CONTEXT.md).

CREATE TABLE public.admin_security_questions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  question      text        NOT NULL,
  answer_hash   text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.admin_security_questions IS
  'Security question/answer (hashed) per admin. Used for cross-admin account recovery.';

-- ─── Enable Row Level Security ─────────────────────────────────────────────
-- Enable immediately on all tables. Policies below define the actual rules.

ALTER TABLE public.members                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_emails          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_security_questions ENABLE ROW LEVEL SECURITY;

-- ─── Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX members_user_id_idx
  ON public.members(user_id);

CREATE INDEX members_approval_status_idx
  ON public.members(approval_status);

CREATE INDEX admin_notifications_is_read_idx
  ON public.admin_notifications(is_read);

-- ─── RLS Policies: members ──────────────────────────────────────────────────

-- NOTE ON JWT CLAIM PATH:
-- Admin role is stored in app_metadata.role in Supabase Auth.
-- The JWT claim path (auth.jwt() -> 'app_metadata' ->> 'role') reads the nested
-- app_metadata object. If this doesn't match, check Supabase project settings —
-- some configurations promote the claim to top level: (auth.jwt() ->> 'role').
-- The nested path is used here per current Supabase documentation.

-- Members can read their own row (to see their own profile and approval status)
CREATE POLICY members_select_own
  ON public.members FOR SELECT
  USING (auth.uid() = user_id);

-- Any authenticated user can read approved members (needed for league table and name dropdown)
CREATE POLICY members_select_all_approved
  ON public.members FOR SELECT
  USING (approval_status = 'approved');

-- Admin can read ALL members regardless of status (for the members management page)
CREATE POLICY admins_select_all_members
  ON public.members FOR SELECT
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Admin can manually insert a member (for late joiners added by George)
CREATE POLICY admins_insert_members
  ON public.members FOR INSERT
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Admin can update members (approve/reject, set starting_points, change email)
CREATE POLICY admins_update_members
  ON public.members FOR UPDATE
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Admin can delete members (soft delete pattern should be preferred, but allow hard delete)
CREATE POLICY admins_delete_members
  ON public.members FOR DELETE
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ─── RLS Policies: blocked_emails ───────────────────────────────────────────

-- Only admins can manage blocked emails
CREATE POLICY admins_all_blocked_emails
  ON public.blocked_emails FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ─── RLS Policies: admin_notifications ──────────────────────────────────────

-- Only admins can read and manage notifications
CREATE POLICY admins_all_notifications
  ON public.admin_notifications FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ─── RLS Policies: admin_security_questions ─────────────────────────────────

-- Admin can read their own security question (to answer it during recovery setup)
CREATE POLICY admins_select_own_questions
  ON public.admin_security_questions FOR SELECT
  USING (auth.uid() = admin_user_id);

-- Admin can manage their own security question (create/update/delete)
CREATE POLICY admins_manage_own_questions
  ON public.admin_security_questions FOR ALL
  USING (auth.uid() = admin_user_id)
  WITH CHECK (auth.uid() = admin_user_id);

-- Either admin can read the OTHER admin's question text for recovery verification
-- (so George can answer Dave's security question if Dave loses email access, and vice versa)
CREATE POLICY admins_verify_other_questions
  ON public.admin_security_questions FOR SELECT
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ─── Postgres Trigger: Auto-create members row on signup ────────────────────
-- When a user signs up via Supabase Auth, this trigger automatically:
--   1. Creates their row in public.members with pending approval_status
--   2. Creates an admin_notifications row so George sees the new signup in his dashboard

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Create the member row (approval_status defaults to 'pending')
  INSERT INTO public.members (user_id, email, display_name, email_opt_in, approval_status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'display_name')::text, 'Unknown'),
    COALESCE((NEW.raw_user_meta_data->>'email_opt_in')::boolean, true),
    'pending'
  );

  -- Create admin notification for the new signup
  INSERT INTO public.admin_notifications (type, title, message, member_id)
  VALUES (
    'new_signup',
    'New signup: ' || COALESCE((NEW.raw_user_meta_data->>'display_name')::text, NEW.email),
    NEW.email || ' has registered and is waiting for approval.',
    (SELECT id FROM public.members WHERE user_id = NEW.id)
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
