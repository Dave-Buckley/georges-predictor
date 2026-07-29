-- ─── Migration 026: archive removed members for 10+ years ────────────────────
-- Removing a member used to be a hard delete: the auth user went, the members
-- row cascaded, and every prediction, score, pre-season pick, prize and
-- adjustment cascaded with it. Their whole competition history was gone.
--
-- That conflicts with keeping past participants on record (hall of fame, and
-- letting someone rejoin a later season with their history intact). This table
-- keeps a full snapshot of everything a member ever did, and is deliberately
-- NOT linked to public.members by a foreign key — so it survives the delete
-- that follows it.
--
-- `retain_until` defaults to 10 years out. Nothing deletes on that date; it is
-- a documented floor for how long the row is kept, and a marker for any future
-- clean-up job to respect.
--
-- `snapshot` holds the member row plus every member-keyed table
-- (predictions, prediction_scores, pre_season_picks, prize_awards,
-- point_adjustments, bonus_awards, los_picks, los_competition_members,
-- prediction_locks) as captured at the moment of removal.

BEGIN;

CREATE TABLE IF NOT EXISTS public.archived_members (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Intentionally NOT a foreign key: the members row is deleted right after.
  original_member_id uuid        NOT NULL,
  display_name       text        NOT NULL,
  email              text,
  starting_points    integer     NOT NULL DEFAULT 0,
  archived_at        timestamptz NOT NULL DEFAULT now(),
  archived_by        uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  retain_until       date        NOT NULL DEFAULT ((now() + interval '10 years')::date),
  snapshot           jsonb       NOT NULL
);

COMMENT ON TABLE public.archived_members IS
  'Full history snapshot of every removed member. No FK to members by design — the members row is deleted immediately after this is written. Retained at least 10 years (see retain_until).';

COMMENT ON COLUMN public.archived_members.original_member_id IS
  'The members.id this snapshot was taken from. Not a foreign key — that row no longer exists.';

COMMENT ON COLUMN public.archived_members.retain_until IS
  'Documented retention floor (archived_at + 10 years). Nothing deletes automatically on this date.';

COMMENT ON COLUMN public.archived_members.snapshot IS
  'jsonb: { member, predictions, prediction_scores, pre_season_picks, prize_awards, point_adjustments, bonus_awards, los_picks, los_competition_members, prediction_locks }.';

-- Case-insensitive name lookup, so a returning player can be matched back to
-- their archived history if they rejoin in a later season.
CREATE INDEX IF NOT EXISTS archived_members_display_name_idx
  ON public.archived_members (lower(trim(display_name)));

CREATE INDEX IF NOT EXISTS archived_members_archived_at_idx
  ON public.archived_members (archived_at DESC);

ALTER TABLE public.archived_members ENABLE ROW LEVEL SECURITY;

-- Admin-only. The service-role key used by the server action bypasses RLS.
-- Dropped first so the whole migration is safe to run more than once.
DROP POLICY IF EXISTS archived_members_admin_all ON public.archived_members;

CREATE POLICY archived_members_admin_all
  ON public.archived_members FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

COMMIT;
