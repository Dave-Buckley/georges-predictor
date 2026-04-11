-- ─── Migration 006: Bonus Member RLS ─────────────────────────────────────────
-- Extends the bonus system for member-facing access:
--   1. Adds points_awarded column to bonus_awards (was missing from Phase 5)
--   2. Adds member RLS policy on bonus_schedule so members can see confirmed bonuses
--   3. Adds member RLS policies on bonus_awards (own rows only)
--
-- Note: Admin-only policies from migration 005 remain in place and are additive.
-- Service role bypasses all RLS — admin operations are unaffected.

BEGIN;

-- ─── bonus_awards: add points_awarded column ──────────────────────────────────
-- Stores the calculated bonus points for each member's award.
-- Defaults to 0 (pending/unconfirmed). Set during bonus calculation (Phase 6 Plan 03).

ALTER TABLE public.bonus_awards
  ADD COLUMN IF NOT EXISTS points_awarded int NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.bonus_awards.points_awarded IS
  'Calculated bonus points for this award. 0=pending/rejected, 20=standard, 60=Golden Glory exact score.';

-- ─── bonus_schedule: member SELECT policy ────────────────────────────────────
-- Members can only see bonus schedule rows that George has confirmed.
-- Unconfirmed bonuses are invisible to members until George approves them.

CREATE POLICY bonus_schedule_select_confirmed
  ON public.bonus_schedule
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND confirmed = true
  );

-- ─── bonus_awards: member INSERT policy ──────────────────────────────────────
-- Members can only insert their own bonus picks (member_id must match their member record).
-- The subquery resolves auth.uid() → members.user_id → members.id.

CREATE POLICY bonus_awards_insert_own
  ON public.bonus_awards
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND member_id = (
      SELECT id FROM public.members WHERE user_id = auth.uid() LIMIT 1
    )
  );

-- ─── bonus_awards: member UPDATE policy ──────────────────────────────────────
-- Members can only update their own bonus picks, and only while the award is still pending
-- (awarded IS NULL). Once George confirms or rejects, the pick is locked.

CREATE POLICY bonus_awards_update_own
  ON public.bonus_awards
  FOR UPDATE
  USING (
    auth.role() = 'authenticated'
    AND member_id = (
      SELECT id FROM public.members WHERE user_id = auth.uid() LIMIT 1
    )
    AND awarded IS NULL
  );

-- ─── bonus_awards: member SELECT policy ──────────────────────────────────────
-- Members can only see their own bonus award records.

CREATE POLICY bonus_awards_select_own
  ON public.bonus_awards
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND member_id = (
      SELECT id FROM public.members WHERE user_id = auth.uid() LIMIT 1
    )
  );

COMMIT;
