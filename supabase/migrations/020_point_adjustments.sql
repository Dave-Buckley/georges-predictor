-- ─── Migration 020: manual point adjustments ─────────────────────────────────
-- Lets the admin manually override a member's points. Two scopes:
--
--   • gameweek-scoped — delta rolls into that GW's weekly total alongside
--     predictions + bonuses (so Double Bubble ×2 applies). Safe to create
--     whether the GW is open, closed, or already applied — if it's already
--     applied, the server action also bumps members.starting_points by the
--     delta so the public standings reflect the change immediately.
--
--   • overall — delta is applied directly to members.starting_points and
--     logged here (gameweek_id = null) for audit.
--
-- `delta` is the final signed points delta (post-Double-Bubble). The reader
-- adds it to the weekly total AFTER the ×2 has been applied to predictions +
-- bonuses, so "new total = X" in the dialog matches what lands on the page.

BEGIN;

CREATE TABLE IF NOT EXISTS public.point_adjustments (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id     uuid        NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  gameweek_id   uuid        REFERENCES public.gameweeks(id) ON DELETE CASCADE,
  delta         integer     NOT NULL,
  note          text,
  created_by    uuid        REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.point_adjustments IS
  'Admin-issued manual point deltas. gameweek_id NULL = overall (starting_points) adjustment.';

COMMENT ON COLUMN public.point_adjustments.delta IS
  'Signed points delta. For gameweek-scoped rows, stored as the final delta after any Double-Bubble ×2 (i.e. it is added on top of the already-doubled prediction + bonus subtotal).';

CREATE INDEX IF NOT EXISTS point_adjustments_member_idx
  ON public.point_adjustments (member_id);

CREATE INDEX IF NOT EXISTS point_adjustments_gameweek_idx
  ON public.point_adjustments (gameweek_id)
  WHERE gameweek_id IS NOT NULL;

ALTER TABLE public.point_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY point_adjustments_admin_all
  ON public.point_adjustments FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

COMMIT;
