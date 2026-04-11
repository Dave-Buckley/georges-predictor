-- ============================================================
-- George's Predictor — Phase 3 Predictions Layer
-- ============================================================
-- Adds: predictions table with kick-off-gated RLS policies,
--       indexes, updated_at trigger, and submission count RPC
-- ============================================================

-- ─── Predictions Table ────────────────────────────────────────────────────────
-- One row per member prediction per fixture.
-- member_id + fixture_id is unique (upsert target).
-- home_score / away_score must be >= 0.

CREATE TABLE public.predictions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id    uuid        NOT NULL REFERENCES public.members(id)  ON DELETE CASCADE,
  fixture_id   uuid        NOT NULL REFERENCES public.fixtures(id) ON DELETE CASCADE,
  home_score   int         NOT NULL CHECK (home_score >= 0),
  away_score   int         NOT NULL CHECK (away_score >= 0),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, fixture_id)
);

COMMENT ON TABLE public.predictions IS
  'One row per member prediction per fixture. Unique on (member_id, fixture_id) for upsert idempotency.';

-- ─── Enable Row Level Security ────────────────────────────────────────────────

ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX predictions_member_id_idx  ON public.predictions(member_id);
CREATE INDEX predictions_fixture_id_idx ON public.predictions(fixture_id);

-- ─── updated_at Trigger ───────────────────────────────────────────────────────
-- Reuses the set_updated_at() function created in migration 002.

CREATE TRIGGER predictions_set_updated_at
  BEFORE UPDATE ON public.predictions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS Policy: INSERT — member owns row, fixture not yet kicked off ─────────
-- Members can only insert predictions for fixtures that haven't kicked off yet.
-- member_id must match the auth user's member row (server-side enforcement).

CREATE POLICY predictions_insert_before_kickoff
  ON public.predictions FOR INSERT
  WITH CHECK (
    member_id = (
      SELECT m.id FROM public.members m
      WHERE m.user_id = auth.uid()
        AND m.approval_status = 'approved'
      LIMIT 1
    )
    AND EXISTS (
      SELECT 1 FROM public.fixtures f
      WHERE f.id = fixture_id
        AND f.kickoff_time > now()
    )
  );

-- ─── RLS Policy: UPDATE — member owns row, fixture not yet kicked off ─────────
-- Members can update their own predictions only before kick-off.

CREATE POLICY predictions_update_before_kickoff
  ON public.predictions FOR UPDATE
  USING (
    member_id = (
      SELECT m.id FROM public.members m
      WHERE m.user_id = auth.uid()
        AND m.approval_status = 'approved'
      LIMIT 1
    )
    AND EXISTS (
      SELECT 1 FROM public.fixtures f
      WHERE f.id = fixture_id
        AND f.kickoff_time > now()
    )
  );

-- ─── RLS Policy: SELECT — member reads own predictions OR post-kickoff ────────
-- Context.md override of PRED-03:
--   Before kick-off: member can only see their own predictions.
--   After kick-off: all members can see all predictions for that fixture.
-- This enables the transparency reveal at kick-off time.

CREATE POLICY predictions_select_member
  ON public.predictions FOR SELECT
  USING (
    -- Always allow reading own predictions
    member_id = (
      SELECT m.id FROM public.members m
      WHERE m.user_id = auth.uid()
      LIMIT 1
    )
    OR
    -- Allow reading any prediction once the fixture has kicked off
    EXISTS (
      SELECT 1 FROM public.fixtures f
      WHERE f.id = fixture_id
        AND f.kickoff_time <= now()
    )
  );

-- ─── RLS Policy: SELECT — admin reads all predictions at any time ─────────────

CREATE POLICY predictions_select_admin
  ON public.predictions FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- ─── RPC: get_gameweek_submission_count ───────────────────────────────────────
-- Returns how many distinct members have submitted at least one prediction
-- for any fixture in the given gameweek, alongside the total approved member count.
-- Used by the member gameweek page to show "34 of 48 members have submitted".

CREATE OR REPLACE FUNCTION public.get_gameweek_submission_count(gw_id uuid)
RETURNS TABLE (submitted_count bigint, total_members bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    COUNT(DISTINCT p.member_id)::bigint AS submitted_count,
    (SELECT COUNT(*)::bigint FROM public.members WHERE approval_status = 'approved') AS total_members
  FROM public.predictions p
  JOIN public.fixtures f ON f.id = p.fixture_id
  WHERE f.gameweek_id = gw_id;
$$;

COMMENT ON FUNCTION public.get_gameweek_submission_count(uuid) IS
  'Returns (submitted_count, total_members) for a gameweek. Used for "N of M members submitted" UI.';
