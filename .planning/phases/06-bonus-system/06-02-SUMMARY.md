---
phase: 06-bonus-system
plan: "02"
subsystem: member-ui, predictions, server-actions
tags: [react, next.js, supabase, typescript, rls, lucide, tailwind]

# Dependency graph
requires:
  - phase: 06-bonus-system
    plan: "01"
    provides: bonus_awards table with RLS policies, BonusAwardRow types, submitBonusPickSchema
  - phase: 03-predictions
    provides: submitPredictions action, prediction-form.tsx, fixture-card.tsx
provides:
  - Extended submitPredictions accepting bonusFixtureId parameter with server-side lockout + RLS upsert
  - Bonus pick UI: star icon on fixture cards, bonus banner, mandatory validation
  - Golden Glory distinct gold visual treatment
  - Double Bubble gameweek banner
  - Gameweek page fetching activeBonusType and existingBonusPick server-side
affects: [06-03-scoring-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bonus pick state managed in PredictionForm; toggled via handleBonusToggle; passed down as props"
    - "Star button: bonusActive + onBonusToggle + !isTerminal gate — no star on locked/finished/live fixtures"
    - "Server action accepts optional bonusFixtureId with UUID guard + lockout check before upsert"

key-files:
  created: []
  modified:
    - src/actions/predictions.ts
    - src/app/(member)/gameweeks/[gwNumber]/page.tsx
    - src/components/predictions/prediction-form.tsx
    - src/components/fixtures/gameweek-view.tsx
    - src/components/fixtures/fixture-card.tsx

key-decisions:
  - "bonusFixtureId defaults to null — when no bonus is active, stars hidden and bonus validation skipped entirely"
  - "Star visibility gated by: bonusActive && onBonusToggle && !isTerminal — terminal = finished, postponed, cancelled, locked, live"
  - "Golden Glory: border-l-yellow-400 card border + yellow-400 filled star + gold gradient badge"
  - "Mandatory bonus: block submit with error 'Pick your bonus fixture before submitting — tap the star icon on a fixture card.'"
  - "Bonus upsert uses onConflict: gameweek_id,member_id — idempotent, overwrites prior pick on re-submit"
  - "bonusFixtureId validated server-side with z.string().uuid() before DB calls"

requirements-completed: [BONUS-01, BONUS-02, BONUS-06]

# Metrics
duration: 3min
completed: 2026-04-12
---

# Phase 6 Plan 02: Member Bonus UI Summary

**Member-facing bonus pick integrated into prediction submission: star icon on fixture cards, bonus/Golden Glory banners, mandatory validation, server-side RLS-enforced upsert of bonus_awards row**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-11T23:15:00Z
- **Completed:** 2026-04-11T23:18:26Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Extended `submitPredictions` server action with optional `bonusFixtureId` parameter: validates UUID, checks fixture lockout, fetches confirmed `bonus_schedule`, upserts `bonus_awards` row using session client (RLS enforced)
- Gameweek page now server-fetches confirmed bonus type (with joined `bonus_types`) and member's existing `bonus_awards.fixture_id`, passes both as props to `PredictionForm`
- `FixtureCard` gets 4 new props (`isBonusPick`, `onBonusToggle`, `bonusActive`, `isGoldenGlory`) — star icon visible only on unlocked, non-terminal fixtures when a bonus is active; 44px minimum tap target; filled amber/yellow when selected, outline slate when not
- Golden Glory: gold gradient card border (`border-l-yellow-400`), yellow-400 star, gold gradient badge with "20pts result · 60pts exact score!" hint
- `GameweekView` threads all four bonus props through to each `FixtureCard`
- `PredictionForm` manages `bonusFixtureId` state (initialised from `existingBonusPick`); `handleBonusToggle` toggles/deselects; Double Bubble banner when `gameweek.double_bubble` is true; bonus banner (indigo/purple or gold gradient) with pick status; mandatory validation blocks submit with clear error; client-side kickoff guard; `bonusSaved` reported in success message
- Full test suite of 212 tests passes with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend submitPredictions + gameweek page data fetch** — `e22bc61` (feat)
2. **Task 2: Bonus pick UI — fixture card star, bonus banner, validation** — `5370be9` (feat)

**Plan metadata:** committed with SUMMARY.md

## Files Created/Modified

- `src/actions/predictions.ts` — bonusFixtureId param, UUID guard, lockout check, bonus_awards upsert, bonusSaved return
- `src/app/(member)/gameweeks/[gwNumber]/page.tsx` — fetch bonus_schedule+bonus_types, fetch bonus_awards.fixture_id, pass activeBonusType+existingBonusPick to PredictionForm
- `src/components/predictions/prediction-form.tsx` — activeBonusType/existingBonusPick props, bonusFixtureId state, handleBonusToggle, Double Bubble banner, bonus banner, mandatory validation, bonusFixtureId in submitPredictions call
- `src/components/fixtures/gameweek-view.tsx` — bonus props added to interface, threaded through to FixtureCard
- `src/components/fixtures/fixture-card.tsx` — Star import, bonus props, isTerminal gate, star button (44px), card border for Golden Glory bonus, bonus/Golden Glory badge

## Decisions Made

- `bonusFixtureId` defaults to `null` — when no bonus is active for the gameweek, the entire bonus path is skipped (no stars, no validation, no upsert). Clean separation.
- Star visibility logic: `bonusActive && !!onBonusToggle && !isTerminal` — terminal means finished, postponed, cancelled, locked, or live. No point picking a fixture that's already decided.
- Golden Glory uses `border-l-yellow-400` left border on the card and yellow-400 filled star for distinct visual differentiation from standard amber bonus.
- `onConflict: 'gameweek_id,member_id'` on the upsert — a member can only have one bonus pick per gameweek, and re-submitting overwrites the previous pick safely.
- `bonusFixtureId` is validated server-side with `z.string().uuid()` before any DB calls — matches the pattern from the predictions validator.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Self-Check: PASSED

- `src/actions/predictions.ts` — FOUND
- `src/app/(member)/gameweeks/[gwNumber]/page.tsx` — FOUND
- `src/components/predictions/prediction-form.tsx` — FOUND
- `src/components/fixtures/gameweek-view.tsx` — FOUND
- `src/components/fixtures/fixture-card.tsx` — FOUND
- Commit `e22bc61` — FOUND
- Commit `5370be9` — FOUND

---
*Phase: 06-bonus-system*
*Completed: 2026-04-12*
