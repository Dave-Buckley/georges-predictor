-- ============================================================
-- George's Predictor — Phase 10 Plan 01: Reports foundation schema
-- ============================================================
-- Adds:
--   - gameweeks.kickoff_backup_sent_at    (disaster-recovery backup timestamp)
--   - gameweeks.reports_sent_at           (weekly report send timestamp)
--   - members.email_weekly_personal       (per-member toggle — personal report)
--   - members.email_weekly_group          (per-member toggle — group report)
--   - member_report_log                   (send-per-member-per-gw-per-type ledger)
-- Extends:
--   - admin_notifications.type CHECK      (3 new: report_send_failed,
--                                          kickoff_backup_failed, report_render_failed)
--
-- Rationale: Phase 10 ships 4 artifact flavours (personal PDF, group PDF,
-- admin XLSX, kickoff-backup). Every send is idempotent via the
-- UNIQUE(member_id, gameweek_id, report_type) constraint on member_report_log.
-- Members opt out per flavour; George always receives the admin XLSX.
-- ============================================================

BEGIN;

-- ─── 1. gameweeks: backup + reports timestamps ──────────────────────────────
-- Nullable because gameweeks created before Phase 10 have no send history.
-- Populated by the orchestrator when a batch finishes.

ALTER TABLE public.gameweeks
  ADD COLUMN IF NOT EXISTS kickoff_backup_sent_at TIMESTAMPTZ NULL;

ALTER TABLE public.gameweeks
  ADD COLUMN IF NOT EXISTS reports_sent_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.gameweeks.kickoff_backup_sent_at IS
  'Timestamp the disaster-recovery backup document was sent to George at the first-fixture kickoff. NULL = not yet sent.';

COMMENT ON COLUMN public.gameweeks.reports_sent_at IS
  'Timestamp the weekly personal + group reports batch completed for this gameweek. NULL = not yet sent.';

-- ─── 2. members: per-flavour email opt-in toggles ───────────────────────────
-- Defaults to TRUE so existing members opt in automatically. George can flip
-- these via the member profile page (Plan 04). Independent of the legacy
-- members.email_opt_in master toggle — that one still gates ALL email.

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS email_weekly_personal BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS email_weekly_group BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.members.email_weekly_personal IS
  'Per-member opt-in for the personal weekly PDF. Independent of email_opt_in (master toggle).';

COMMENT ON COLUMN public.members.email_weekly_group IS
  'Per-member opt-in for the group standings weekly PDF. Independent of email_opt_in (master toggle).';

-- ─── 3. member_report_log: idempotent send ledger ───────────────────────────
-- One row per (member_id, gameweek_id, report_type) guarantees we never
-- double-send. Inserts are admin-client only (service role). RLS lets a
-- member read their own rows for self-service "did my report send?" UX.

CREATE TABLE IF NOT EXISTS public.member_report_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id    UUID        NOT NULL REFERENCES public.members(id)    ON DELETE CASCADE,
  gameweek_id  UUID        NOT NULL REFERENCES public.gameweeks(id)  ON DELETE CASCADE,
  report_type  TEXT        NOT NULL CHECK (report_type IN (
    'personal',
    'group',
    'admin_weekly',
    'kickoff_backup'
  )),
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  error        TEXT        NULL,
  UNIQUE (member_id, gameweek_id, report_type)
);

CREATE INDEX IF NOT EXISTS member_report_log_gameweek_type_idx
  ON public.member_report_log (gameweek_id, report_type);

COMMENT ON TABLE public.member_report_log IS
  'Idempotent send ledger for Phase 10 weekly reports. UNIQUE constraint on (member_id, gameweek_id, report_type) prevents double-sends across retries.';

-- ─── 4. RLS: members can read their own rows, admin-only writes ─────────────

ALTER TABLE public.member_report_log ENABLE ROW LEVEL SECURITY;

-- Member may SELECT their own send history (future self-service UX). The
-- admin client bypasses RLS so the orchestrator continues to work.
CREATE POLICY member_report_log_select_own
  ON public.member_report_log FOR SELECT
  USING (
    auth.uid() = (
      SELECT user_id FROM public.members WHERE id = member_report_log.member_id
    )
  );

-- Admin has full read access as well (for the /admin observability page).
CREATE POLICY member_report_log_admin_select
  ON public.member_report_log FOR SELECT
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- No INSERT / UPDATE / DELETE policies for session role — only the service
-- role (createAdminClient) may write, ensuring the send ledger is
-- tamper-proof from the client surface.

-- ─── 5. admin_notifications CHECK extension ─────────────────────────────────
-- Pitfall 7 ritual: drop + re-add with every prior type preserved. Must
-- match the canonical union in src/lib/supabase/types.ts (AdminNotificationType).
-- Sources: migrations 001 / 002 / 004 / 005 / 007 / 008 / 009.

ALTER TABLE public.admin_notifications
  DROP CONSTRAINT IF EXISTS admin_notifications_type_check;

ALTER TABLE public.admin_notifications
  ADD CONSTRAINT admin_notifications_type_check
  CHECK (type IN (
    -- Phase 1 original types
    'new_signup',
    'approval_needed',
    'system',
    -- Phase 2 fixture types
    'sync_failure',
    'fixture_rescheduled',
    'fixture_moved',
    -- Phase 4 scoring types
    'result_override',
    'scoring_complete',
    -- Phase 5 admin panel types
    'bonus_reminder',
    'gw_complete',
    'prize_triggered',
    'bonus_award_needed',
    -- Phase 7 import types
    'import_complete',
    -- Phase 8 LOS + H2H types
    'los_winner_found',
    'los_competition_started',
    'h2h_steal_detected',
    'h2h_steal_resolved',
    -- Phase 9 pre-season types
    'pre_season_all_correct',
    'pre_season_category_correct',
    'pre_season_awards_ready',
    -- Phase 10 reports types
    'report_send_failed',
    'kickoff_backup_failed',
    'report_render_failed'
  ));

COMMIT;
