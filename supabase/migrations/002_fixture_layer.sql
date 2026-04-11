-- ============================================================
-- George's Predictor — Phase 2 Fixture Layer
-- ============================================================
-- Adds: teams, gameweeks, fixtures, sync_log tables
-- Enables RLS on all tables with appropriate policies
-- Adds indexes and an updated_at trigger on fixtures
-- ============================================================

-- ─── Teams Table ─────────────────────────────────────────────────────────────
-- One row per Premier League club. Populated and updated by the sync engine.
-- external_id is the football-data.org team ID (unique, used for idempotent upserts).

CREATE TABLE public.teams (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id int         NOT NULL UNIQUE,
  name        text        NOT NULL,
  short_name  text,
  tla         text,
  crest_url   text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.teams IS
  'Premier League clubs. Populated by football-data.org sync. external_id is the API team ID.';

-- ─── Gameweeks Table ─────────────────────────────────────────────────────────
-- One row per matchday (1-38). Season is the start year (e.g., 2025 for 2025/26).

CREATE TABLE public.gameweeks (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  number     int         NOT NULL UNIQUE CHECK (number BETWEEN 1 AND 38),
  season     int         NOT NULL,
  status     text        NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'active', 'complete')),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.gameweeks IS
  'Matchdays 1-38. Status tracks lifecycle for UI and scoring logic.';

-- ─── Fixtures Table ───────────────────────────────────────────────────────────
-- One row per match. external_id is the football-data.org match ID.
-- kickoff_time is stored as UTC timestamptz; display converts to Europe/London.

CREATE TABLE public.fixtures (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id    int         NOT NULL UNIQUE,
  gameweek_id    uuid        NOT NULL REFERENCES public.gameweeks(id) ON DELETE RESTRICT,
  home_team_id   uuid        NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  away_team_id   uuid        NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  kickoff_time   timestamptz NOT NULL,
  status         text        NOT NULL DEFAULT 'SCHEDULED'
    CHECK (status IN (
      'SCHEDULED', 'TIMED', 'IN_PLAY', 'PAUSED',
      'FINISHED', 'POSTPONED', 'SUSPENDED', 'CANCELLED', 'AWARDED'
    )),
  is_rescheduled boolean     NOT NULL DEFAULT false,
  home_score     int,
  away_score     int,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.fixtures IS
  'All 380 PL fixtures. kickoff_time in UTC. is_rescheduled flags API date changes.';

-- ─── Sync Log Table ───────────────────────────────────────────────────────────
-- One row per sync attempt. Used for first-sync-on-deploy detection and audit trail.

CREATE TABLE public.sync_log (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  synced_at        timestamptz NOT NULL DEFAULT now(),
  success          boolean     NOT NULL,
  fixtures_updated int         NOT NULL DEFAULT 0,
  error_message    text
);

COMMENT ON TABLE public.sync_log IS
  'Audit log of every fixture sync attempt. Empty table signals first-deploy state.';

-- ─── Enable Row Level Security ────────────────────────────────────────────────

ALTER TABLE public.teams      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gameweeks  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixtures   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_log   ENABLE ROW LEVEL SECURITY;

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX fixtures_gameweek_id_idx    ON public.fixtures(gameweek_id);
CREATE INDEX fixtures_home_team_id_idx   ON public.fixtures(home_team_id);
CREATE INDEX fixtures_away_team_id_idx   ON public.fixtures(away_team_id);
CREATE INDEX fixtures_kickoff_time_idx   ON public.fixtures(kickoff_time);
CREATE INDEX fixtures_status_idx         ON public.fixtures(status);

-- ─── updated_at Trigger ───────────────────────────────────────────────────────
-- Automatically sets updated_at to now() when a fixtures row is changed.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER fixtures_set_updated_at
  BEFORE UPDATE ON public.fixtures
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER teams_set_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS Policies: teams ──────────────────────────────────────────────────────

-- All authenticated users can read teams (public competition data)
CREATE POLICY teams_select_authenticated
  ON public.teams FOR SELECT
  USING (auth.role() = 'authenticated');

-- Admin can insert/update/delete teams (sync engine uses service role which bypasses RLS)
CREATE POLICY teams_write_admin
  ON public.teams FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ─── RLS Policies: gameweeks ──────────────────────────────────────────────────

-- All authenticated users can read gameweeks
CREATE POLICY gameweeks_select_authenticated
  ON public.gameweeks FOR SELECT
  USING (auth.role() = 'authenticated');

-- Admin only for modifications
CREATE POLICY gameweeks_write_admin
  ON public.gameweeks FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ─── RLS Policies: fixtures ───────────────────────────────────────────────────

-- All authenticated users can read fixtures
CREATE POLICY fixtures_select_authenticated
  ON public.fixtures FOR SELECT
  USING (auth.role() = 'authenticated');

-- Admin can insert fixtures
CREATE POLICY fixtures_insert_admin
  ON public.fixtures FOR INSERT
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Admin can delete fixtures
CREATE POLICY fixtures_delete_admin
  ON public.fixtures FOR DELETE
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Prevent non-admin fixture modifications after kickoff (defence-in-depth).
-- Admin client uses service role which bypasses RLS entirely, so sync ops are unaffected.
-- This policy only applies to JWT-authenticated requests (admin dashboard manual edits).
CREATE POLICY fixtures_no_edit_after_kickoff
  ON public.fixtures FOR UPDATE
  USING (
    kickoff_time > now()
    OR EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = auth.uid()
        AND m.role = 'admin'
    )
  );

-- ─── RLS Policies: sync_log ───────────────────────────────────────────────────

-- Sync log is admin-only (read and write)
CREATE POLICY sync_log_admin_all
  ON public.sync_log FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ============================================================
-- PREDICTION LOCKOUT RLS POLICY
-- Phase 3 migration MUST include this policy on the predictions table.
-- It is defined here to document the FIX-03 contract.
-- ============================================================
-- CREATE POLICY predictions_insert_before_kickoff
--   ON public.predictions FOR INSERT
--   WITH CHECK (
--     EXISTS (
--       SELECT 1 FROM public.fixtures f
--       WHERE f.id = fixture_id
--         AND f.kickoff_time > now()
--     )
--   );
--
-- CREATE POLICY predictions_update_before_kickoff
--   ON public.predictions FOR UPDATE
--   USING (
--     EXISTS (
--       SELECT 1 FROM public.fixtures f
--       WHERE f.id = fixture_id
--         AND f.kickoff_time > now()
--     )
--   );
