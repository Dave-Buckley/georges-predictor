-- 029_favourite_club.sql
--
-- Lets a member pick their favourite club. The club badge is then shown as a
-- small icon beside their name in the league table and anywhere else
-- MemberLink renders.
--
-- Purely cosmetic. It has no bearing on scoring, standings order, Last One
-- Standing eligibility, or prediction access. NULL is expected and normal — a
-- member who has not chosen one simply renders without a badge.
--
-- ─── Why a new `clubs` table and not `teams` ─────────────────────────────────
-- `teams` means "clubs the fixture sync has seen this season" — currently the
-- 20 Premier League sides, and nothing else. Two things make it the wrong home
-- for a favourite club:
--
--   1. Step 9 of scripts/reset-for-2026-27-season.ts DELETES teams that have no
--      remaining fixtures, so relegated clubs are removed at each rollover. A
--      supporter's club must survive relegation.
--   2. Plenty of members support clubs outside the Premier League. The picker
--      covers the top four English tiers, which `teams` will never contain.
--
-- `clubs` is therefore a stable reference list, seeded once from
-- scripts/_data/clubs.json (built by scripts/fetch-club-badges.ts) and never
-- touched by the season reset or the fixture sync.
--
-- Idempotent.

-- ─── 1. clubs ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clubs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL,
  official_name text,
  short_name    text,
  -- 1 = Premier League, 2 = Championship, 3 = League One, 4 = League Two.
  -- NULL where the source could not place the club; it still shows in the
  -- picker, just under "Other".
  tier          int,
  league        text,
  badge_url     text,
  sportsdb_id   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Case-insensitive unique name so re-seeding updates rather than duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS clubs_name_ci_idx
  ON public.clubs (lower(btrim(name)));

CREATE INDEX IF NOT EXISTS clubs_tier_idx ON public.clubs (tier);

COMMENT ON TABLE public.clubs IS
  'Stable reference list of English clubs (top four tiers) for the member favourite-club picker. Seeded from scripts/_data/clubs.json. Deliberately separate from `teams`, which is fixture-scoped and pruned at each season reset.';

-- Reuse set_updated_at() from migration 002.
DROP TRIGGER IF EXISTS clubs_set_updated_at ON public.clubs;
CREATE TRIGGER clubs_set_updated_at
  BEFORE UPDATE ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 2. RLS ─────────────────────────────────────────────────────────────────
-- Read-only reference data: anyone signed in can read it, only the service
-- role (the seed script) writes. No INSERT/UPDATE/DELETE policies are defined
-- for the session role, which means those are denied.
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clubs_select_all ON public.clubs;
CREATE POLICY clubs_select_all
  ON public.clubs FOR SELECT
  USING (true);

-- ─── 3. members.favourite_club_id ───────────────────────────────────────────
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS favourite_club_id uuid
    REFERENCES public.clubs(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.members.favourite_club_id IS
  'Optional. The member''s favourite club, shown as a badge beside their name. Cosmetic only — never affects scoring, standings, or LOS.';

CREATE INDEX IF NOT EXISTS members_favourite_club_id_idx
  ON public.members(favourite_club_id);

-- ─── 4. The older favourite_team_id column ──────────────────────────────────
-- `members.favourite_team_id` (-> public.teams) predates this migration. It was
-- half-built: /members/[slug] read it and ProfileHeader rendered it, but no
-- picker UI was ever shipped, so it sits at 0 rows set across all 50 members.
--
-- It is superseded by favourite_club_id above, which covers the top four
-- English tiers instead of only the current 20 Premier League sides, and which
-- survives the season reset's orphan-team cleanup.
--
-- Deliberately NOT dropped here. Dropping a column is irreversible and this one
-- is harmless where it sits; all application code now reads favourite_club_id.
-- Drop it in a later migration once you are happy nothing references it:
--   ALTER TABLE public.members DROP COLUMN IF EXISTS favourite_team_id;
COMMENT ON COLUMN public.members.favourite_team_id IS
  'DEPRECATED — superseded by favourite_club_id (migration 029). Never populated; no picker UI ever shipped. Safe to drop.';
