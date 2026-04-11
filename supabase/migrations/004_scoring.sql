-- ─── Migration 004: Scoring Engine ───────────────────────────────────────────
-- Creates:
--   - prediction_scores table (permanent per-prediction breakdown)
--   - result_overrides table  (audit log for admin manual result changes)
-- Modifies:
--   - fixtures table: adds result_source column

-- ─── prediction_scores ───────────────────────────────────────────────────────
-- One row per prediction, upserted every time recalculateFixture runs.
-- The UNIQUE constraint on prediction_id makes upserts idempotent.

CREATE TABLE public.prediction_scores (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id   uuid        NOT NULL REFERENCES public.predictions(id) ON DELETE CASCADE,
  fixture_id      uuid        NOT NULL REFERENCES public.fixtures(id)   ON DELETE CASCADE,
  member_id       uuid        NOT NULL REFERENCES public.members(id)    ON DELETE CASCADE,
  predicted_home  int         NOT NULL,
  predicted_away  int         NOT NULL,
  actual_home     int         NOT NULL,
  actual_away     int         NOT NULL,
  result_correct  boolean     NOT NULL,
  score_correct   boolean     NOT NULL,
  points_awarded  int         NOT NULL CHECK (points_awarded IN (0, 10, 30)),
  calculated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prediction_id)
);

-- Indexes for common queries (leaderboard, member history, fixture results)
CREATE INDEX idx_prediction_scores_fixture        ON public.prediction_scores(fixture_id);
CREATE INDEX idx_prediction_scores_member         ON public.prediction_scores(member_id);
CREATE INDEX idx_prediction_scores_member_fixture ON public.prediction_scores(member_id, fixture_id);

-- Enable RLS
ALTER TABLE public.prediction_scores ENABLE ROW LEVEL SECURITY;

-- Members can read scores for fixtures that have kicked off
-- (visibility matches predictions: post kick-off only)
CREATE POLICY scores_select_post_kickoff
  ON public.prediction_scores FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.fixtures f
      WHERE f.id = fixture_id AND f.kickoff_time <= now()
    )
  );

-- Admin reads all scores (bypass kick-off filter)
CREATE POLICY scores_select_admin
  ON public.prediction_scores FOR SELECT
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- No member INSERT/UPDATE/DELETE on prediction_scores — system only via service role

-- ─── result_overrides ────────────────────────────────────────────────────────
-- Permanent audit log every time George manually corrects a result.
-- Never deleted — provides full history of score corrections.

CREATE TABLE public.result_overrides (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id                uuid        NOT NULL REFERENCES public.fixtures(id) ON DELETE CASCADE,
  changed_by                uuid        NOT NULL REFERENCES auth.users(id),
  old_home                  int,
  old_away                  int,
  new_home                  int         NOT NULL,
  new_away                  int         NOT NULL,
  predictions_recalculated  int         NOT NULL DEFAULT 0,
  created_at                timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on result_overrides
ALTER TABLE public.result_overrides ENABLE ROW LEVEL SECURITY;

-- Admin read only (audit log — George can review override history)
CREATE POLICY overrides_select_admin
  ON public.result_overrides FOR SELECT
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- No member access to audit log

-- ─── fixtures: add result_source ─────────────────────────────────────────────
-- Tracks whether a result came from the API feed or was set manually by George.
-- NULL = not yet set (fixture not finished).
-- 'api'    = populated by automated sync
-- 'manual' = set by George via override UI

ALTER TABLE public.fixtures
  ADD COLUMN IF NOT EXISTS result_source text CHECK (result_source IN ('api', 'manual'));
