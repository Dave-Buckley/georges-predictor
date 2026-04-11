---
phase: 04-scoring-engine
plan: "03"
subsystem: ui
tags: [react, tailwind, supabase, scoring, fixtures, predictions]

requires:
  - phase: 04-scoring-engine plan 01
    provides: prediction_scores table with points_awarded, score_correct, result_correct columns

provides:
  - Inline score breakdown row on each finished fixture card (predicted vs actual + points badge)
  - Fixed gameweek total footer in PredictionForm (runs total, scored count, stacks above submit)
  - Server-side prediction_scores fetch on member gameweek page

affects:
  - 05-leaderboard (scoreBreakdown UI pattern; totals displayed per member per gameweek)

tech-stack:
  added: []
  patterns:
    - ScoreBreakdown interface defined locally in fixture-card and gameweek-view (matches PredictionScoreRow subset)
    - Fixed footer stacking: totalBarBottom derives from allKickedOff flag — bottom-[60px] or bottom-0
    - Content padding scales with visible bar count: pb-32 (both bars), pb-20 (one bar), pb-24 (neither)

key-files:
  created: []
  modified:
    - src/components/fixtures/fixture-card.tsx
    - src/components/fixtures/gameweek-view.tsx
    - src/components/predictions/prediction-form.tsx
    - src/app/(member)/gameweeks/[gwNumber]/page.tsx

key-decisions:
  - "ScoreBreakdown interface kept local (not imported from types.ts) — avoids coupling UI components to DB row type directly"
  - "Total bar uses fixed not sticky positioning — avoids fragile nested sticky/fixed stacking on mobile Safari"
  - "scoredFixtureCount > 0 gate on footer — ensures no provisional points shown before results arrive"

patterns-established:
  - "Fixed footer stacking: totalBarBottom = allKickedOff ? bottom-0 : bottom-[60px]"
  - "Data flows server -> PredictionForm -> GameweekView -> FixtureCard via prop threading"

requirements-completed: [SCORE-04, SCORE-06]

duration: 6min
completed: 2026-04-12
---

# Phase 4 Plan 03: Score Display Summary

**Inline points breakdown on each finished fixture card with green/amber/slate badges, plus fixed gameweek total footer stacked cleanly above the submit button on mobile**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-12T01:08:22Z
- **Completed:** 2026-04-12T01:14:22Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- FixtureCard renders a breakdown row (predicted score, actual score, green/amber/slate points badge) when `scoreBreakdown` prop is provided — no breakdown shown for fixtures without results
- PredictionForm has a fixed footer showing "Gameweek X Total: Y pts" and "Z of N results in", positioned at `bottom-[60px]` above the submit button, or `bottom-0` when submit is hidden after all kick-offs
- Member gameweek server page now fetches `prediction_scores` for the current member and fixtures, computes totals, and passes the data down to `PredictionForm`

## Task Commits

1. **Task 1: Extend fixture card and gameweek view with score breakdown display** - `f9b3930` (feat)
2. **Task 2: Fixed gameweek total footer and server-side score fetching** - `570ac48` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/components/fixtures/fixture-card.tsx` - Added `ScoreBreakdown` interface and `scoreBreakdown` prop; renders inline breakdown row with points badge below PredictionInputs
- `src/components/fixtures/gameweek-view.tsx` - Added `scoreBreakdowns` prop (Record keyed by fixture ID); threads matching breakdown to each FixtureCard
- `src/components/predictions/prediction-form.tsx` - Added `scoreBreakdowns`, `totalPoints`, `scoredFixtureCount` props; fixed footer with gameweek total; dynamic bottom padding for content scrolling
- `src/app/(member)/gameweeks/[gwNumber]/page.tsx` - Added `prediction_scores` fetch after existing predictions fetch; computes server-side totals; passes all three new props to PredictionForm

## Decisions Made

- `ScoreBreakdown` interface defined locally in component files rather than importing directly from `PredictionScoreRow` — keeps UI components decoupled from DB row shape while maintaining type safety
- Fixed footer uses `fixed` positioning exclusively (not `sticky`) to prevent stacking issues on mobile Safari with nested scroll containers
- Total bar bottom position derived from `allKickedOff` flag: `bottom-[60px]` when submit is visible, `bottom-0` when submit is hidden — no overlap between bars

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Pre-existing TypeScript errors in test files (`tests/lib/scoring.test.ts`, `tests/actions/admin/members.test.ts`, `tests/middleware.test.ts`) involving Vitest mock typing with Supabase client shapes — these are out of scope for this plan and the full test suite still passes (157/157). Deferred to a future cleanup plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All SCORE-04 and SCORE-06 display requirements are met
- Members can now see their points breakdown inline on each finished fixture card after page refresh
- Gameweek totals are visible in the fixed footer as results come in
- Phase 5 (Leaderboard) can reference the scoring display patterns established here

---
*Phase: 04-scoring-engine*
*Completed: 2026-04-12*
