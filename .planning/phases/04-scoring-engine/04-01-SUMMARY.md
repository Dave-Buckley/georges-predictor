---
phase: 04-scoring-engine
plan: "01"
subsystem: scoring
tags: [vitest, tdd, supabase, sql, zod, typescript]

# Dependency graph
requires:
  - phase: 03-predictions
    provides: predictions table with member_id, fixture_id, home_score, away_score
  - phase: 02-fixture-layer
    provides: fixtures table with home_score, away_score, kickoff_time
  - phase: 01-foundation
    provides: members table, adminClient, RLS patterns

provides:
  - calculatePoints pure function (30pts exact / 10pts correct result / 0pts wrong)
  - getOutcome helper (H/D/A from home/away scores)
  - recalculateFixture DB orchestrator (queries predictions, upserts prediction_scores)
  - supabase/migrations/004_scoring.sql (prediction_scores + result_overrides tables)
  - PredictionScoreRow, ResultOverrideRow types
  - FixtureRow extended with result_source column
  - overrideResultSchema Zod validator

affects:
  - 04-02-leaderboard (reads prediction_scores to aggregate totals)
  - 04-03-admin-scoring-ui (calls recalculateFixture, uses overrideResultSchema)
  - Phase 06 bonus engine (builds on points_awarded breakdown)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Pure scoring function (no imports, no DB, no side effects) — tested in isolation
    - TDD Red-Green for all scoring logic before DB plumbing
    - Admin client (service role) for system writes to prediction_scores
    - Idempotent upsert pattern via prediction_id UNIQUE constraint

key-files:
  created:
    - src/lib/scoring/calculate.ts
    - src/lib/scoring/recalculate.ts
    - supabase/migrations/004_scoring.sql
    - src/lib/validators/scoring.ts
    - tests/lib/scoring.test.ts
  modified:
    - src/lib/supabase/types.ts

key-decisions:
  - "calculatePoints is pure with zero imports — enables offline use and easy TDD"
  - "prediction_scores CHECK constraint limits points_awarded to 0, 10, or 30 at DB level"
  - "recalculateFixture always uses adminClient — RLS blocks member writes to prediction_scores"
  - "Upsert on prediction_id (UNIQUE) makes recalculation idempotent — safe to re-run"
  - "result_source column on fixtures tracks api vs manual result provenance"
  - "Zod v4 uses .number() not .number({ invalid_type_error }) — message param removed in v4"

patterns-established:
  - "Scoring: calculatePoints(predicted, actual) is the single source of truth — never inline the logic"
  - "Scoring writes: always use adminClient, never session client (RLS blocks member writes)"
  - "Scoring recalc: always idempotent — safe to call multiple times for same fixture"

requirements-completed: [SCORE-03, SCORE-05]

# Metrics
duration: 4min
completed: 2026-04-12
---

# Phase 04 Plan 01: Scoring Engine Foundation Summary

**calculatePoints pure function (30/10/0 points) + recalculateFixture DB orchestrator + prediction_scores migration with CHECK constraint and RLS**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-12T01:02:02Z
- **Completed:** 2026-04-12T01:06:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Pure `calculatePoints()` function with exhaustive TDD coverage (13 test cases) — zero imports, zero side effects
- `recalculateFixture()` DB orchestrator: queries predictions via admin client, calculates points, upserts idempotently to prediction_scores (5 test cases)
- Migration 004 creates prediction_scores (CHECK points_awarded IN (0,10,30)), result_overrides audit table, and fixtures.result_source column — all with RLS
- All 18 scoring tests green; 143 total tests passing, zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing calculatePoints tests** - `d79a730` (test)
2. **Task 1 GREEN: calculate.ts + migration + types + validators** - `a06dda6` (feat)
3. **Task 2 RED: Failing recalculateFixture tests** - `9f822e7` (test)
4. **Task 2 GREEN: recalculate.ts orchestrator** - `0deb253` (feat)

_TDD tasks have separate RED and GREEN commits per phase protocol_

## Files Created/Modified

- `src/lib/scoring/calculate.ts` - Pure scoring function: getOutcome, calculatePoints, PointsResult type
- `src/lib/scoring/recalculate.ts` - DB orchestrator: recalculateFixture, RecalcResult type
- `supabase/migrations/004_scoring.sql` - prediction_scores table, result_overrides table, fixtures.result_source column, RLS policies
- `src/lib/validators/scoring.ts` - overrideResultSchema Zod validator with OverrideResultInput type
- `src/lib/supabase/types.ts` - Added PredictionScoreRow, ResultOverrideRow; extended FixtureRow with result_source; extended AdminNotificationRow union
- `tests/lib/scoring.test.ts` - 18 unit tests covering all scoring combinations and orchestrator behavior

## Decisions Made

- `calculatePoints` is a pure function with zero imports — enables offline use, dead simple TDD, and reuse across web app / admin recalc / future fallback
- prediction_scores uses a database-level CHECK constraint on points_awarded (0, 10, or 30) — correctness guaranteed at the DB layer, not just application layer
- `recalculateFixture` always uses `createAdminClient()` — RLS prevents any member writes to prediction_scores by design
- Upsert uses `onConflict: 'prediction_id'` against the UNIQUE constraint — makes recalculation fully idempotent, safe to call multiple times per fixture
- `result_source` column on fixtures tracks whether a score came from the API or was manually set by George — needed for audit trail in Phase 04-03

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Zod v4 API incompatibility in overrideResultSchema**
- **Found during:** Task 1 (validators/scoring.ts creation)
- **Issue:** `z.number({ invalid_type_error: '...' })` throws TypeScript error in Zod v4 — the `invalid_type_error` option was removed
- **Fix:** Removed `invalid_type_error` option; kept `.int()` and `.min()`/`.max()` messages
- **Files modified:** src/lib/validators/scoring.ts
- **Verification:** `npx tsc --noEmit` — no errors in src/ files
- **Committed in:** `a06dda6` (Task 1 feat commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Minimal — only affects error message for non-numeric input, not scoring logic. All validators function correctly.

## Issues Encountered

- Two pre-existing TypeScript errors in unrelated test files (`tests/actions/admin/members.test.ts` and `tests/middleware.test.ts`) were out of scope — logged to deferred items, not fixed. These existed before this plan and don't affect the scoring library.

## User Setup Required

None - no external service configuration required. Migration 004_scoring.sql must be applied to Supabase when deploying Phase 04.

## Next Phase Readiness

- `calculatePoints` and `recalculateFixture` are ready for use by 04-02 (leaderboard aggregation) and 04-03 (admin scoring UI + override workflow)
- prediction_scores table schema and RLS are finalized
- No blockers for Wave 1 continuation

---
*Phase: 04-scoring-engine*
*Completed: 2026-04-12*
