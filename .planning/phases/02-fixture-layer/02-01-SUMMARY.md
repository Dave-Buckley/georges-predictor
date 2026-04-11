---
phase: 02-fixture-layer
plan: 01
subsystem: database
tags: [supabase, postgresql, rls, football-data-org, date-fns-tz, cron, typescript, vitest]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: createAdminClient(), createServerSupabaseClient(), MemberRow types, admin JWT RLS pattern

provides:
  - supabase/migrations/002_fixture_layer.sql — teams/gameweeks/fixtures/sync_log tables with RLS and indexes
  - src/lib/fixtures/timezone.ts — formatKickoffTime, formatKickoffFull, formatKickoffDate, getLondonDayOfWeek, isMidweekFixture, isToday
  - src/lib/fixtures/football-data-client.ts — fetchAllMatches() with typed FootballDataMatch interface
  - src/lib/fixtures/sync.ts — syncFixtures() full pipeline: fetch -> upsert teams/gameweeks/fixtures -> detect reschedules -> log
  - src/lib/fixtures/lockout.ts — canSubmitPrediction() server-side lockout check (FIX-03 layer 1)
  - src/app/api/sync-fixtures/route.ts — GET endpoint for cron, manual admin, first-sync-on-deploy
  - vercel.json cron entry at 0 7 * * *
  - 19 passing timezone unit tests
  - 28 it.todo() test stubs for Plans 02-02 and 02-03

affects:
  - 02-fixture-layer/02-02 (admin UI depends on syncFixtures, FixtureRow types, addFixtureSchema)
  - 02-fixture-layer/02-03 (member view depends on FixtureWithTeams, formatKickoffTime)
  - 03-predictions (lockout.ts canSubmitPrediction, Phase 3 MUST add prediction_lockout RLS policy)

# Tech tracking
tech-stack:
  added:
    - date-fns-tz (BST/GMT timezone conversion for Europe/London)
  patterns:
    - Admin client (service role) for all sync writes — bypasses RLS safely
    - getLondonTzAbbr() derives BST/GMT label from getTimezoneOffset() — Node.js ICU workaround
    - syncFixtures() orchestrates with helper functions; never throws — always returns result
    - First-sync-on-deploy: API route checks empty sync_log before auth checks
    - TDD: tests written first (RED), then implementation (GREEN), verified passing

key-files:
  created:
    - supabase/migrations/002_fixture_layer.sql
    - src/lib/fixtures/timezone.ts
    - src/lib/fixtures/football-data-client.ts
    - src/lib/fixtures/sync.ts
    - src/lib/fixtures/lockout.ts
    - src/app/api/sync-fixtures/route.ts
    - tests/lib/fixtures.test.ts
    - tests/actions/admin/fixtures.test.ts
  modified:
    - src/lib/supabase/types.ts (added TeamRow, GameweekRow, FixtureRow, SyncLogRow, FixtureWithTeams, FixtureStatus, GameweekStatus; extended AdminNotificationRow)
    - src/lib/validators/admin.ts (added addFixtureSchema, editFixtureSchema, moveFixtureSchema)
    - next.config.ts (added crests.football-data.org remotePattern)
    - vercel.json (added sync-fixtures cron at 0 7 * * *)
    - package.json / package-lock.json (date-fns-tz dependency)

key-decisions:
  - "BST/GMT label derived from getTimezoneOffset() offset value (0=GMT, 3600000=BST) rather than zzz format token — Node.js ICU returns GMT+1 not BST for zzz in test environment"
  - "sync.ts uses UUID resolution from DB after upsert — never generates random UUIDs; DB assigns them on INSERT"
  - "Prediction lockout RLS policy documented as commented SQL in migration 002 — Phase 3 MUST apply it on the predictions table"
  - "fixtures_no_edit_after_kickoff RLS policy live on fixtures table as defence-in-depth; admin service role bypasses it"
  - "First-sync-on-deploy: route checks empty sync_log before auth — runs immediately on first request post-deploy"

patterns-established:
  - "Timezone pattern: all kickoff_times stored UTC, display converted with formatInTimeZone(Europe/London)"
  - "Sync idempotency: all upserts use onConflict: external_id for deduplication"
  - "Lockout two-layer pattern: server action calls canSubmitPrediction() + RLS policy on predictions (Phase 3)"
  - "Cron auth: Authorization: Bearer {CRON_SECRET} header; manual admin uses session check"

requirements-completed:
  - FIX-01
  - FIX-02
  - FIX-03
  - FIX-04

# Metrics
duration: 7min
completed: 2026-04-11
---

# Phase 2 Plan 01: Fixture Layer Foundation Summary

**football-data.org sync pipeline with BST/GMT timezone helpers, teams/gameweeks/fixtures DB schema, admin cron route, and server-side lockout utility using date-fns-tz**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-11T19:08:52Z
- **Completed:** 2026-04-11T19:15:20Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments

- Created 4-table database schema (teams, gameweeks, fixtures, sync_log) with full RLS, indexes, updated_at trigger, and prediction lockout policy (commented for Phase 3)
- Built complete fixture sync pipeline: football-data.org API client -> upsert teams/gameweeks/fixtures -> reschedule detection -> admin notifications -> sync_log
- Implemented 6 timezone helper functions returning correct BST/GMT labels using date-fns-tz with Europe/London; all 19 unit tests pass including DST transition edge cases
- Created /api/sync-fixtures with cron auth, manual admin trigger, and first-sync-on-deploy automatic detection
- Added canSubmitPrediction() server-side lockout utility as Layer 1 of FIX-03 two-layer enforcement
- Scaffolded 28 it.todo() test stubs organizing all sync/admin/lockout behaviour for Plans 02-02 and 02-03

## Task Commits

1. **Task 1: DB migration, type defs, Zod validators, and timezone helpers** - `4f5fd20` (feat)
2. **Task 2: API client, sync engine, lockout utility, API route, cron config** - `770246d` (feat)

## Files Created/Modified

- `supabase/migrations/002_fixture_layer.sql` — teams/gameweeks/fixtures/sync_log tables, RLS policies, indexes, updated_at trigger, prediction lockout RLS stub
- `src/lib/fixtures/timezone.ts` — formatKickoffTime/Full/Date, getLondonDayOfWeek, isMidweekFixture, isToday using date-fns-tz
- `src/lib/fixtures/football-data-client.ts` — fetchAllMatches() with FootballDataMatch/Response interfaces
- `src/lib/fixtures/sync.ts` — syncFixtures() orchestrator with helpers: extractTeams, extractGameweeks, detectReschedules
- `src/lib/fixtures/lockout.ts` — canSubmitPrediction() querying fixtures.kickoff_time and status
- `src/app/api/sync-fixtures/route.ts` — GET handler: first-sync-on-deploy, cron Bearer auth, manual admin session check
- `src/lib/supabase/types.ts` — TeamRow, GameweekRow, FixtureRow, SyncLogRow, FixtureWithTeams, FixtureStatus, GameweekStatus added
- `src/lib/validators/admin.ts` — addFixtureSchema, editFixtureSchema, moveFixtureSchema added
- `next.config.ts` — crests.football-data.org remotePattern added
- `vercel.json` — sync-fixtures cron at 0 7 * * * added alongside keep-alive
- `tests/lib/fixtures.test.ts` — 19 timezone unit tests (all pass)
- `tests/actions/admin/fixtures.test.ts` — 28 it.todo() stubs for sync, API route, lockout, admin actions

## Decisions Made

- **BST/GMT label workaround:** The `zzz` date-fns-tz token returns "GMT+1" not "BST" in Node.js environments due to ICU data. Used `getTimezoneOffset()` to derive the label: offset 0 = GMT, offset 3600000 = BST. This approach is timezone-correct and test-stable.
- **UUID resolution post-upsert:** sync.ts queries teams and gameweeks tables AFTER upsert to get database-assigned UUIDs. Never generates random UUIDs client-side.
- **Prediction lockout policy deferred:** The predictions table doesn't exist yet (Phase 3). The lockout RLS SQL is documented as commented-out code in migration 002 with a clear "Phase 3 MUST include" label.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] BST/GMT label from getTimezoneOffset() instead of zzz token**
- **Found during:** Task 1 (timezone.ts implementation, GREEN phase)
- **Issue:** `formatInTimeZone(..., 'zzz')` returns "GMT+1" not "BST" in Node.js (ICU data doesn't include BST abbreviation). Plan specified `zzz` would return "BST" but it doesn't in test environment.
- **Fix:** Added `getLondonTzAbbr()` helper that calls `getTimezoneOffset(LONDON_TZ, date)` and returns "BST" if offset > 0, "GMT" if offset === 0. Both formatKickoffTime and formatKickoffFull compose the time string + abbreviation separately.
- **Files modified:** src/lib/fixtures/timezone.ts
- **Verification:** All 19 timezone tests pass, including BST summer, GMT winter, and DST transition edge cases
- **Committed in:** 4f5fd20 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in assumed behaviour of zzz token)
**Impact on plan:** Fix necessary for test correctness. Result is semantically equivalent — users see "BST"/"GMT" as intended. No scope creep.

## Issues Encountered

- Pre-existing TypeScript errors in tests/actions/admin/members.test.ts and tests/middleware.test.ts (confirmed via git stash verification — errors exist before this plan's changes). Logged to deferred-items.md. Not caused by Plan 02-01.

## User Setup Required

None — no external service configuration required for this plan. The FOOTBALL_DATA_API_KEY environment variable will be needed at deploy time, but no dashboard steps are required for the code artifacts built here.

## Next Phase Readiness

- Plan 02-02 (admin fixtures UI) can build immediately — FixtureRow types, addFixtureSchema/editFixtureSchema/moveFixtureSchema validators, syncFixtures(), and /api/sync-fixtures manual trigger all ready
- Plan 02-03 (member fixtures view) can build immediately — FixtureWithTeams type, timezone helpers, canSubmitPrediction() all available
- Phase 3 predictions layer must include the commented prediction lockout RLS policy from migration 002

---
*Phase: 02-fixture-layer*
*Completed: 2026-04-11*

## Self-Check: PASSED

All created files exist on disk. All task commits verified in git log.

| Check | Status |
|-------|--------|
| supabase/migrations/002_fixture_layer.sql | FOUND |
| src/lib/fixtures/timezone.ts | FOUND |
| src/lib/fixtures/football-data-client.ts | FOUND |
| src/lib/fixtures/sync.ts | FOUND |
| src/lib/fixtures/lockout.ts | FOUND |
| src/app/api/sync-fixtures/route.ts | FOUND |
| tests/lib/fixtures.test.ts | FOUND |
| tests/actions/admin/fixtures.test.ts | FOUND |
| Commit 4f5fd20 | FOUND |
| Commit 770246d | FOUND |
