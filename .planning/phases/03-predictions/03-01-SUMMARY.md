---
phase: 03-predictions
plan: "01"
subsystem: predictions-backend
tags: [database, rls, server-action, zod, tdd, types]
dependency_graph:
  requires: [02-fixture-layer]
  provides: [predictions-table, submitPredictions-action, prediction-types, prediction-validators]
  affects: [03-02-member-form, 03-03-admin-table]
tech_stack:
  added: []
  patterns: [tdd-red-green, server-action-pattern, zod-coerce, upsert-on-conflict]
key_files:
  created:
    - supabase/migrations/003_predictions.sql
    - src/lib/validators/predictions.ts
    - src/actions/predictions.ts
    - tests/lib/predictions.test.ts
    - tests/actions/predictions.test.ts
  modified:
    - src/lib/supabase/types.ts
decisions:
  - "Prediction visibility at kick-off (not gameweek-complete) per CONTEXT.md override of PRED-03 — implemented in predictions_select_member RLS policy"
  - "member_id resolved server-side from auth.uid() via members table — never trusted from client"
  - "Session client (not admin client) used for prediction upserts so RLS enforces insert/update rules at DB level"
  - "vi.mock factory hoisting fix: canSubmitPrediction imported after mock registration, cast to vi.fn() type for test helper usage"
metrics:
  duration: 3 min
  completed_date: "2026-04-12"
  tasks_completed: 2
  files_changed: 6
---

# Phase 03 Plan 01: Predictions Backend — DB, Types, Validators, Server Action

One-liner: Kick-off-gated predictions table with 4 RLS policies, Zod validators with coercion, and a upsert server action that enforces two-layer lockout (server + DB).

## What Was Built

### Migration: `supabase/migrations/003_predictions.sql`
- `public.predictions` table: member_id + fixture_id unique, home/away scores >= 0
- 4 RLS policies:
  - `predictions_insert_before_kickoff`: member owns row AND fixture not yet kicked off
  - `predictions_update_before_kickoff`: same conditions as insert
  - `predictions_select_member`: member reads own anytime, OR any member reads all predictions for fixtures where kickoff_time <= now() (kick-off reveal, CONTEXT.md override of PRED-03)
  - `predictions_select_admin`: admin reads all via JWT app_metadata role check
- Indexes on member_id and fixture_id
- `predictions_set_updated_at` trigger reusing `set_updated_at()` from migration 002
- `get_gameweek_submission_count(gw_id uuid)` RPC returning submitted_count + total_members bigints

### Types: `src/lib/supabase/types.ts`
Added `PredictionRow` and `PredictionWithMember` interfaces after `FixtureWithTeams`.

### Validators: `src/lib/validators/predictions.ts`
- `predictionEntrySchema`: fixture_id (uuid), home_score/away_score (coerce, int, 0-20)
- `submitPredictionsSchema`: gameweek_number (coerce, 1-38) + entries array (min 1)
- Both types exported: `PredictionEntry`, `SubmitPredictionsInput`

### Server Action: `src/actions/predictions.ts`
- Auth via `getUser()` (not getSession)
- Member lookup + approval_status === 'approved' check
- Zod validation of input
- Per-fixture `canSubmitPrediction()` lockout check — locked fixtures are silently skipped
- Upsert with `onConflict: 'member_id,fixture_id'` sets home_score, away_score, updated_at
- `revalidatePath('/gameweeks/' + gameweek_number)` after save
- Returns `{ success: true, saved, skipped }` or `{ error, saved: 0, skipped: 0 }`

## Test Results

- `tests/lib/predictions.test.ts`: 10/10 pass (predictionEntrySchema + submitPredictionsSchema)
- `tests/actions/predictions.test.ts`: 8/8 pass (all behavior cases)
- Full suite: 125/125 pass (zero regressions)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vi.mock hoisting issue with mockCanSubmitPrediction**
- **Found during:** Task 2 GREEN phase
- **Issue:** `const mockCanSubmitPrediction = vi.fn()` declared before `vi.mock('@/lib/fixtures/lockout', ...)` factory referenced it — vitest hoists vi.mock calls above variable declarations, causing ReferenceError
- **Fix:** Moved `canSubmitPrediction` mock to a factory with no top-level variable reference; imported the module after mocking and cast to `vi.fn()` type for use in test helpers
- **Files modified:** `tests/actions/predictions.test.ts`
- **Commit:** 5a92e03

## Self-Check

**Files created:**
- [x] `supabase/migrations/003_predictions.sql` — FOUND
- [x] `src/lib/validators/predictions.ts` — FOUND
- [x] `src/actions/predictions.ts` — FOUND
- [x] `tests/lib/predictions.test.ts` — FOUND
- [x] `tests/actions/predictions.test.ts` — FOUND

**Commits:**
- [x] 139ac79 — feat(03-01): predictions DB migration, types, and Zod validators
- [x] 5a92e03 — feat(03-01): submitPredictions server action with unit tests

## Self-Check: PASSED
