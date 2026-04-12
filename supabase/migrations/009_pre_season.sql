-- ============================================================
-- George's Predictor — Phase 9: Pre-Season Predictions
-- ============================================================
-- Adds:
--   - seasons                 (one row per season; holds GW1 kickoff + end-of-season actuals)
--   - pre_season_awards       (one row per (member, season) after George confirms)
-- Modifies:
--   - pre_season_picks        adds submitted_by_admin + submitted_at audit columns
--   - admin_notifications     CHECK extended with 3 new pre-season notification types
-- Seeds:
--   - seasons (2025, 2026)    so the app always has a row to evaluate lockout against
--
-- All tables RLS-enabled. Admin uses JWT app_metadata.role='admin' check.
-- Copies pre_season_picks admin-policy shape verbatim (migration 007 line 65 style).
-- CHECK constraint ritual preserves all prior types (Pitfall 7).
-- ============================================================

BEGIN;

-- ─── 1. seasons table ───────────────────────────────────────────────────────
-- Single source of truth for:
--   (a) GW1 kickoff (pre-season submission lockout gate)
--   (b) End-of-season actuals (used by calculatePreSeasonPoints at season end)
-- Actuals columns nullable until George populates at season end.

CREATE TABLE IF NOT EXISTS public.seasons (
  id                    serial      PRIMARY KEY,
  season                int         NOT NULL UNIQUE,             -- e.g., 2025 for the 2025-26 season
  label                 text        NOT NULL,                    -- "2025-26"
  gw1_kickoff           timestamptz NOT NULL,
  -- Season-end actuals (nullable until George populates at season end)
  final_top4            text[]      NOT NULL DEFAULT '{}',
  final_tenth           text,
  final_relegated       text[]      NOT NULL DEFAULT '{}',
  final_promoted        text[]      NOT NULL DEFAULT '{}',
  final_playoff_winner  text,
  actuals_locked_at     timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.seasons IS
  'One row per season. gw1_kickoff gates pre-season submission lockout. Actuals populated by admin at season end for Phase 9 scoring.';

COMMENT ON COLUMN public.seasons.season IS
  'Season year (e.g., 2025 for 2025-26). UNIQUE so we never double-seed.';

COMMENT ON COLUMN public.seasons.actuals_locked_at IS
  'Set when admin finalises season-end actuals. Null until then.';

-- ─── 2. pre_season_awards table ─────────────────────────────────────────────
-- One row per (member, season) — created when George confirms pre-season awards.
-- calculated_points = system value (30 × correct). awarded_points = George's final
-- number (may override). flags = jsonb with the 4 emit flags for notification UI.
-- Mirrors bonus_awards + prize_awards two-phase confirmation pattern (Phase 6/5).

CREATE TABLE IF NOT EXISTS public.pre_season_awards (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id          uuid        NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  season             int         NOT NULL,
  calculated_points  int         NOT NULL,
  awarded_points     int         NOT NULL,
  flags              jsonb       NOT NULL DEFAULT '{}'::jsonb,
  confirmed          boolean     NOT NULL DEFAULT false,
  confirmed_by       uuid        REFERENCES auth.users(id),
  confirmed_at       timestamptz,
  UNIQUE (member_id, season)
);

COMMENT ON TABLE public.pre_season_awards IS
  'Confirmed pre-season awards. One row per (member, season). Two-phase confirmation — nothing counts toward member totals until confirmed=true.';

COMMENT ON COLUMN public.pre_season_awards.flags IS
  'JSONB of emit flags: { all_top4_correct, all_relegated_correct, all_promoted_correct, all_correct_overall } — used to drive admin notification UI.';

CREATE INDEX pre_season_awards_season_idx ON public.pre_season_awards(season);
CREATE INDEX pre_season_awards_member_idx ON public.pre_season_awards(member_id);

-- ─── 3. pre_season_picks audit columns ──────────────────────────────────────
-- Tracks whether a pick row was entered by the member themselves (false) or
-- by an admin on their behalf (true) — needed for audit + late-joiner UX.

ALTER TABLE public.pre_season_picks
  ADD COLUMN IF NOT EXISTS submitted_by_admin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS submitted_at       timestamptz;

COMMENT ON COLUMN public.pre_season_picks.submitted_by_admin IS
  'True when row was entered by an admin on a late-joiner member''s behalf. False = self-submitted by the member.';

-- ─── 4. RLS on seasons + pre_season_awards ──────────────────────────────────

ALTER TABLE public.seasons           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pre_season_awards ENABLE ROW LEVEL SECURITY;

-- ─── RLS Policies: seasons ──────────────────────────────────────────────────
-- Admin has full control. Everyone (including anon) can SELECT so the
-- client-side lockout banner can read gw1_kickoff without an auth round-trip.

CREATE POLICY seasons_admin_all
  ON public.seasons FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY seasons_member_select
  ON public.seasons FOR SELECT
  USING (true);

-- ─── RLS Policies: pre_season_awards ────────────────────────────────────────
-- Admin has full control. Members only see their own row and only once it's
-- confirmed=true (pending awards remain private until George approves).

CREATE POLICY pre_season_awards_admin_all
  ON public.pre_season_awards FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY pre_season_awards_member_select_own
  ON public.pre_season_awards FOR SELECT
  USING (
    confirmed = true
    AND member_id = (
      SELECT id FROM public.members WHERE user_id = auth.uid() LIMIT 1
    )
  );

-- ─── 5. admin_notifications CHECK extension ─────────────────────────────────
-- Drop + re-add the type CHECK with Phase 9 types added.
-- MUST include every prior type from migrations 001/002/004/005/007/008 —
-- otherwise existing rows fail the constraint check.

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
    'pre_season_awards_ready'
  ));

-- ─── 6. Seed current + upcoming seasons ─────────────────────────────────────
-- 2025-26 already in progress (GW1 kickoff 2025-08-15 19:00 UTC).
-- 2026-27 placeholder — developer updates gw1_kickoff before the 2026 pre-season
-- window opens. ON CONFLICT DO NOTHING keeps the migration idempotent.

INSERT INTO public.seasons (season, label, gw1_kickoff) VALUES
  (2025, '2025-26', '2025-08-15 19:00:00+00'),
  (2026, '2026-27', '2026-08-14 19:00:00+00')
ON CONFLICT (season) DO NOTHING;

COMMIT;
