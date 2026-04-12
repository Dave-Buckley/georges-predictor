-- ============================================================
-- George's Predictor — Phase 9 Plan 03: DB-backed Championship list
-- ============================================================
-- Adds:
--   - championship_teams  (per-season Championship team roster,
--                          admin-managed from /admin/pre-season)
-- Seeds:
--   - 24 teams for season=2025 (mirrors CHAMPIONSHIP_TEAMS_2025_26)
--
-- Rationale: Replaces the hardcoded CHAMPIONSHIP_TEAMS_2025_26 constant
-- with a DB table George can edit directly from the admin UI. Enables
-- one-button end-of-season rollover (swap 3 relegated PL teams into
-- Championship, 3 promoted Championship teams into PL) without dev help.
--
-- All members can SELECT (needed by member pre-season picker). Only
-- admin can INSERT/UPDATE/DELETE.
-- ============================================================

BEGIN;

-- ─── 1. championship_teams table ────────────────────────────────────────────
-- One row per (season, team). UNIQUE on (season, lower(trim(name))) so
-- George cannot accidentally add the same team twice with different
-- capitalisation / whitespace. Matches the case-insensitive comparison
-- pattern used throughout the codebase (handle_new_user, calculatePreSeasonPoints).

CREATE TABLE IF NOT EXISTS public.championship_teams (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  season      int         NOT NULL,
  name        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Case-insensitive uniqueness per season
CREATE UNIQUE INDEX IF NOT EXISTS championship_teams_season_name_ci_idx
  ON public.championship_teams (season, lower(btrim(name)));

CREATE INDEX IF NOT EXISTS championship_teams_season_idx
  ON public.championship_teams (season);

COMMENT ON TABLE public.championship_teams IS
  'Championship team roster per season. Admin-managed from /admin/pre-season. Replaces hardcoded CHAMPIONSHIP_TEAMS_2025_26 constant. End-of-season rollover swaps 3 relegated PL teams in + 3 promoted Championship teams out.';

-- ─── 2. RLS policies ────────────────────────────────────────────────────────

ALTER TABLE public.championship_teams ENABLE ROW LEVEL SECURITY;

-- Admin has full control (JWT app_metadata.role='admin' check — matches
-- migration 009 seasons policy shape).
CREATE POLICY championship_teams_admin_all
  ON public.championship_teams FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- All authenticated users can SELECT so the member pre-season picker can
-- render the option list.
CREATE POLICY championship_teams_select_all
  ON public.championship_teams FOR SELECT
  USING (true);

-- ─── 3. Seed 2025-26 Championship list ──────────────────────────────────────
-- Mirrors src/lib/teams/championship-2025-26.ts (Plan 01 starter list,
-- including Leeds United). Idempotent via ON CONFLICT DO NOTHING against
-- the case-insensitive unique index.

INSERT INTO public.championship_teams (season, name) VALUES
  (2025, 'Birmingham City'),
  (2025, 'Blackburn Rovers'),
  (2025, 'Bristol City'),
  (2025, 'Charlton Athletic'),
  (2025, 'Coventry City'),
  (2025, 'Derby County'),
  (2025, 'Hull City'),
  (2025, 'Ipswich Town'),
  (2025, 'Leeds United'),
  (2025, 'Leicester City'),
  (2025, 'Middlesbrough'),
  (2025, 'Millwall'),
  (2025, 'Norwich City'),
  (2025, 'Oxford United'),
  (2025, 'Portsmouth'),
  (2025, 'Preston North End'),
  (2025, 'Queens Park Rangers'),
  (2025, 'Sheffield United'),
  (2025, 'Sheffield Wednesday'),
  (2025, 'Southampton'),
  (2025, 'Stoke City'),
  (2025, 'Swansea City'),
  (2025, 'Watford'),
  (2025, 'West Bromwich Albion')
ON CONFLICT DO NOTHING;

COMMIT;
