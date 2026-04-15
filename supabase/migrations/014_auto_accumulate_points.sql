-- ============================================================
-- George's Predictor — Auto-accumulate weekly points
-- ============================================================
-- Adds:
--   - gameweeks.points_applied   (bool) — whether this GW's weekly points
--                                  have been rolled into members.starting_points.
--
-- Behaviour change:
--   closeGameweek() now adds each member's weekly points (predictions +
--   confirmed bonuses, ×2 if double_bubble) into members.starting_points
--   and flips points_applied = true.
--   reopenGameweek() reverses the same amounts and flips it back to false.
--
-- Backfill:
--   All currently-closed gameweeks are marked points_applied = true so the
--   next close/reopen does NOT re-apply what's already baked into the
--   starting_points totals admins have been maintaining manually.
--
-- Idempotent.
-- ============================================================

BEGIN;

ALTER TABLE public.gameweeks
  ADD COLUMN IF NOT EXISTS points_applied boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.gameweeks.points_applied IS
  'True once this gameweek''s weekly points have been added into members.starting_points. Prevents double-add on reopen/re-close.';

-- Backfill: every historical closed gameweek is considered already-applied.
-- This stops the new closeGameweek logic from double-counting weeks that
-- admins already baked into starting_points by hand.
UPDATE public.gameweeks
  SET points_applied = true
  WHERE closed_at IS NOT NULL
    AND points_applied = false;

COMMIT;
