-- ─── Migration 021: widen bonus_awards.points_awarded CHECK ──────────────────
-- The previous constraint (migration 012) only allowed (0, 20, 60), matching
-- what the auto-calc engine produces for Golden Glory / Jose Park The Bus.
--
-- George's actual Golden Glory rule is 10pt / 30pt, so the admin UI now has
-- explicit "Approve 10pt" / "Approve 30pt" buttons. Those updates were being
-- rejected silently by the old CHECK. Widen the set to cover both schemes.

BEGIN;

ALTER TABLE public.bonus_awards
  DROP CONSTRAINT IF EXISTS bonus_awards_points_awarded_check;

ALTER TABLE public.bonus_awards
  ADD CONSTRAINT bonus_awards_points_awarded_check
  CHECK (points_awarded IN (0, 10, 20, 30, 60));

COMMIT;
