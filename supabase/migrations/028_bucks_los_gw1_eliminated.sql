-- 028_bucks_los_gw1_eliminated.sql
--
-- Records Bucks as ELIMINATED at round 1 of Last One Standing (season 2026,
-- competition_num 1), on a losing pick.
--
-- Why this exists
--   027 returned Bucks to the league table. He had submitted GW1 predictions
--   (80 pts) but no LOS pick — enrolMemberInActiveLos() skips members flagged
--   exclude_from_standings, so he was never in the cycle to pick at all. By
--   the time this was noticed, cycle 1's GW1 round had already resolved.
--
--   Joining as 'active' would have made him a survivor of a round he did not
--   play, at the expense of the 17 members eliminated fairly. That was
--   rejected as unfair. This migration takes the opposite route: he enters the
--   cycle already out, exactly as if his round-1 pick had lost.
--
-- Honesty of the record — stated plainly rather than hidden:
--   This pick was entered after GW1 finished. It was NOT submitted before the
--   deadline. `created_at` is left at its real insert time (not back-dated) so
--   the audit trail shows when the row was actually written. The team chosen
--   is Manchester United, away at Hull City — the side Bucks genuinely backed
--   in his submitted GW1 predictions (he predicted 0-2 to United). United lost
--   2-0, so the pick is a loss under the normal rules.
--
-- Effect on the live competition: none beyond adding one eliminated member.
--   Survivor count is unchanged at 32, so shouldResetCompetition() and the
--   winner logic are unaffected. Eliminated goes 17 -> 18, roster 49 -> 50.
--
-- The outcome below was produced by evaluateLosPick(), not hand-asserted:
--   direction='H' (Hull won), picked team is away => won=false => 'lose'.
--
-- Idempotent: los_picks has UNIQUE (competition_id, member_id, gameweek_id)
-- and the roster insert is guarded, so a re-run is a no-op. It must never
-- overwrite an existing status.

-- 1. The round-1 pick: Man United away at Hull, evaluated as a loss.
INSERT INTO public.los_picks
  (competition_id, member_id, gameweek_id, team_id, fixture_id, outcome, evaluated_at)
SELECT
  c.id, m.id, g.id, t.id, f.id, 'lose',
  (SELECT p.evaluated_at FROM public.los_picks p WHERE p.gameweek_id = g.id LIMIT 1)
FROM public.los_competitions c
CROSS JOIN public.members    m
CROSS JOIN public.gameweeks  g
CROSS JOIN public.teams      t
CROSS JOIN public.fixtures   f
WHERE c.season = 2026 AND c.competition_num = 1 AND c.status = 'active'
  AND m.email = 'dave.john.buckley@gmail.com'
  AND g.number = 1
  AND t.name = 'Manchester United FC'
  AND f.gameweek_id = g.id
  AND f.away_team_id = t.id
ON CONFLICT (competition_id, member_id, gameweek_id) DO NOTHING;

-- 2. The roster row: in the cycle, already out at GW1.
INSERT INTO public.los_competition_members
  (competition_id, member_id, status, eliminated_at_gw, eliminated_reason)
SELECT c.id, m.id, 'eliminated', 1, 'lose'
FROM public.los_competitions c
CROSS JOIN public.members m
WHERE c.season = 2026 AND c.competition_num = 1 AND c.status = 'active'
  AND m.email = 'dave.john.buckley@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM public.los_competition_members x
    WHERE x.competition_id = c.id AND x.member_id = m.id
  );
