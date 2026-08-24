-- 030_los_picks_active_members_only.sql
--
-- Stops an eliminated member writing a Last One Standing pick.
--
-- ─── The gap ────────────────────────────────────────────────────────────────
-- The app already blocks this in two places:
--   * prediction-form.tsx only renders the picker when
--     losContext.memberStatus === 'active'
--   * submitPredictions computes `memberIsEligible` and silently drops
--     losTeamId for anyone who is not active
--
-- But the RLS policies from migration 008 (los_picks_insert_own_before_kickoff
-- and los_picks_update_own_before_kickoff) only checked two things: that the
-- row belongs to the caller, and that the fixture has not kicked off. Neither
-- looks at competition status. A knocked-out member calling PostgREST directly
-- with their own JWT could therefore still insert a pick and quietly re-enter
-- the competition.
--
-- Not exploitable through the UI, but the database should enforce the rule
-- rather than trusting the client, so this adds the missing condition.
--
-- ─── "Until the next round" ─────────────────────────────────────────────────
-- No date logic is needed. Eligibility is simply "do you have an ACTIVE row in
-- this competition". When a cycle ends, resetCompetitionIfNeeded() inserts a
-- fresh status='active' row for every approved member in the NEW competition
-- (src/lib/los/round.ts), so everyone can pick again from that point — and the
-- eliminated rows stay attached to the old, now-complete competition.
--
-- Note the `los_picks.` qualification in the subqueries. It is required, not
-- stylistic: los_competition_members has columns of the same names, so an
-- unqualified `member_id` inside the EXISTS would bind to the inner table and
-- the check would compare a row against itself, passing for everyone.
--
-- Idempotent — drops and recreates both policies.

-- ─── INSERT ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS los_picks_insert_own_before_kickoff ON public.los_picks;

CREATE POLICY los_picks_insert_own_before_kickoff
  ON public.los_picks FOR INSERT
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
    -- NEW: must still be standing in this competition.
    AND EXISTS (
      SELECT 1 FROM public.los_competition_members lcm
      WHERE lcm.competition_id = los_picks.competition_id
        AND lcm.member_id      = los_picks.member_id
        AND lcm.status         = 'active'
    )
  );

-- ─── UPDATE ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS los_picks_update_own_before_kickoff ON public.los_picks;

CREATE POLICY los_picks_update_own_before_kickoff
  ON public.los_picks FOR UPDATE
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
    AND EXISTS (
      SELECT 1 FROM public.los_competition_members lcm
      WHERE lcm.competition_id = los_picks.competition_id
        AND lcm.member_id      = los_picks.member_id
        AND lcm.status         = 'active'
    )
  )
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
    AND EXISTS (
      SELECT 1 FROM public.los_competition_members lcm
      WHERE lcm.competition_id = los_picks.competition_id
        AND lcm.member_id      = los_picks.member_id
        AND lcm.status         = 'active'
    )
  );

-- The system still writes freely: runLosRound uses the service role, which
-- bypasses RLS, so round evaluation can continue to set outcomes on the picks
-- of members it is in the act of eliminating.
