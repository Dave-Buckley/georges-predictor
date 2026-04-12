-- ============================================================
-- George's Predictor — Phase 7: Mid-Season Import
-- ============================================================
-- Adds:
--   1. members.updated_at column
--   2. pre_season_picks table (text-based team names, not UUID FKs)
--   3. Updated handle_new_user trigger — links imported placeholder rows
--      when a real member registers with the same display_name
-- ============================================================

-- ─── 1. Add updated_at to members ───────────────────────────────────────────

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Backfill: set updated_at to created_at for existing rows
UPDATE public.members
  SET updated_at = created_at
  WHERE updated_at IS NULL;

-- ─── 2. pre_season_picks table ───────────────────────────────────────────────
-- One row per member per season — their pre-season predictions.
-- Evaluated by Phase 9 at season end.
-- Stores team names as text (not UUID FKs) because promoted Championship
-- teams may not exist in the teams table (which tracks PL teams only).

CREATE TABLE IF NOT EXISTS public.pre_season_picks (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id               uuid        NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  season                  int         NOT NULL,
  -- Top 4 (order matters for tiebreaker scoring in Phase 9)
  top4                    text[]      NOT NULL DEFAULT '{}',
  -- 10th place prediction
  tenth_place             text,
  -- Bottom 3 relegated (order doesn't matter for Phase 9 scoring)
  relegated               text[]      NOT NULL DEFAULT '{}',
  -- Promoted from Championship (3 teams)
  promoted                text[]      NOT NULL DEFAULT '{}',
  -- Championship promotion playoff winner (1 team)
  promoted_playoff_winner text,
  -- Metadata
  imported_by             uuid        REFERENCES auth.users(id),
  imported_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, season)
);

COMMENT ON TABLE public.pre_season_picks IS
  'One row per member per season — their pre-season predictions. Evaluated by Phase 9 at season end.';

COMMENT ON COLUMN public.pre_season_picks.top4 IS
  'Ordered array of up to 4 team names. Order matters for tiebreaker scoring in Phase 9.';

COMMENT ON COLUMN public.pre_season_picks.relegated IS
  'Array of up to 3 team names predicted to be relegated. Order does not matter.';

COMMENT ON COLUMN public.pre_season_picks.promoted IS
  'Array of up to 3 Championship teams predicted to be promoted. Stored as text (not UUID) since Championship teams may not be in the teams table.';

-- ─── Enable RLS on pre_season_picks ─────────────────────────────────────────

ALTER TABLE public.pre_season_picks ENABLE ROW LEVEL SECURITY;

-- Admins can do everything (needed for import action)
CREATE POLICY pre_season_picks_admin_all
  ON public.pre_season_picks FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Members can only select their own pre-season picks
CREATE POLICY pre_season_picks_member_select_own
  ON public.pre_season_picks FOR SELECT
  USING (
    member_id = (
      SELECT id FROM public.members WHERE user_id = auth.uid() LIMIT 1
    )
  );

-- ─── 3. Updated handle_new_user trigger ──────────────────────────────────────
-- The updated trigger checks for an existing user_id IS NULL placeholder row
-- with the same display_name (case-insensitive). If found: UPDATE to link the
-- new auth user to the imported row (preserving starting_points). If not found:
-- INSERT as before.
--
-- Critical for mid-season import: ensures imported placeholder members are
-- claimed correctly when real members register and pick their name.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_display_name  text;
  v_email_opt_in  boolean;
  v_existing_id   uuid;
  v_member_id     uuid;
BEGIN
  v_display_name := COALESCE((NEW.raw_user_meta_data->>'display_name')::text, 'Unknown');
  v_email_opt_in := COALESCE((NEW.raw_user_meta_data->>'email_opt_in')::boolean, true);

  -- Check if an imported placeholder row exists with this display_name (case-insensitive)
  SELECT id INTO v_existing_id
  FROM public.members
  WHERE lower(trim(display_name)) = lower(trim(v_display_name))
    AND user_id IS NULL
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- Claim the imported row by linking the new auth user
    -- Preserves starting_points (already set by import)
    -- approval_status remains 'pending' — George still must approve
    UPDATE public.members
    SET
      user_id      = NEW.id,
      email        = NEW.email,
      email_opt_in = v_email_opt_in,
      updated_at   = now()
    WHERE id = v_existing_id;

    v_member_id := v_existing_id;
  ELSE
    -- Brand new member — insert as before
    INSERT INTO public.members (user_id, email, display_name, email_opt_in, approval_status, updated_at)
    VALUES (NEW.id, NEW.email, v_display_name, v_email_opt_in, 'pending', now());

    v_member_id := (SELECT id FROM public.members WHERE user_id = NEW.id);
  END IF;

  -- Create admin notification for the new signup
  INSERT INTO public.admin_notifications (type, title, message, member_id)
  VALUES (
    'new_signup',
    'New signup: ' || v_display_name,
    NEW.email || ' has registered and is waiting for approval.',
    v_member_id
  );

  RETURN NEW;
END;
$$;
