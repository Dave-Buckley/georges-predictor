---
phase: 04-scoring-engine
plan: "02"
subsystem: scoring
tags: [sync, admin-actions, radix-dialog, audit-trail, vitest, typescript, supabase]

# Dependency graph
requires:
  - phase: 04-01
    provides: recalculateFixture orchestrator, overrideResultSchema, result_overrides table

provides:
  - sync pipeline with FINISHED-transition detection and auto-scoring (SCORE-01)
  - getOverrideImpact server action (impact preview count)
  - applyResultOverride server action with audit trail (SCORE-02)
  - ResultOverrideDialog client component (3-step: entry, confirmation, success)
  - Admin gameweek page with source badges (API/Manual) and override trigger

affects:
  - All future syncs now auto-score on FINISHED transitions
  - Admin gameweek page UI updated for all future fixture rows

# Tech tracking
tech-stack:
  added: []
  patterns:
    - FINISHED-transition detection via pre-upsert status snapshot + filter
    - detectNewlyFinished exported as testable pure helper (Map-based lookup)
    - 3-step dialog pattern (entry -> impact preview -> success) with useTransition
    - Audit trail: result_overrides insert after every manual override
    - Admin notification on both auto-scoring and manual override

key-files:
  created:
    - src/actions/admin/scoring.ts
    - src/components/admin/result-override-dialog.tsx
    - tests/lib/sync-scoring.test.ts
    - tests/actions/admin/scoring.test.ts
  modified:
    - src/lib/fixtures/sync.ts
    - src/app/(admin)/admin/gameweeks/[gwNumber]/page.tsx

key-decisions:
  - "detectNewlyFinished exported as testable helper — pure function with Map lookup avoids complex sync mocking"
  - "Pre-upsert status snapshot (query by external_id) provides the prev state needed for transition detection"
  - "Notification mock in tests must return Promise.resolve (not chainable object) to avoid timeout — .then() awaited by action"
  - "Zod v4 UUID validation is stricter (requires version nibble [1-8] and variant bit [89abAB]) — test UUIDs use v4-compatible format"
  - "vi.mock factory hoisting: mockRecalculateFixture cannot be declared before vi.mock — use vi.mocked(recalculateFixture) after import instead"

patterns-established:
  - "Sync scoring: snapshot prev statuses before upsert, detect transitions after — O(n) map lookup"
  - "Admin actions: always requireAdmin() first, return early with { error } on failure — zero DB calls for unauthorized"
  - "Dialog pattern: useTransition for loading, step state machine (entry/confirm/success), window.location.reload() on success"
  - "Test pattern: use createMockSupabaseClient() from setup.ts as base, override per-table with vi.mocked(createAdminClient).mockReturnValue(...)"

requirements-completed: [SCORE-01, SCORE-02]

# Metrics
duration: 8min
completed: 2026-04-12
---

# Phase 04 Plan 02: Sync Pipeline + Manual Override Summary

**Sync auto-scores on FINISHED transitions; George can set/override results via impact-preview dialog with full audit trail**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-12T01:08:27Z
- **Completed:** 2026-04-12T01:16:39Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Extended `sync.ts` to snapshot fixture statuses before upsert and detect FINISHED transitions — only newly-FINISHED fixtures with non-null scores trigger `recalculateFixture`
- Exported `detectNewlyFinished` as a testable pure helper — 8 unit tests covering all transition scenarios including double-scoring prevention
- `getOverrideImpact` server action: returns prediction count + current scores for the impact preview step
- `applyResultOverride` server action: validates via Zod, updates fixture to FINISHED/manual, calls recalculateFixture, inserts `result_overrides` audit row, creates admin notification, revalidates admin and member pages
- `ResultOverrideDialog` component: 3-step flow (score entry, impact preview/confirmation, success) with useTransition loading states
- Admin gameweek page: source badges (API=blue, Manual=amber) next to status badge; Set Result / Override Result button opens dialog for every fixture
- 157 total tests passing (was 143), zero regressions

## Task Commits

1. **Task 1: Sync pipeline FINISHED-transition scoring** - `aad6436` (feat)
2. **Task 2: Admin override actions, dialog, and gameweek page** - `ae69421` (feat)

## Files Created/Modified

- `src/lib/fixtures/sync.ts` — Added `scored_fixtures` to SyncResult, exported `detectNewlyFinished` helper, pre-upsert snapshot, post-upsert scoring loop, result_source='api' update, scoring_complete notification
- `tests/lib/sync-scoring.test.ts` — 8 tests for FINISHED-transition detection (new fixture, SCHEDULED→FINISHED, already FINISHED, null scores, IN_PLAY, mixed batch)
- `src/actions/admin/scoring.ts` — `getOverrideImpact` and `applyResultOverride` server actions with auth guard, Zod validation, audit trail
- `tests/actions/admin/scoring.test.ts` — 6 tests: 3 for applyResultOverride (auth rejection, validation, successful override with audit row assertion), 2 for getOverrideImpact
- `src/components/admin/result-override-dialog.tsx` — 3-step Radix Dialog component with useTransition
- `src/app/(admin)/admin/gameweeks/[gwNumber]/page.tsx` — SOURCE_BADGE map, sourceBadge rendering, ResultOverrideDialog per fixture

## Decisions Made

- `detectNewlyFinished` exported as a pure testable helper — avoids needing to mock the full sync pipeline in tests
- Pre-upsert status snapshot queries by `external_id` for all incoming matches — matches the UUID resolution pattern already in sync.ts
- Notification mock in tests uses `Promise.resolve({...})` not a chainable object — the action `.then()` callback awaits the Promise; chainable mock caused 5s timeout
- Zod v4 UUID validation requires version nibble `[1-8]` and variant `[89abAB]` — test constants updated to use valid UUIDs (`4aaa`, `8aaa`)
- `vi.mock` factory hoisting: variables declared outside factory are not accessible inside it — use `vi.mocked(import)` pattern after imports instead

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test mock timeout in admin scoring test**
- **Found during:** Task 2 (test run)
- **Issue:** admin_notifications mock returned chainable object with `.then()` returning `this` — action awaits the result of `.then()`, causing 5s timeout
- **Fix:** Changed mock to `Promise.resolve({ error: null })` so the await resolves immediately
- **Files modified:** tests/actions/admin/scoring.test.ts
- **Verification:** `npx vitest run tests/actions/admin/scoring.test.ts` — all 6 tests pass in <100ms

**2. [Rule 1 - Bug] Fixed Zod v4 strict UUID validation in test constants**
- **Found during:** Task 2 (test run)
- **Issue:** `'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'` fails Zod v4's UUID regex because version nibble must be 1-8, not 'a'
- **Fix:** Updated test UUID constants to `'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'` (valid v4/RFC4122 format)
- **Files modified:** tests/actions/admin/scoring.test.ts

**3. [Rule 1 - Bug] Fixed vi.mock hoisting issue with mockRecalculateFixture variable**
- **Found during:** Task 2 (test suite load error)
- **Issue:** `const mockRecalculateFixture = vi.fn()` cannot be used inside `vi.mock` factory — Vitest hoists the factory to the top of the file before variable initialization
- **Fix:** Changed to `vi.fn()` directly inside the factory; imported `recalculateFixture` and used `vi.mocked(recalculateFixture)` for assertions
- **Files modified:** tests/actions/admin/scoring.test.ts

---

**Total deviations:** 3 auto-fixed (Rule 1 - Bug) — all in test file setup, zero impact on production code

## Issues Encountered

Pre-existing TypeScript errors in unrelated test files (members.test.ts, middleware.test.ts, scoring.test.ts) remain out of scope — logged in Phase 04-01 summary, not introduced by this plan.

## User Setup Required

None. The admin gameweek page will show source badges and override dialog immediately after deployment. George can use Override Result on any fixture.

Migration 004_scoring.sql (from 04-01) must be applied for the result_overrides table — already documented.

## Next Phase Readiness

- `applyResultOverride` and `getOverrideImpact` are ready for use
- prediction_scores are populated by both sync (api) and manual (George) paths
- Leaderboard aggregation (04-03) can now read prediction_scores with confidence that both pathways write correct data

---
*Phase: 04-scoring-engine*
*Completed: 2026-04-12*
