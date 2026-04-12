-- ============================================================
-- George's Predictor — Phase 8 Last One Standing + Head-to-Head
-- ============================================================
-- Adds:
--   - los_competitions            (one LOS competition cycle; at most one active at a time)
--   - los_competition_members     (per-member status within a competition cycle)
--   - los_picks                   (one team pick per member per gameweek)
--   - h2h_steals                  (weekly head-to-head tie detection + resolution)
-- Modifies:
--   - admin_notifications CHECK   extends to include Phase 8 notification types
--
-- All tables RLS-enabled. Orchestration (competition reset, pick evaluation, steal
-- resolution) is application-level — no triggers (see Pitfall 5 in 08-RESEARCH.md).
-- ============================================================

BEGIN;

-- ─── los_competitions ────────────────────────────────────────────────────────
-- One row per Last One Standing competition cycle. A new cycle starts when the
-- prior cycle ends (single surviving winner). Only one cycle can be `active`
-- at any time (enforced by partial unique index below).

CREATE TABLE public.los_competitions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  season          int         NOT NULL,
  competition_num int         NOT NULL,
  status          text        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'complete')),
  starts_at_gw    int         NOT NULL,
  ended_at_gw     int,
  winner_id       uuid        REFERENCES public.members(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  ended_at        timestamptz,
  UNIQUE (season, competition_num)
);

COMMENT ON TABLE public.los_competitions IS
  'Last One Standing competition cycles. Only one may be active per season at any time.';

-- Enforce "at most one active LOS competition at a time" via partial unique index.
CREATE UNIQUE INDEX los_competitions_one_active
  ON public.los_competitions (status)
  WHERE status = 'active';

-- ─── los_competition_members ─────────────────────────────────────────────────
-- Per-member status within a specific LOS competition cycle.
-- A member is `active` until they lose, draw, miss a submission, or are
-- admin-overridden. Eliminated members stay rowed for audit + reinstate.

CREATE TABLE public.los_competition_members (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id     uuid        NOT NULL REFERENCES public.los_competitions(id) ON DELETE CASCADE,
  member_id          uuid        NOT NULL REFERENCES public.members(id)          ON DELETE CASCADE,
  status             text        NOT NULL DEFAULT 'active'
                                 CHECK (status IN ('active', 'eliminated')),
  eliminated_at_gw   int,
  eliminated_reason  text        CHECK (eliminated_reason IN ('draw', 'lose', 'missed', 'admin_override')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competition_id, member_id)
);

COMMENT ON TABLE public.los_competition_members IS
  'Per-member status within a single LOS competition cycle. Unique on (competition_id, member_id).';

CREATE INDEX los_competition_members_competition_idx ON public.los_competition_members(competition_id);
CREATE INDEX los_competition_members_member_idx      ON public.los_competition_members(member_id);

-- ─── los_picks ───────────────────────────────────────────────────────────────
-- One pick per active member per gameweek within a competition cycle.
-- team_id is the team the member has backed to win — never the same team
-- twice in the same cycle (enforced application-side via availableTeams).
-- ON DELETE RESTRICT on team_id/fixture_id so we never lose audit data.

CREATE TABLE public.los_picks (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id  uuid        NOT NULL REFERENCES public.los_competitions(id) ON DELETE CASCADE,
  member_id       uuid        NOT NULL REFERENCES public.members(id)          ON DELETE CASCADE,
  gameweek_id     uuid        NOT NULL REFERENCES public.gameweeks(id)        ON DELETE CASCADE,
  team_id         uuid        NOT NULL REFERENCES public.teams(id)            ON DELETE RESTRICT,
  fixture_id      uuid        NOT NULL REFERENCES public.fixtures(id)         ON DELETE RESTRICT,
  outcome         text        CHECK (outcome IN ('win', 'lose', 'draw', 'pending')),
  evaluated_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competition_id, member_id, gameweek_id)
);

COMMENT ON TABLE public.los_picks IS
  'LOS team picks. Source of truth for team-usage derivation. UPSERT on (competition_id, member_id, gameweek_id).';

CREATE INDEX los_picks_competition_member_idx ON public.los_picks(competition_id, member_id);
CREATE INDEX los_picks_fixture_idx            ON public.los_picks(fixture_id);

-- Reuse set_updated_at() from migration 002.
CREATE TRIGGER los_picks_set_updated_at
  BEFORE UPDATE ON public.los_picks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── h2h_steals ──────────────────────────────────────────────────────────────
-- One row per weekly head-to-head tie at position 1 or 2.
-- tied_member_ids captured at detection time; winner_ids populated at resolution
-- (next week). resolved_at=NULL means steal is still pending.

CREATE TABLE public.h2h_steals (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  detected_in_gw_id  uuid        NOT NULL REFERENCES public.gameweeks(id) ON DELETE CASCADE,
  resolves_in_gw_id  uuid        NOT NULL REFERENCES public.gameweeks(id) ON DELETE CASCADE,
  position           int         NOT NULL CHECK (position IN (1, 2)),
  tied_member_ids    uuid[]      NOT NULL,
  winner_ids         uuid[],
  resolved_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (detected_in_gw_id, position)
);

COMMENT ON TABLE public.h2h_steals IS
  'Weekly H2H steal records. One row per (detected_in_gw, position). winner_ids=NULL until resolved.';

CREATE INDEX h2h_steals_resolves_gw_idx ON public.h2h_steals(resolves_in_gw_id);

-- ─── admin_notifications CHECK extension ─────────────────────────────────────
-- Drop + re-add the type CHECK constraint with Phase 8 types added.
-- Must include ALL prior types from migrations 001/002/004/005.

ALTER TABLE public.admin_notifications
  DROP CONSTRAINT IF EXISTS admin_notifications_type_check;

ALTER TABLE public.admin_notifications
  ADD CONSTRAINT admin_notifications_type_check
  CHECK (type IN (
    -- Phase 1 original types
    'new_signup',
    'approval_needed',
    'system',
    -- Phase 2 fixture types
    'sync_failure',
    'fixture_rescheduled',
    'fixture_moved',
    -- Phase 4 scoring types
    'result_override',
    'scoring_complete',
    -- Phase 5 admin panel types
    'bonus_reminder',
    'gw_complete',
    'prize_triggered',
    'bonus_award_needed',
    -- Phase 7 import types
    'import_complete',
    -- Phase 8 LOS + H2H types
    'los_winner_found',
    'los_competition_started',
    'h2h_steal_detected',
    'h2h_steal_resolved'
  ));

-- ─── Enable Row Level Security ────────────────────────────────────────────────

ALTER TABLE public.los_competitions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.los_competition_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.los_picks               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.h2h_steals              ENABLE ROW LEVEL SECURITY;

-- ─── RLS Policies: los_competitions ──────────────────────────────────────────
-- Any authenticated user can see which competition is active (for UI).
-- Admin has full control.

CREATE POLICY los_competitions_select_authenticated
  ON public.los_competitions FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY los_competitions_admin_all
  ON public.los_competitions FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ─── RLS Policies: los_competition_members ──────────────────────────────────
-- A member sees their own row plus all other members' rows (public who-is-in).
-- Admin has full control.

CREATE POLICY los_competition_members_select_authenticated
  ON public.los_competition_members FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY los_competition_members_admin_all
  ON public.los_competition_members FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ─── RLS Policies: los_picks ─────────────────────────────────────────────────
-- Mirror the predictions kick-off-gated pattern exactly (migration 003).
-- INSERT: member owns row AND fixture has not kicked off yet.
-- UPDATE: same guard.
-- SELECT: own always; others' picks only once all fixtures in that gameweek
--         have kicked off (so you cannot spy on what your opponent picked).
-- SELECT (admin): sees everything at any time.

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
  );

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
  );

CREATE POLICY los_picks_select_member
  ON public.los_picks FOR SELECT
  USING (
    -- Always allow reading your own pick
    member_id = (
      SELECT m.id FROM public.members m
      WHERE m.user_id = auth.uid()
      LIMIT 1
    )
    OR
    -- Allow reading others' picks only after all fixtures in that gameweek have kicked off
    NOT EXISTS (
      SELECT 1 FROM public.fixtures f
      WHERE f.gameweek_id = los_picks.gameweek_id
        AND f.kickoff_time > now()
    )
  );

CREATE POLICY los_picks_select_admin
  ON public.los_picks FOR SELECT
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY los_picks_admin_all
  ON public.los_picks FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ─── RLS Policies: h2h_steals ────────────────────────────────────────────────
-- H2H steal records are public info (leaderboard visibility).
-- Admin has full control.

CREATE POLICY h2h_steals_select_authenticated
  ON public.h2h_steals FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY h2h_steals_admin_all
  ON public.h2h_steals FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

COMMIT;
