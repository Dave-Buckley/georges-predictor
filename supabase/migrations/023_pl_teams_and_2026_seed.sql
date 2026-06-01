-- ============================================================
-- 023_pl_teams_and_2026_seed.sql
-- ============================================================
-- Adds the per-season `pl_teams` table (mirrors `championship_teams`)
-- and seeds the 2025-26 + 2026-27 Premier League / Championship rosters
-- to reflect real-world promotion/relegation:
--
--   2026-27 promoted to PL : Coventry City, Ipswich Town, Hull City
--   2026-27 relegated from PL: Wolves, Burnley, West Ham
--
-- Why a new `pl_teams` table instead of editing `teams`?
--   The `teams` table is the source of truth for FIXTURES (every 2025-26
--   match references its team UUID via ON DELETE RESTRICT). Deleting the
--   3 relegated PL clubs would break 38 fixtures each. `teams` is correctly
--   "every club that has ever had fixtures synced", while `pl_teams` is
--   "the picker source list for the pre-season window of season X" — a
--   separate, season-scoped concern.
--
-- Also: moves the 2026-27 gw1_kickoff deadline forward to 1 Aug 2026
-- (23:59 London = 22:59 UTC).
-- ============================================================

BEGIN;

-- ─── 1. pl_teams table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pl_teams (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  season      int         NOT NULL,
  name        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Case-insensitive uniqueness per season — matches championship_teams pattern.
CREATE UNIQUE INDEX IF NOT EXISTS pl_teams_season_name_ci_idx
  ON public.pl_teams (season, lower(btrim(name)));

CREATE INDEX IF NOT EXISTS pl_teams_season_idx
  ON public.pl_teams (season);

COMMENT ON TABLE public.pl_teams IS
  'Premier League roster per season. Source list for the pre-season picker (top4, tenth, relegated picks). Separate from `teams` (fixture data) so swapping promoted/relegated clubs does not break historical fixture FKs.';

-- ─── 2. RLS policies (mirror championship_teams) ───────────────────────────
ALTER TABLE public.pl_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY pl_teams_admin_all
  ON public.pl_teams FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY pl_teams_select_all
  ON public.pl_teams FOR SELECT
  USING (true);

-- ─── 3. Seed 2025-26 PL roster ──────────────────────────────────────────────
-- Mirrors the current 20 rows in `teams` exactly (football-data.org names).
-- Idempotent via the CI unique index.

INSERT INTO public.pl_teams (season, name) VALUES
  (2025, 'AFC Bournemouth'),
  (2025, 'Arsenal FC'),
  (2025, 'Aston Villa FC'),
  (2025, 'Brentford FC'),
  (2025, 'Brighton & Hove Albion FC'),
  (2025, 'Burnley FC'),
  (2025, 'Chelsea FC'),
  (2025, 'Crystal Palace FC'),
  (2025, 'Everton FC'),
  (2025, 'Fulham FC'),
  (2025, 'Leeds United FC'),
  (2025, 'Liverpool FC'),
  (2025, 'Manchester City FC'),
  (2025, 'Manchester United FC'),
  (2025, 'Newcastle United FC'),
  (2025, 'Nottingham Forest FC'),
  (2025, 'Sunderland AFC'),
  (2025, 'Tottenham Hotspur FC'),
  (2025, 'West Ham United FC'),
  (2025, 'Wolverhampton Wanderers FC')
ON CONFLICT DO NOTHING;

-- ─── 4. Seed 2026-27 PL roster ──────────────────────────────────────────────
-- 2025-26 list minus the 3 relegated, plus the 3 promoted.
-- Names use the football-data.org convention so they match `teams` when the
-- 2026-27 fixture sync starts populating fixtures.

INSERT INTO public.pl_teams (season, name) VALUES
  (2026, 'AFC Bournemouth'),
  (2026, 'Arsenal FC'),
  (2026, 'Aston Villa FC'),
  (2026, 'Brentford FC'),
  (2026, 'Brighton & Hove Albion FC'),
  (2026, 'Chelsea FC'),
  (2026, 'Coventry City FC'),
  (2026, 'Crystal Palace FC'),
  (2026, 'Everton FC'),
  (2026, 'Fulham FC'),
  (2026, 'Hull City AFC'),
  (2026, 'Ipswich Town FC'),
  (2026, 'Leeds United FC'),
  (2026, 'Liverpool FC'),
  (2026, 'Manchester City FC'),
  (2026, 'Manchester United FC'),
  (2026, 'Newcastle United FC'),
  (2026, 'Nottingham Forest FC'),
  (2026, 'Sunderland AFC'),
  (2026, 'Tottenham Hotspur FC')
ON CONFLICT DO NOTHING;

-- ─── 5. Seed 2026-27 Championship roster ────────────────────────────────────
-- 2025-26 Championship minus the 3 promoted to PL, plus the 3 relegated from
-- PL. Promotions/relegations between Championship and League One are NOT
-- reflected here — George can edit those via the admin /admin/pre-season UI.

INSERT INTO public.championship_teams (season, name) VALUES
  (2026, 'Birmingham City'),
  (2026, 'Blackburn Rovers'),
  (2026, 'Bristol City'),
  (2026, 'Burnley'),
  (2026, 'Charlton Athletic'),
  (2026, 'Derby County'),
  (2026, 'Leeds United'),
  (2026, 'Leicester City'),
  (2026, 'Middlesbrough'),
  (2026, 'Millwall'),
  (2026, 'Norwich City'),
  (2026, 'Oxford United'),
  (2026, 'Portsmouth'),
  (2026, 'Preston North End'),
  (2026, 'Queens Park Rangers'),
  (2026, 'Sheffield United'),
  (2026, 'Sheffield Wednesday'),
  (2026, 'Southampton'),
  (2026, 'Stoke City'),
  (2026, 'Swansea City'),
  (2026, 'Watford'),
  (2026, 'West Bromwich Albion'),
  (2026, 'West Ham United'),
  (2026, 'Wolverhampton Wanderers')
ON CONFLICT DO NOTHING;

-- ─── 6. Move the 2026-27 GW1 kickoff (= pre-season deadline) forward ───────
-- 1 Aug 2026 at 23:59 London (BST = UTC+1) = 22:59 UTC.

UPDATE public.seasons
SET gw1_kickoff = '2026-08-01 22:59:00+00'
WHERE season = 2026;

COMMIT;
