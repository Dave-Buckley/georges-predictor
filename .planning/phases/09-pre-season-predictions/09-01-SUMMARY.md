---
phase: 09-pre-season-predictions
plan: 01
subsystem: database

tags: [supabase, postgres, rls, zod, vitest, typescript, nextjs]

# Dependency graph
requires:
  - phase: 07-mid-season-import
    provides: pre_season_picks table (text[] storage for team names)
  - phase: 08-last-one-standing-h2h
    provides: admin_notifications CHECK extension ritual
provides:
  - seasons table (gw1_kickoff gate + end-of-season actuals)
  - pre_season_awards table (tri-state confirmation pattern, flags jsonb)
  - pre_season_picks.submitted_by_admin + submitted_at audit columns
  - admin_notifications extended with 3 pre-season notification types
  - calculatePreSeasonPoints pure library (30 pts flat, set-equality, 4 flags)
  - CHAMPIONSHIP_TEAMS_2025_26 constant + isChampionshipTeam helper
  - getCurrentSeason / getUpcomingSeason server helpers
  - getPreSeasonExportRows flat export shape
  - 4 Zod schemas (submit / setForMember / confirm / actuals)
affects: [09-02 member submission form, 09-03 admin confirmation + export]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Pure scoring library idiom (zero imports, single source of truth) — mirrors Phase 4/6/8
    - Source-list refinement deferred to server action (DB access required for PL teams)
    - Two-phase confirmation via pre_season_awards (mirrors Phase 5/6 bonus/prize pattern)

key-files:
  created:
    - supabase/migrations/009_pre_season.sql
    - src/lib/pre-season/calculate.ts
    - src/lib/pre-season/seasons.ts
    - src/lib/pre-season/export.ts
    - src/lib/teams/championship-2025-26.ts
    - src/lib/validators/pre-season.ts
    - tests/lib/pre-season-calculate.test.ts
    - tests/lib/pre-season-export.test.ts
    - tests/lib/pre-season-validators.test.ts
    - tests/lib/championship-teams.test.ts
  modified:
    - src/lib/supabase/types.ts

key-decisions:
  - "Extended existing src/lib/supabase/types.ts rather than creating src/lib/types/database.ts — the latter does not exist in this project; types.ts is the established canonical location"
  - "Source-list validation (PL vs Championship) deferred to server actions in Plan 02 — requires DB access for PL teams; keeping schema-level checks pure-static"
  - "Seasons helpers use createAdminClient for connection pooling consistency — the seasons table has a public-SELECT RLS policy so session client would also work"
  - "getPreSeasonExportRows uses a map-merge of picks + awards (not a single JOIN) — tolerates the common case where picks exist but no award row yet (null points)"
  - "Test UUIDs use v4-compliant format (version digit at position 13) — Zod v4 enforces strict UUID v1-8 regex"
  - "Championship list includes Leeds United per plan's starter list — developer updates once per season before pre-season window opens"

patterns-established:
  - "Pure-fn pre-season scoring: calculatePreSeasonPoints has zero imports, uses normalize() = trim().toLowerCase(), set-equality for unordered categories, 4 independent flags + all_correct_overall"
  - "Flag emission per-category: all_top4_correct fires independently of all_correct_overall — enables per-category admin notifications in Plan 03"
  - "Championship constant naming: CHAMPIONSHIP_TEAMS_2025_26 — season-suffixed so next season's file (2026-27) sits alongside without replacing"

requirements-completed: [PRE-01, PRE-02, PRE-03, PRE-05]

# Metrics
duration: 7min
completed: 2026-04-12
---

# Phase 9 Plan 1: Foundation Summary

**Migration 009 + pure `calculatePreSeasonPoints` lib + 4 Zod validators + 24-team Championship constant — downstream plans can compose against stable contracts.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-12T20:49:45Z
- **Completed:** 2026-04-12T20:56:30Z
- **Tasks:** 3
- **Files modified:** 11 (10 created + 1 modified)

## Accomplishments

- Migration 009 ships `seasons` + `pre_season_awards` tables, extends `admin_notifications` CHECK with 3 new types (all 20 prior types preserved), adds `submitted_by_admin` + `submitted_at` audit columns to `pre_season_picks`, and seeds 2025-26 + 2026-27 season rows (idempotent via `ON CONFLICT`).
- `calculatePreSeasonPoints` pure library: 30 pts flat per correct team, set-equality for unordered categories (top4/relegated/promoted), case-insensitive trim matching, 4 independent flags (`all_top4_correct`, `all_relegated_correct`, `all_promoted_correct`, `all_correct_overall`). Mirrors the `src/lib/scoring/calculate.ts` idiom from Phase 4.
- Championship constant (`CHAMPIONSHIP_TEAMS_2025_26`): 24 teams, `isChampionshipTeam()` case-insensitive + trim lookup helper.
- `getCurrentSeason` / `getUpcomingSeason` helpers using admin client; `getPreSeasonExportRows` returns flat rows tolerant of missing awards.
- 4 Zod schemas (`submit` / `setForMember` / `confirm` / `actuals`) with Zod v4 `.issues[0]?.message` error access.
- 50 new tests pass (373/373 total); full production build clean.

## Task Commits

Each task committed atomically using TDD RED-GREEN cycle:

1. **Task 1: Migration 009 + database types** — `811d5eb` (feat)
2. **Task 2 RED: Failing tests for calc + export + Championship** — `3636072` (test)
3. **Task 2 GREEN: Pre-season calc + seasons + export + Championship** — `f4ae74b` (feat)
4. **Task 3 RED: Failing tests for validators** — `800f07e` (test)
5. **Task 3 GREEN: Zod validators** — `bf8ee44` (feat)

**Plan metadata commit:** pending (final step)

## Files Created/Modified

- `supabase/migrations/009_pre_season.sql` — seasons + pre_season_awards + admin_notifications extension + audit columns + seeds
- `src/lib/pre-season/calculate.ts` — pure `calculatePreSeasonPoints` (zero imports)
- `src/lib/pre-season/seasons.ts` — `getCurrentSeason` / `getUpcomingSeason`
- `src/lib/pre-season/export.ts` — `getPreSeasonExportRows` + `PreSeasonExportRow` type
- `src/lib/teams/championship-2025-26.ts` — 24-team constant + `isChampionshipTeam`
- `src/lib/validators/pre-season.ts` — 4 Zod schemas + 4 type exports
- `src/lib/supabase/types.ts` — extended with `SeasonRow`, `PreSeasonAwardRow`, `PreSeasonAwardFlags`, and 3 new notification types; `PreSeasonPickRow` gained `submitted_by_admin` + `submitted_at`
- `tests/lib/pre-season-calculate.test.ts` — 12 tests covering perfect/zero/partial/case-insensitive/set-equality/flag-independence
- `tests/lib/pre-season-export.test.ts` — 4 tests covering shape + join + null-awards-tolerance
- `tests/lib/pre-season-validators.test.ts` — 24 tests covering all 4 schemas + Zod v4 error pattern
- `tests/lib/championship-teams.test.ts` — 10 tests covering constant length + `isChampionshipTeam` edge cases

## Decisions Made

- **Target existing types file, not plan-named path.** The plan referenced `src/lib/types/database.ts` which doesn't exist in this project; extended `src/lib/supabase/types.ts` (the canonical location used throughout Phases 1-8). Treated as Rule 3 deviation.
- **UUID format for Zod v4 tests.** Zod v4's `.uuid()` enforces a strict RFC v1-8 regex (version digit required at position 13). Test fixtures like `11111111-1111-1111-1111-111111111111` fail validation; updated to `11111111-1111-4111-8111-111111111111` (v4 UUID). No source-code change needed — only test fixtures.
- **Source-list refinement NOT in Zod schemas.** Championship vs PL team validation requires a DB round-trip (PL teams live in the `teams` table). Keeping the schema pure-static and enforcing source lists in the Plan 02 server action keeps validators importable from edge contexts without a DB client.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan referenced non-existent `src/lib/types/database.ts`**
- **Found during:** Task 1 (migration + types)
- **Issue:** Plan listed `src/lib/types/database.ts` in `files_modified` but the project uses `src/lib/supabase/types.ts` (confirmed by Phase 1-8 history — `MemberRow`, `FixtureRow`, `AdminNotificationType` etc. all live there)
- **Fix:** Extended `src/lib/supabase/types.ts` with `SeasonRow`, `PreSeasonAwardRow`, `PreSeasonAwardFlags`; added 3 new notification type literals; extended `PreSeasonPickRow` with new audit columns
- **Files modified:** src/lib/supabase/types.ts
- **Verification:** `npm run build` succeeds; all 373 tests pass
- **Committed in:** `811d5eb`

**2. [Rule 1 - Bug] Initial Championship constant missing "Leeds United"**
- **Found during:** Task 2 GREEN (test run)
- **Issue:** Championship list I generated differed from the plan's starter list; `isChampionshipTeam('Leeds United')` returned false, failing 3 tests
- **Fix:** Updated the constant to include `Leeds United` (plan's starter list had it; dropped "Wrexham" to keep the 24-team count)
- **Files modified:** src/lib/teams/championship-2025-26.ts
- **Verification:** All 10 Championship tests + all 12 calc tests green
- **Committed in:** `f4ae74b`

**3. [Rule 1 - Bug] Test UUID fixtures invalid under Zod v4**
- **Found during:** Task 3 GREEN (test run)
- **Issue:** Test UUIDs `11111111-1111-1111-1111-111111111111` and `22222222-...` fail Zod v4's strict UUID regex (requires version digit 1-8 at position 13); 5 tests failed
- **Fix:** Updated test UUIDs to v4-compliant format (`11111111-1111-4111-8111-111111111111`, `22222222-1111-4222-8222-222222222222`)
- **Files modified:** tests/lib/pre-season-validators.test.ts
- **Verification:** All 24 validator tests green
- **Committed in:** `bf8ee44`

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 bugs)
**Impact on plan:** All auto-fixes were test/fixture alignment issues — no architectural changes, no scope creep, no downstream ripple.

## Issues Encountered

None beyond the auto-fixed deviations above. TDD RED-GREEN cycle worked cleanly: tests failed as expected on first run, passed after implementation.

## User Setup Required

None — migration 009 will be applied via the usual Supabase deployment flow in Plan 03 (or end-of-phase), not this plan.

## Next Phase Readiness

**Ready for Plan 02 (member submission form + admin late-joiner + lockout wiring):**
- Zod schemas ready for server actions (`submitPreSeasonPicksSchema`, `setPreSeasonPicksForMemberSchema`)
- `getUpcomingSeason` helper returns `gw1_kickoff` for client-side lockout banner
- `isChampionshipTeam` ready for action-level source-list refinement
- `pre_season_picks` table (already live) gains `submitted_by_admin` + `submitted_at` columns on deploy

**Ready for Plan 03 (end-of-season confirmation + export):**
- `calculatePreSeasonPoints` + `seasonActualsSchema` compose for the calc step
- `confirmPreSeasonAwardSchema` + `pre_season_awards` table ready for George's confirmation UI
- `getPreSeasonExportRows` ready to feed the XLSX export

**Deployment note:** Migration 009 is written but NOT pushed (`supabase db push` happens separately per deploy cadence). All types and logic compile against the migration contract; tests pass without a live DB.

---
*Phase: 09-pre-season-predictions*
*Completed: 2026-04-12*

## Self-Check: PASSED

All 11 files present; all 5 task commits (`811d5eb`, `3636072`, `f4ae74b`, `800f07e`, `bf8ee44`) exist in git history. Full suite 373/373 green; production build clean.
