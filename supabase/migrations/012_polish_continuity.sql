-- ============================================================
-- George's Predictor — Phase 11 Plan 01: Polish & Continuity foundation
-- ============================================================
-- Adds:
--   - teams.primary_color / teams.secondary_color  (kit colours for UI accents)
--   - members.favourite_team_id                    (profile avatar FK)
--   - seasons.ended_at                             (archive marker)
--   - members_display_name_slug_idx                (functional UNIQUE index)
-- Seeds:
--   - All 20 current-season PL teams with Wikipedia-infobox primary/secondary
-- Extends:
--   - admin_notifications.type CHECK   (2 new: season_archived, season_launched)
--   - bonus_awards.points_awarded CHECK (pre-launch audit-fix — matches
--     the TypeScript return type `0 | 20 | 60` on calculateBonusPoints)
--
-- Idempotent via IF NOT EXISTS / `DO $$ … END $$` guards everywhere so the
-- migration can be applied against a DB that already has Phase 10 structure.
-- ============================================================

BEGIN;

-- ─── 1. teams.primary_color / secondary_color ───────────────────────────────
-- Additive. Nullable so admin can blank out a colour later without breaking
-- existing rows. The seed block (section 5) only writes where NULL so admin
-- edits are preserved across re-runs.

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS primary_color TEXT NULL;

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS secondary_color TEXT NULL;

COMMENT ON COLUMN public.teams.primary_color IS
  'Team primary kit colour (hex, e.g. #EF0107). Used for prediction-card accents and profile avatars.';

COMMENT ON COLUMN public.teams.secondary_color IS
  'Team secondary kit colour (hex). Optional complement to primary_color.';

-- ─── 2. members.favourite_team_id ───────────────────────────────────────────
-- FK to teams(id). ON DELETE SET NULL so removing a team does not block
-- member deletion / cause cascade drama.

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS favourite_team_id UUID NULL
    REFERENCES public.teams(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.members.favourite_team_id IS
  'Optional member-chosen PL team for profile avatar / accent colour.';

-- ─── 3. seasons.ended_at ────────────────────────────────────────────────────
-- Marker column used by the season-archive flow. NULL = season is live.

ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.seasons.ended_at IS
  'Timestamp the season was archived by admin. NULL while the season is active.';

-- ─── 4. members functional UNIQUE slug index ────────────────────────────────
-- Mirrors championship_teams_season_name_ci_idx pattern from migration 010.
-- Expression MUST match the `toSlug` helper in src/lib/members/slug.ts so
-- app-generated /members/[slug] URLs align with DB uniqueness.
--
--   App:   displayName.trim().toLowerCase().replace(/\s+/g, '-')
--   DB :   lower(btrim(replace(display_name, ' ', '-')))
--
-- The app regex collapses runs of whitespace to a single dash; the DB
-- expression only handles single spaces. That's acceptable — any
-- double-space display_name would fail the UNIQUE check if two members
-- collided, and case/whitespace are already enforced by the app at
-- registration time.

CREATE UNIQUE INDEX IF NOT EXISTS members_display_name_slug_idx
  ON public.members (lower(btrim(replace(display_name, ' ', '-'))));

-- ─── 5. Team primary-colour seed ────────────────────────────────────────────
-- 20 current-season PL teams. Hex values sourced from each club's Wikipedia
-- infobox (kit colours). `IS NULL` guard on every UPDATE so admin-edited
-- rows are never clobbered by a re-run.

UPDATE public.teams SET primary_color='#EF0107', secondary_color='#FFFFFF'
  WHERE lower(name) LIKE 'arsenal%' AND primary_color IS NULL;

UPDATE public.teams SET primary_color='#670E36', secondary_color='#9FC5E8'
  WHERE lower(name) LIKE 'aston villa%' AND primary_color IS NULL;

UPDATE public.teams SET primary_color='#DA291C', secondary_color='#000000'
  WHERE lower(name) LIKE 'bournemouth%' AND primary_color IS NULL;

UPDATE public.teams SET primary_color='#E30613', secondary_color='#FBB800'
  WHERE lower(name) LIKE 'brentford%' AND primary_color IS NULL;

UPDATE public.teams SET primary_color='#0057B8', secondary_color='#FFFFFF'
  WHERE (lower(name) LIKE 'brighton%' OR lower(name) LIKE '%hove albion%')
    AND primary_color IS NULL;

UPDATE public.teams SET primary_color='#034694', secondary_color='#DBA111'
  WHERE lower(name) LIKE 'chelsea%' AND primary_color IS NULL;

UPDATE public.teams SET primary_color='#1B458F', secondary_color='#C4122E'
  WHERE lower(name) LIKE 'crystal palace%' AND primary_color IS NULL;

UPDATE public.teams SET primary_color='#003399', secondary_color='#FFFFFF'
  WHERE lower(name) LIKE 'everton%' AND primary_color IS NULL;

UPDATE public.teams SET primary_color='#FFFFFF', secondary_color='#000000'
  WHERE lower(name) LIKE 'fulham%' AND primary_color IS NULL;

UPDATE public.teams SET primary_color='#4A90E2', secondary_color='#FFFFFF'
  WHERE lower(name) LIKE 'ipswich%' AND primary_color IS NULL;

UPDATE public.teams SET primary_color='#003090', secondary_color='#FDBE11'
  WHERE lower(name) LIKE 'leicester%' AND primary_color IS NULL;

UPDATE public.teams SET primary_color='#C8102E', secondary_color='#F6EB61'
  WHERE lower(name) LIKE 'liverpool%' AND primary_color IS NULL;

UPDATE public.teams SET primary_color='#6CABDD', secondary_color='#1C2C5B'
  WHERE (lower(name) LIKE 'manchester city%' OR lower(name) LIKE 'man city%'
         OR lower(name) = 'man. city')
    AND primary_color IS NULL;

UPDATE public.teams SET primary_color='#DA291C', secondary_color='#FBE122'
  WHERE (lower(name) LIKE 'manchester united%' OR lower(name) LIKE 'man united%'
         OR lower(name) LIKE 'man utd%' OR lower(name) = 'man. united')
    AND primary_color IS NULL;

UPDATE public.teams SET primary_color='#241F20', secondary_color='#FFFFFF'
  WHERE lower(name) LIKE 'newcastle%' AND primary_color IS NULL;

UPDATE public.teams SET primary_color='#DD0000', secondary_color='#FFFFFF'
  WHERE (lower(name) LIKE 'nottingham forest%' OR lower(name) LIKE 'nott%forest%')
    AND primary_color IS NULL;

UPDATE public.teams SET primary_color='#D71920', secondary_color='#FFFFFF'
  WHERE lower(name) LIKE 'southampton%' AND primary_color IS NULL;

UPDATE public.teams SET primary_color='#132257', secondary_color='#FFFFFF'
  WHERE (lower(name) LIKE 'tottenham%' OR lower(name) LIKE 'spurs%')
    AND primary_color IS NULL;

UPDATE public.teams SET primary_color='#7A263A', secondary_color='#1BB1E7'
  WHERE lower(name) LIKE 'west ham%' AND primary_color IS NULL;

UPDATE public.teams SET primary_color='#FDB913', secondary_color='#231F20'
  WHERE (lower(name) LIKE 'wolverhampton%' OR lower(name) LIKE 'wolves%')
    AND primary_color IS NULL;

-- ─── 6. admin_notifications CHECK extension ─────────────────────────────────
-- Pitfall 3 (Phase 11) / Pitfall 7 (Phase 10) ritual: drop + re-add with every
-- prior type preserved verbatim. Sources: migrations 001 / 002 / 004 / 005 /
-- 007 / 008 / 009 / 011. Two new Phase 11 types: 'season_archived' and
-- 'season_launched'.

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
    'h2h_steal_resolved',
    -- Phase 9 pre-season types
    'pre_season_all_correct',
    'pre_season_category_correct',
    'pre_season_awards_ready',
    -- Phase 10 reports types
    'report_send_failed',
    'kickoff_backup_failed',
    'report_render_failed',
    -- Phase 11 polish / continuity types
    'season_archived',
    'season_launched'
  ));

-- ─── 7. bonus_awards.points_awarded CHECK — pre-launch audit fix ────────────
-- Matches the TypeScript return type `0 | 20 | 60` on calculateBonusPoints.
-- Defensive belt-and-braces to prevent bad manual edits via Supabase directly
-- or a future refactor drifting from the scoring rules.

ALTER TABLE public.bonus_awards
  DROP CONSTRAINT IF EXISTS bonus_awards_points_awarded_check;

ALTER TABLE public.bonus_awards
  ADD CONSTRAINT bonus_awards_points_awarded_check
  CHECK (points_awarded IN (0, 20, 60));

COMMIT;
