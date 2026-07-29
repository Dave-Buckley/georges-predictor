-- ============================================================
-- 025 — prize_awards.member_id: add ON DELETE CASCADE
-- ============================================================
--
-- prize_awards.member_id was declared in 005_admin_panel.sql as a plain
-- REFERENCES with no ON DELETE rule, so it defaults to NO ACTION. That means
-- Postgres refuses to delete any member who has ever been awarded a prize —
-- including through the auth.users -> members cascade — and the admin panel
-- surfaces it as a bare "Failed to remove member. Please try again."
--
-- Every other member-owned table (predictions, prediction_scores,
-- pre_season_picks, los_picks, point_adjustments, ...) already uses
-- ON DELETE CASCADE. This brings prize_awards in line.
--
-- Group prizes (member_id IS NULL) are untouched — CASCADE only removes rows
-- whose member_id matches the deleted member.
--
-- Safe to run more than once.

ALTER TABLE public.prize_awards
  DROP CONSTRAINT IF EXISTS prize_awards_member_id_fkey;

ALTER TABLE public.prize_awards
  ADD CONSTRAINT prize_awards_member_id_fkey
  FOREIGN KEY (member_id)
  REFERENCES public.members(id)
  ON DELETE CASCADE;

COMMENT ON CONSTRAINT prize_awards_member_id_fkey ON public.prize_awards IS
  'ON DELETE CASCADE so removing a member does not fail on their prize history. Group prizes keep member_id NULL.';
