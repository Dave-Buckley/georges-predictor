---
phase: 03-predictions
plan: "02"
subsystem: predictions-ui
tags: [client-component, server-component, form, stepper, prediction-form]
dependency_graph:
  requires: [03-01-predictions-backend]
  provides: [prediction-inputs-component, prediction-form-component, gameweek-page-with-predictions]
  affects: [member-gameweek-page]
tech_stack:
  added: []
  patterns: [client-state-management, server-action-call, sticky-bottom-nav, inline-feedback-banner]
key_files:
  created:
    - src/components/predictions/prediction-inputs.tsx
    - src/components/predictions/prediction-form.tsx
  modified:
    - src/components/fixtures/fixture-card.tsx
    - src/components/fixtures/gameweek-view.tsx
    - src/app/(member)/gameweeks/[gwNumber]/page.tsx
decisions:
  - "PredictionInputs uses inputMode=numeric for phone keypad fallback (no custom keyboard)"
  - "GameweekView remains non-client; isLocked derived per-fixture via new Date() comparison"
  - "Sticky submit button hidden when all fixtures have kicked off (allKickedOff flag)"
  - "Task 2 files landed in 03-03 docs commit (42cfa53) due to prior session overlap — code correct"
metrics:
  duration: 4 min
  completed_date: "2026-04-12"
  tasks_completed: 2
  files_changed: 5
---

# Phase 03 Plan 02: Prediction Submission Form — Inputs, Form, Page Integration

One-liner: Stepper +/- inputs per fixture card, client-managed prediction state form with one-tap Submit/Update button, server-fetched existing predictions and submission counter on gameweek page.

## What Was Built

### Component: `src/components/predictions/prediction-inputs.tsx`
- 'use client' component with Home/Away stepper inputs ([ - ] {score} [ + ] layout)
- `type="number" inputMode="numeric"` for phone numeric keypad fallback
- Null score = empty input with placeholder "—"; first + tap sets to 0 then increments
- Minus disabled at 0/null; Plus disabled at 20
- `disabled=true` → read-only display: shows saved scores in muted style, or "No prediction" text
- `hasSubmitted=true + not disabled` → green left border on wrapper (saved indicator)
- Direct number input supported — clamps to 0-20, handles empty string → null

### Component: `src/components/predictions/prediction-form.tsx`
- 'use client' wrapper managing all prediction state for a full gameweek
- Initialised from `existingPredictions` prop (server-fetched saved scores)
- `handleScoreChange` updates local state only — no auto-save (locked decision)
- `handleSubmit`: collects entries with both scores + not past kickoff → calls `submitPredictions`
- Auto-dismiss feedback banner (5s timer via useEffect cleanup)
- Tracks `submittedFixtureIds` Set — updated on successful save to show green borders
- `hasExistingPredictions` drives "Submit Predictions" vs "Update Predictions" button text
- Submission counter bar: Users icon + "X of Y members have submitted"
- Amber warning when some (but not all) fixtures have kicked off
- All-kicked-off state: hides submit button, shows locked notice
- Sticky bottom submit button (fixed, z-10, bg-slate-900, h-12, purple-600)

### Extended: `src/components/fixtures/fixture-card.tsx`
- New optional props: `prediction`, `onScoreChange`, `isLocked` (override), `hasSubmitted`
- `isLocked` prop overrides internal `pastKickoff` calculation when provided
- prediction-area div now renders `<PredictionInputs>` when `onScoreChange` is provided
- Backwards compatible: standalone cards (no `onScoreChange`) keep empty prediction-area

### Extended: `src/components/fixtures/gameweek-view.tsx`
- New optional props: `predictions`, `onScoreChange`, `submittedFixtureIds`
- Passes prediction data + callbacks to each FixtureCard
- `isLocked` derived: `new Date() >= new Date(fixture.kickoff_time)` (only when in prediction context)
- `hasSubmitted` derived: `submittedFixtureIds?.has(fixture.id)`
- Remains a regular (non-client) component — all interactivity in PredictionInputs/FixtureCard

### Updated: `src/app/(member)/gameweeks/[gwNumber]/page.tsx`
- Auth check via `supabase.auth.getUser()` (not getSession)
- Member lookup with approval_status check — shows pending message if not approved
- Fetches existing predictions: `.from('predictions').select(...).eq('member_id').in('fixture_id')`
- Converts prediction rows to Record keyed by fixture_id
- Fetches submission count via `supabase.rpc('get_gameweek_submission_count', { gw_id })`
- Renders `<PredictionForm>` instead of separate `<GameweekNav>` + `<GameweekView>`

## Deviations from Plan

### Note: Task 2 commit overlap with prior session

The files `prediction-form.tsx` and `gameweek/[gwNumber]/page.tsx` were committed as part of commit `42cfa53` (docs commit from 03-03 prior session) rather than as a standalone Task 2 feat commit. The code content is correct and matches the plan spec exactly. Task 1 has its own clean commit `580ce23`.

No functional deviations — plan executed exactly as specified.

## Self-Check

**Files created:**
- [x] `src/components/predictions/prediction-inputs.tsx` — FOUND
- [x] `src/components/predictions/prediction-form.tsx` — FOUND

**Files modified:**
- [x] `src/components/fixtures/fixture-card.tsx` — FOUND
- [x] `src/components/fixtures/gameweek-view.tsx` — FOUND
- [x] `src/app/(member)/gameweeks/[gwNumber]/page.tsx` — FOUND

**Commits:**
- [x] 580ce23 — feat(03-02): PredictionInputs component and FixtureCard prediction extension
- [x] 42cfa53 — docs(03-03): Task 2 files included (prediction-form.tsx, gameweek page.tsx)

**Build verification:**
- [x] `npx tsc --noEmit` — zero errors in src/ files
- [x] `npm run build` — production build passes, all routes compiled
- [x] `npx vitest run` — 125/125 tests pass (zero regressions)

## Self-Check: PASSED
