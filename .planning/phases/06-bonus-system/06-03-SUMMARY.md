---
phase: "06"
plan: "03"
subsystem: bonus-system
tags: [scoring, bonus, double-bubble, sticky-footer, recalculate]
dependency_graph:
  requires: ["06-01", "06-02", "04-02"]
  provides: ["bonus-calculation-on-fixture-completion", "bonus-display-footer"]
  affects: ["src/lib/scoring/recalculate.ts", "src/components/predictions/prediction-form.tsx", "src/app/(member)/gameweeks/[gwNumber]/page.tsx"]
tech_stack:
  added: []
  patterns: ["bonus-idempotent-recalc", "display-time-multiplier", "tri-state-award-display"]
key_files:
  created: []
  modified:
    - src/lib/scoring/recalculate.ts
    - src/components/predictions/prediction-form.tsx
    - src/app/(member)/gameweeks/[gwNumber]/page.tsx
    - tests/lib/scoring.test.ts
    - tests/actions/admin/scoring.test.ts
decisions:
  - "Bonus recalculation only runs on pending awards (awarded=null) — confirmed/rejected awards are George's decisions and are never overwritten"
  - "bonus_calculated counter added to RecalcResult for observability without changing sync pipeline"
  - "Double Bubble formula shown as (base + bonus) x 2 in footer — transparency for George's friends"
metrics:
  duration: "3 min"
  completed_date: "2026-04-12"
  tasks_completed: 2
  files_modified: 5
---

# Phase 06 Plan 03: Bonus Calculation Trigger and Points Breakdown Summary

**One-liner:** Bonus points auto-calculated on fixture completion via extended recalculateFixture; sticky footer shows base/bonus/Double Bubble breakdown with pending/confirmed/rejected status.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Extend recalculateFixture with bonus point calculation | acc9eb7 | recalculate.ts, tests/lib/scoring.test.ts, tests/actions/admin/scoring.test.ts |
| 2 | Bonus + Double Bubble display in sticky footer and gameweek page | 585f0ec | prediction-form.tsx, gameweek page.tsx |

## What Was Built

### Task 1: recalculateFixture bonus extension

Extended `src/lib/scoring/recalculate.ts` to add Step 4 after the prediction_scores upsert:

- Queries `bonus_awards` for the finished fixture
- For each pending award (`awarded IS NULL`), calls `calculateBonusPoints` with the member's score result
- Updates `points_awarded` on the award row — never touches the `awarded` confirmation field
- Golden Glory: 60pts for exact score, 20pts for correct result, 0 otherwise
- Jose Park The Bus: 20pts when score correct and actual score is 0-0/1-0/0-1
- Event-dependent bonuses get 0pts with `requires_manual_review=true` — George confirms via existing admin flow
- Adds `bonus_calculated: number` to `RecalcResult` interface
- Idempotent: safe to re-run, all values recalculated fresh from prediction_scores

### Task 2: Sticky footer with full breakdown

Extended `PredictionForm` component with:

- New `bonusAwardDisplay` prop carrying `{ points_awarded, awarded, fixture_id }`
- `computeDisplayTotal` import from `calculate-bonus` for Double Bubble math
- Derived flags: `bonusPoints`, `bonusConfirmed`, `bonusPending`, `bonusRejected`
- Multi-line sticky footer replacing the old single-line:
  - Line 1: Base prediction points (always)
  - Line 2: Bonus points with green/amber/red strikethrough status colouring
  - Line 3: "awaiting result" when bonus pick exists but no result yet
  - Divider + GW total with "x 2" indicator on Double Bubble weeks
  - Double Bubble formula shown: `(base + bonus) x 2`
  - Results counter at bottom right
- `contentPadding` updated to `pb-36`/`pb-44` to clear the taller footer
- Gameweek page extended to build and pass `bonusAwardDisplay` from the existing `bonus_awards` query

## Decisions Made

- **Pending-only recalc:** Only `awarded=null` bonus awards are recalculated. Awards George has confirmed (`true`) or rejected (`false`) are treated as locked — the bonus calculation step skips them entirely to avoid overwriting George's decision.
- **bonus_calculated field:** Added to `RecalcResult` for observability without requiring sync.ts changes — the sync pipeline already calls `recalculateFixture`, bonus calculation comes for free.
- **Pending bonus excluded from total:** `computeDisplayTotal` (from Plan 01) already handles this — pending bonuses show in the UI but are NOT added to the displayed total until George confirms.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test mocks missing bonus_awards table routing**
- **Found during:** Task 1
- **Issue:** Existing `recalculateFixture` tests used simple single-chain mocks that didn't route `from('bonus_awards')` calls, causing test failures after Step 4 was added
- **Fix:** Updated mock clients in `scoring.test.ts` with explicit table routing for `predictions`, `prediction_scores`, and `bonus_awards`; updated `scoring.test.ts` and `admin/scoring.test.ts` to include `bonus_calculated: 0` in mock return values
- **Files modified:** `tests/lib/scoring.test.ts`, `tests/actions/admin/scoring.test.ts`
- **Commit:** acc9eb7

## Verification

- `npx vitest run` — 212 tests pass, 16 test files, no regressions
- recalculateFixture calculates bonus points for pending awards on fixture completion
- awarded field is never modified by calculation (only George's admin flow touches it)
- Sticky footer shows base pts + bonus status + Double Bubble breakdown
- Pending bonus shown but excluded from displayed total
- Confirmed bonus included in total (and doubled if Double Bubble active)

## Self-Check: PASSED

Files confirmed present:
- `src/lib/scoring/recalculate.ts` — FOUND
- `src/components/predictions/prediction-form.tsx` — FOUND
- `src/app/(member)/gameweeks/[gwNumber]/page.tsx` — FOUND

Commits confirmed present:
- acc9eb7 — FOUND
- 585f0ec — FOUND
