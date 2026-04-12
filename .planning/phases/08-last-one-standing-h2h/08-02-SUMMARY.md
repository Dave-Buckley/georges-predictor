---
phase: 08-last-one-standing-h2h
plan: "02"
subsystem: integration
tags: [supabase, server-actions, react, radix-ui, sync-pipeline, los, h2h, tdd, vitest]

# Dependency graph
requires:
  - phase: 08-last-one-standing-h2h
    plan: "01"
    provides: "Pure evaluators (evaluateLosRound, detectWeeklyTies, resolveSteal), team-usage helper, Zod validators, DB tables + RLS"
  - phase: 06-bonus-system
    provides: "bonus_awards.awarded tri-state + points_awarded — weekly totals exclude NULL/false"
  - phase: 04-scoring-engine
    provides: "prediction_scores + sync.ts detectNewlyFinished scaffolding + recalculateFixture admin pattern"
  - phase: 03-predictions
    provides: "submitPredictions session-client pattern; member_id server-resolved from auth.uid()"
  - phase: 02-fixture-layer
    provides: "fixtures.status='FINISHED' pipeline invariant used by detectFullyFinishedGameweeks"
provides:
  - "submitPredictions extended with losTeamId (backward compatible); enforces mandatory-when-eligible + already-used + fixture resolution"
  - "getLosContext(gwNumber) server action returning activeCompetition + memberStatus + availableTeams + currentPickTeamId"
  - "LosTeamPicker React client component — Radix Select with team crests"
  - "PredictionForm renders picker when member eligible; shows eliminated banner when status='eliminated'"
  - "runLosRound + resetCompetitionIfNeeded orchestrators (application-level, admin client)"
  - "detectH2HForGameweek + resolveStealsForGameweek orchestrators"
  - "detectFullyFinishedGameweeks helper exported from sync.ts"
  - "syncFixtures pipeline runs LOS+H2H hooks post-scoring for fully-finished gameweeks"
affects: [08-03-admin-ui, leaderboard, admin-notifications]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fail-fast pre-check before predictions upsert: LOS eligibility + team-already-used + fixture resolution all run BEFORE any write"
    - "UPSERT on los_picks.id for idempotent orchestrator writes (vs onConflict on composite key for member-facing writes)"
    - "Plain INSERT + 23505 duplicate-key tolerance for h2h_steals idempotency (matches DB UNIQUE constraint shape)"
    - "Sync pipeline hooks wrapped in per-gw try/catch — LOS/H2H errors do not fail sync_log success"
    - "getLosContext de-couples form-rendering from submission enforcement — both use same pure availableTeams() helper"

key-files:
  created:
    - "src/components/los/los-team-picker.tsx"
    - "src/lib/los/round.ts"
    - "src/lib/h2h/sync-hook.ts"
    - "tests/actions/predictions-los.test.ts"
    - "tests/lib/los-round.test.ts"
    - "tests/lib/sync-h2h.test.ts"
  modified:
    - "src/actions/predictions.ts"
    - "src/components/predictions/prediction-form.tsx"
    - "src/app/(member)/gameweeks/[gwNumber]/page.tsx"
    - "src/lib/fixtures/sync.ts"
    - "tests/actions/predictions.test.ts"

key-decisions:
  - "submitPredictions signature: 4th positional param losTeamId with default=null — backward compatible with all existing callers"
  - "Response shape: added top-level losSaved: boolean (not nested) — mirrors bonusSaved field for consistent form UX"
  - "LOS pre-check runs BEFORE predictions upsert — ensures mandatory-pick rejection returns saved=0 (no partial writes)"
  - "LOS already-used query uses .neq('gameweek_id', current) — allows re-submitting pick in same gameweek without false positive"
  - "Kickoff-passed LOS pick → silent skip (losSaved=false), predictions for other fixtures still save — matches Phase 3 FIX-03 per-fixture lockout model"
  - "runLosRound uses outcome IS NULL filter for idempotency (mirrors detectNewlyFinished idiom from Phase 4)"
  - "detectFullyFinishedGameweeks uses HEAD count query (count: 'exact', head: true) for efficient all-FINISHED detection"
  - "h2h_steals insert path: plain INSERT with 23505 duplicate-key tolerance — simpler than upsert+ignoreDuplicates and matches DB UNIQUE(detected_in_gw_id, position)"
  - "Post-scoring pipeline wraps each LOS/H2H orchestrator in try/catch — one orchestrator failure does not halt the others or fail sync_log"
  - "getLosContext loads only approved member's current-GW pick for picker pre-population; excludes current-GW picks from 'used teams' list so the member's own pick stays selectable"

patterns-established:
  - "Pure-helper + DB-orchestrator split: Plan 01 pure evaluators + Plan 02 orchestrators importing them"
  - "Server action with optional action-level helper (getLosContext alongside submitPredictions) — form components get data via companion action, not via the submit action"
  - "Sync pipeline extension pattern: detect-helpers + per-entity orchestrators + try/catch isolation"

requirements-completed: [LOS-01, LOS-03]
# Note: LOS-02, LOS-05, LOS-06, H2H-01, H2H-02 were completed by Plan 01 pure evaluators.
# Plan 02 WIRES those pure functions — integration tests cover the wiring.

# Metrics
duration: 12min
completed: 2026-04-12
---

# Phase 8 Plan 02: Member Submission + Sync Pipeline Integration Summary

**Wired the Plan 01 LOS + H2H pure evaluators into the live application: submitPredictions now accepts losTeamId with full server-side enforcement, the prediction form renders a Radix-based team picker, and the fixture sync pipeline auto-runs LOS round evaluation, competition reset, and H2H tie detection/resolution whenever a gameweek reaches all-FINISHED state.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-12T15:42:31Z
- **Completed:** 2026-04-12T15:54:36Z
- **Tasks:** 2 (both `type="auto" tdd="true"`)
- **Files created:** 6
- **Files modified:** 5
- **Tests added:** 20 (9 predictions-los + 5 los-round + 6 sync-h2h)
- **Full suite:** 308/308 green (was 288/288 after Plan 01)

## Accomplishments

- `submitPredictions` extended with optional 4th parameter `losTeamId`. Backward compatible — every existing test and caller continues to work unchanged. Response gains a top-level `losSaved: boolean`.
- Server-side LOS enforcement flow runs entirely before any predictions upsert: active-competition lookup → member-status lookup → mandatory-when-eligible guard → LOS-03 already-used guard (with current-GW excluded) → fixture resolution → kickoff-gated upsert. Session client used throughout — RLS enforces kickoff lockout.
- New companion action `getLosContext(gwNumber)` exposes the data the form needs — active competition, member status, and a `availableTeams` list computed via the pure `availableTeams()` helper. Current-GW pick pre-populates the picker.
- `LosTeamPicker` client component built on `@radix-ui/react-select` with team crests, touch-friendly 56px targets, and an eliminated-state banner.
- `runLosRound` orchestrator implements the full application-level lifecycle: fixture guard, un-evaluated pick load, pure evaluator call, outcome persistence (idempotent via `outcome IS NULL` on read + upsert on pick.id on write), elimination + missed-member updates, and sole-survivor competition reset.
- `resetCompetitionIfNeeded` closes out the old cycle (status=complete, winner_id, ended_at, ended_at_gw), inserts a new active cycle with the next `competition_num`, enrols every approved member, and fires the two lifecycle notifications.
- `detectH2HForGameweek` + `resolveStealsForGameweek` complete the H2H half — closed_at guard, weekly totals built from `prediction_scores` + confirmed `bonus_awards` only (Pitfall 3), pure tie detection + resolution, plain `INSERT` with 23505 duplicate-key tolerance for idempotency.
- Sync pipeline extended with `detectFullyFinishedGameweeks` helper + per-gw try/catch invocation of all three orchestrators. Errors in one orchestrator never fail sync_log or block others.

## Task Commits

1. **Task 1 RED: LOS submission failing tests** — `bea2b24` (test)
   **Task 1 GREEN: predictions action + form + picker** — `e8cb3a8` (feat)
2. **Task 2 RED: orchestrator failing tests** — `5ef4080` (test)
   **Task 2 GREEN: round.ts + sync-hook.ts + sync.ts integration** — `b333786` (feat)

## Files Created/Modified

### Created

- `src/components/los/los-team-picker.tsx` — 164 LOC Radix Select
- `src/lib/los/round.ts` — 270 LOC (runLosRound + resetCompetitionIfNeeded)
- `src/lib/h2h/sync-hook.ts` — 215 LOC (detectH2HForGameweek + resolveStealsForGameweek + shared loadWeeklyTotals helper)
- `tests/actions/predictions-los.test.ts` — 9 test cases (LOS-01 + LOS-03 submission integration)
- `tests/lib/los-round.test.ts` — 5 test cases (no-active, partial-finished skip, eval+eliminate, competition reset, idempotency)
- `tests/lib/sync-h2h.test.ts` — 6 test cases (closed_at gate, no-ties, position-1 tie, confirmed-only filter, resolution, no-pending)

### Modified

- `src/actions/predictions.ts` — signature +1 param; LOS pre-check block; LOS upsert step; `getLosContext` helper added
- `src/components/predictions/prediction-form.tsx` — accepts `losContext` prop, renders picker/banner, LOS mandatory guard on submit, disables submit when required+empty, success message includes LOS state
- `src/app/(member)/gameweeks/[gwNumber]/page.tsx` — fetches `getLosContext(gwNum)` and passes to form
- `src/lib/fixtures/sync.ts` — imports orchestrators, new `detectFullyFinishedGameweeks` helper, post-scoring pipeline block
- `tests/actions/predictions.test.ts` — test-mock chain extended with `maybeSingle`, `neq`, `in`, `or`, `limit`, `then` to handle new table queries (not a behaviour change — existing 8 test cases all still pass)

## Decisions Made

- **Response shape for losSaved:** top-level field on the result object (parallel to `bonusSaved`). Consumers pattern-match on `result.losSaved` identically to bonus. Rejected: nested `los: { saved: boolean }` — adds indirection for no payoff.
- **Already-used query shape:** `.neq('gameweek_id', currentGwId)` allows the member to re-submit their pick for the current gameweek without false rejection. Any other gameweek in the cycle triggers rejection.
- **Kickoff-passed LOS pick behaviour:** silent skip (don't error), match Phase 3 `canSubmitPrediction` per-fixture model. The member may have legitimately picked before kickoff and only now the server ran — predictions for *other* fixtures (still open) must save as normal.
- **runLosRound idempotency contract:** (1) read picks via `outcome IS NULL`, (2) write via `upsert onConflict: 'id'`, (3) updates to `los_competition_members.status` check `status='active'` to avoid double-elimination. Double-call is proven safe by test case 5.
- **detectFullyFinishedGameweeks implementation:** HEAD count query (`count: 'exact', head: true`) per gameweek — minimal bytes on the wire, no payload. Performed after scoring loop in sync.ts. Unit tested indirectly via the runLosRound partial-finished-skip test.
- **h2h_steals insert strategy:** plain INSERT + tolerate PG 23505 duplicate-key errors. Simpler than `upsert ignoreDuplicates` in terms of mock surface; matches the DB UNIQUE(detected_in_gw_id, position) constraint exactly.
- **Per-orchestrator try/catch in sync.ts:** LOS round failure should not suppress H2H detection and vice versa. Errors are appended to `errors[]` which flags `sync_log.success = false` but the pipeline continues for all three orchestrators per gw.
- **loadWeeklyTotals fixture-id workaround:** `prediction_scores` has `fixture_id` not `gameweek_id`. Helper resolves gw→fixtures first, then queries prediction_scores with `fixture_id IN (...)`. `bonus_awards` has `gameweek_id` directly. Both filtered by `awarded=true` for the H2H Pattern C (Pitfall 3).

## Deviations from Plan

**1. [Rule 3 - Test mock maintenance] Extended existing predictions.test.ts mock chain**

- **Found during:** Task 1 GREEN run
- **Issue:** The new LOS pre-check code calls `.from('los_competitions').select('...').eq('...').maybeSingle()` unconditionally (even when no losTeamId provided). The existing test-helper `createUpsertChain` only exposed `{upsert, select, eq, single}` — it had no `maybeSingle`, `in`, `or`, `limit`, or list-yielding `.then()`. The 5 existing tests that relied on this chain began failing with `maybeSingle is not a function`.
- **Fix:** Added `neq`, `in`, `is`, `or`, `order`, `limit`, `maybeSingle`, `then` to `createUpsertChain`. Behaviour-neutral for existing tests — they never exercised these methods. Also updated the one inline chain in "upserts existing prediction" to match.
- **Files modified:** `tests/actions/predictions.test.ts`
- **Commit:** `e8cb3a8`

**2. [Rule 1 - Test intent mismatch] Adjusted los-round.test.ts "evaluates picks" scenario**

- **Found during:** Task 2 GREEN run
- **Issue:** RED test scenario set up 3 active members (A, B, C) with A as sole survivor, then asserted `winnerId=null`. A sole survivor *should* trigger reset, so the assertion was inconsistent with the stated behaviour. The comment in the test acknowledged the confusion.
- **Fix:** Added a 4th active member D with a winning pick so survivors=[A, D] → no winner yet, no reset. This keeps the test focused on evaluation/elimination mechanics and leaves the reset scenario to the dedicated "triggers competition reset" test.
- **Files modified:** `tests/lib/los-round.test.ts`
- **Commit:** `b333786`

## Authentication Gates

None — plan 02 is fully autonomous and all DB interactions use test-time mocks or (at runtime) the service-role admin client which is already configured.

## Issues Encountered

- **Pre-existing TypeScript errors persist** in `tests/actions/admin/{import,members,prizes}.test.ts` and `tests/lib/scoring.test.ts` + `tests/middleware.test.ts`. None are related to Phase 8 — they were noted in 08-01-SUMMARY as prior-phase test-only type nits. Our changes do not introduce new errors (verified via `npx tsc --noEmit` filtered to changed files).

## Next Phase Readiness

- **Plan 03 (admin UI) decisions locked by Plan 02:**
  - Admin actions will also use the admin client + Zod schemas from `src/lib/validators/los.ts` (already in place from Plan 01).
  - `admin_notifications.member_id` is populated for `los_winner_found` so admin inbox can link to the winner's profile directly.
  - `h2h_steal_detected` / `h2h_steal_resolved` notifications carry just `title` + `message` (no `member_id`) — Plan 03 should consider adding `tied_member_ids` or the steal UUID to `message` text for admin click-through. That's a Plan 03 refinement opportunity, not a blocker.
  - `getLosContext` pattern proven — Plan 03 admin pages can build similar fetch-and-pass helpers.
- **Sync pipeline is now self-wiring** — no additional hooks needed when George closes a gameweek. The next sync run after close will trigger H2H detection for that gw automatically.
- **Blockers/concerns:** none.

## User Setup Required

None — no new environment variables, no new external services, no migrations. Migration 008 (Plan 01) remains to be applied to the live DB at next deploy; these orchestrators become active against live data as soon as that migration lands.

## Self-Check: PASSED

Verified via filesystem + git log:

- `src/components/los/los-team-picker.tsx` — FOUND
- `src/lib/los/round.ts` — FOUND
- `src/lib/h2h/sync-hook.ts` — FOUND
- `tests/actions/predictions-los.test.ts` — FOUND
- `tests/lib/los-round.test.ts` — FOUND
- `tests/lib/sync-h2h.test.ts` — FOUND
- Commit `bea2b24` (Task 1 RED) — FOUND
- Commit `e8cb3a8` (Task 1 GREEN) — FOUND
- Commit `5ef4080` (Task 2 RED) — FOUND
- Commit `b333786` (Task 2 GREEN) — FOUND
- Full test suite: 308 passed / 308 (26 files)

---
*Phase: 08-last-one-standing-h2h*
*Completed: 2026-04-12*
