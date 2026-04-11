---
phase: 06-bonus-system
plan: "01"
subsystem: database, scoring
tags: [supabase, rls, vitest, tdd, pure-function, typescript, zod]

# Dependency graph
requires:
  - phase: 05-admin-panel
    provides: bonus_awards table, bonus_schedule table, bonus_types table, admin RLS policies
  - phase: 04-scoring-engine
    provides: calculatePoints pure function pattern (zero imports, TDD)
provides:
  - Migration 006 SQL with points_awarded column and 4 member RLS policies on bonus_schedule/bonus_awards
  - calculateBonusPoints pure function (Golden Glory 0/20/60, Jose Park The Bus 0/20, event-dependent → manual review)
  - computeDisplayTotal helper for Double Bubble display logic
  - BonusAwardRow extended with points_awarded field
  - BonusAwardWithType joined type for member display queries
  - submitBonusPickSchema Zod validator for member bonus pick submission
affects: [06-02-member-bonus-ui, 06-03-scoring-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure bonus calculation: zero imports, zero side effects — mirrors calculate.ts from Phase 4"
    - "TDD RED→GREEN: test file written first, implementation second"
    - "Const Set for O(1) lookup of score-evaluable bonus types"

key-files:
  created:
    - supabase/migrations/006_bonus_member_rls.sql
    - src/lib/scoring/calculate-bonus.ts
    - tests/lib/scoring-bonus.test.ts
  modified:
    - src/lib/supabase/types.ts
    - src/lib/validators/bonuses.ts

key-decisions:
  - "calculateBonusPoints uses SCORE_EVALUABLE_BONUSES Set for extensibility — adding new auto-calculable bonuses requires only adding to the Set and a new evaluator function"
  - "Jose Park The Bus qualifying scores defined as an explicit readonly array — 0-0, 1-0, 0-1 only (total goals <= 1)"
  - "computeDisplayTotal: pending bonuses excluded from doubled total — only George-confirmed bonuses count toward displayed points"
  - "BonusAwardWithType added as joined type alongside BonusScheduleWithType — consistent pattern for member-facing queries"

patterns-established:
  - "Score-evaluable bonus routing: Set membership check → named evaluator function (evaluateGoldenGlory, evaluateJoseParkTheBus)"
  - "requires_manual_review flag: false for auto-calculable types, true for all others — drives UI branching and admin workflow"

requirements-completed: [BONUS-01, BONUS-03, BONUS-04]

# Metrics
duration: 2min
completed: 2026-04-12
---

# Phase 6 Plan 01: Bonus System Foundation Summary

**Migration 006 + calculateBonusPoints pure function (TDD): member RLS on bonus_schedule/awards, Golden Glory 20/60pts, Jose Park The Bus 20pts for low-scoring, Double Bubble display helper**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-11T23:10:37Z
- **Completed:** 2026-04-12T03:14:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Migration 006 adds `points_awarded INT NOT NULL DEFAULT 0` to bonus_awards and creates 4 member RLS policies (bonus_schedule SELECT confirmed only, bonus_awards SELECT/INSERT/UPDATE own rows)
- Pure `calculateBonusPoints` function with zero imports: handles Golden Glory (60pts exact / 20pts result / 0pts miss), Jose Park The Bus (20pts for 0-0/1-0/0-1 with correct score), and flags all event-dependent bonus types as `requires_manual_review: true`
- `computeDisplayTotal` helper correctly applies Double Bubble multiplier only to confirmed bonus totals — pending bonuses excluded from doubled total
- 18 Vitest tests covering all branches pass; full suite of 212 tests passes with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration 006 and calculateBonusPoints pure function (TDD)** - `3d53b56` (feat)
2. **Task 2: Extend TypeScript types and Zod validators** - `b6856a6` (feat)

**Plan metadata:** committed with SUMMARY.md

## Files Created/Modified

- `supabase/migrations/006_bonus_member_rls.sql` — ALTER TABLE bonus_awards + 4 member RLS policies
- `src/lib/scoring/calculate-bonus.ts` — Pure bonus calculation library (calculateBonusPoints + computeDisplayTotal)
- `tests/lib/scoring-bonus.test.ts` — 18 unit tests for all bonus types and Double Bubble scenarios
- `src/lib/supabase/types.ts` — points_awarded added to BonusAwardRow; BonusAwardWithType joined type added
- `src/lib/validators/bonuses.ts` — submitBonusPickSchema and SubmitBonusPickInput added

## Decisions Made

- `calculateBonusPoints` routes through a `SCORE_EVALUABLE_BONUSES` Set for O(1) lookup and extensibility. Adding a future auto-calculable bonus (e.g. "Nil Nil") only requires adding to the Set and writing a named evaluator.
- Jose Park The Bus qualifying scores are an explicit readonly array (`{ home: 0, away: 0 }, { home: 1, away: 0 }, { home: 0, away: 1 }`) — total goals must be <= 1 with no ambiguity about what "low-scoring" means.
- `computeDisplayTotal` excludes pending bonuses from the doubled total — only George-confirmed awards count. This matches the Phase 5/6 decision: "nothing hits totals until George confirms".
- `BonusAwardWithType` extends `BonusAwardRow` with `bonus_type: BonusTypeRow`, mirroring the existing `BonusScheduleWithType` pattern for consistent member-facing query shapes.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

Migration 006 must be applied to the Supabase project when the project is connected. Run via Supabase CLI or dashboard SQL editor. No environment variable changes required.

## Next Phase Readiness

- Plan 02 (member bonus UI) can now import `calculateBonusPoints` and `computeDisplayTotal` for display logic
- Plan 02 can use `submitBonusPickSchema` for server-side validation of bonus pick submissions
- Plan 03 (scoring integration) can call `calculateBonusPoints` when fixture results arrive to auto-populate `bonus_awards.points_awarded`
- Migration 006 must be applied to the live Supabase project before Plans 02 and 03 can be deployed

---
*Phase: 06-bonus-system*
*Completed: 2026-04-12*
