-- ============================================================
-- 024_championship_2026_roster_fix.sql
-- ============================================================
-- Corrects the 2026-27 Championship roster (championship_teams, season=2026)
-- to match the real division as supplied by George.
--
-- The migration 023 seed carried a few stale clubs and was missing the
-- newly-promoted sides. This brings it to the actual 24-team 2026-27
-- Championship.
--
--   Remove : Leicester City, Oxford United, Sheffield Wednesday
--            (Leeds United was already absent)
--   Add    : Bolton Wanderers, Cardiff City, Lincoln City, Wrexham
--
-- Pure DML — safe to run via the apply script (scripts/apply-championship-2026-roster.ts).
-- Idempotent: deletes are no-ops if already gone; inserts guarded by the
-- (season, lower(btrim(name))) case-insensitive unique index.
-- ============================================================

BEGIN;

DELETE FROM public.championship_teams
WHERE season = 2026
  AND lower(btrim(name)) IN ('leicester city', 'oxford united', 'sheffield wednesday');

INSERT INTO public.championship_teams (season, name) VALUES
  (2026, 'Bolton Wanderers'),
  (2026, 'Cardiff City'),
  (2026, 'Lincoln City'),
  (2026, 'Wrexham')
ON CONFLICT DO NOTHING;

COMMIT;
