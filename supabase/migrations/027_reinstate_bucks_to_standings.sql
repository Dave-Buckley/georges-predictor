-- 027_reinstate_bucks_to_standings.sql
--
-- Reverses the "Bucks" exclusion applied by 022_exclude_from_standings.sql.
--
-- 022 flagged Bucks as a placeholder / admin-QA account so he could log in and
-- test without appearing as a competitor. For the 2026-27 season he is playing
-- for real, so he must appear in the league table like anyone else.
--
-- No points backfill is needed. exclude_from_standings only ever controlled
-- VISIBILITY:
--   - recalculateFixture() scores every prediction for a fixture with no
--     member filter, so his 10 GW1 predictions were already scored (80 pts).
--   - applyWeeklyToStartingPoints() likewise has no member filter, so future
--     gameweek closes will roll his weekly total up correctly.
--   - His starting_points is already 0 — the 2026-27 reset skipped excluded
--     members, but he had nothing carried over to zero.
-- Flipping the flag is therefore sufficient; the standings page recomputes
-- his running total from prediction_scores on read.
--
-- Idempotent.

UPDATE public.members
SET exclude_from_standings = false
WHERE email = 'dave.john.buckley@gmail.com'
   OR display_name ILIKE 'Bucks';

-- This migration changes VISIBILITY only. It alters no one's points and no
-- one's Last One Standing status. LOS is handled separately, in
-- 028_bucks_los_gw1_eliminated.sql.
