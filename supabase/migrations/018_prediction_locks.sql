-- ─── Migration 018: prediction_locks table ────────────────────────────────────
-- When a member presses the "Copy my picks to WhatsApp" button on the
-- predictions page, their picks for that gameweek lock permanently.
--
-- The lock is advisory: existing predictions stay editable by the server only
-- if George (admin) clears the lock. For members, the server action
-- submitPredictions checks this table and rejects any write once a lock row
-- exists for (gameweek, member).

BEGIN;

CREATE TABLE IF NOT EXISTS public.prediction_locks (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  gameweek_id  uuid        NOT NULL REFERENCES public.gameweeks(id) ON DELETE CASCADE,
  member_id    uuid        NOT NULL REFERENCES public.members(id)  ON DELETE CASCADE,
  locked_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gameweek_id, member_id)
);

COMMENT ON TABLE public.prediction_locks IS
  'Per-member, per-gameweek predictions lock set when member taps "Copy to WhatsApp".';

CREATE INDEX IF NOT EXISTS prediction_locks_member_idx
  ON public.prediction_locks (member_id);

ALTER TABLE public.prediction_locks ENABLE ROW LEVEL SECURITY;

-- Members can read their own lock rows (to render the locked UI state).
DROP POLICY IF EXISTS prediction_locks_select_own ON public.prediction_locks;
CREATE POLICY prediction_locks_select_own ON public.prediction_locks
  FOR SELECT
  USING (
    member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
  );

-- Members can only insert a lock for themselves.
DROP POLICY IF EXISTS prediction_locks_insert_own ON public.prediction_locks;
CREATE POLICY prediction_locks_insert_own ON public.prediction_locks
  FOR INSERT
  WITH CHECK (
    member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
  );

-- No update/delete policy for members — only admin via service role may clear.

COMMIT;
