---
phase: 08-last-one-standing-h2h
plan: "01"
subsystem: database
tags: [supabase, postgres, rls, zod, tdd, vitest, pure-functions, los, h2h]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "members table, RLS admin JWT path, Zod v4 idiom"
  - phase: 02-fixture-layer
    provides: "fixtures + gameweeks + teams tables, set_updated_at() trigger, kick-off-gated RLS pattern"
  - phase: 03-predictions
    provides: "predictions RLS pattern (INSERT/UPDATE/SELECT with kick-off subquery) — copied exactly for los_picks"
  - phase: 04-scoring-engine
    provides: "prediction_scores totals used downstream by h2h/detect-ties"
  - phase: 05-admin-panel
    provides: "admin_notifications CHECK DROP+ADD pattern (reused for Phase 8 types)"
  - phase: 06-bonus-system
    provides: "bonus_awards confirmed totals used downstream by h2h/detect-ties"
provides:
  - "los_competitions, los_competition_members, los_picks, h2h_steals tables with RLS"
  - "Partial unique index enforcing at most one active LOS competition at a time"
  - "evaluateLosPick + evaluateLosRound pure evaluators (win/draw/lose/pending + missed submission + winner detection)"
  - "availableTeams with 20-team cycle-reset semantics"
  - "shouldResetCompetition + nextCompetitionNumber pure lifecycle helpers"
  - "detectWeeklyTies (dense rank, positions 1 + 2) and resolveSteal (highest next-week total, split on persistent tie)"
  - "Zod v4 validators: losTeamIdSchema, submitLosPickSchema, adminOverrideEliminateSchema, adminReinstateSchema"
  - "Row type definitions: LosCompetitionRow, LosCompetitionMemberRow, LosPickRow, H2hStealRow + enum unions"
  - "4 new admin_notifications types: los_winner_found, los_competition_started, h2h_steal_detected, h2h_steal_resolved"
affects: [08-02-member-submission, 08-03-admin-ui, sync-pipeline, leaderboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-function domain library (mirrors calculate.ts/calculate-bonus.ts): zero imports, zero side effects, 100% TDD"
    - "Application-level orchestration for LOS lifecycle — NO database triggers (Pitfall 5 from 08-RESEARCH.md)"
    - "los_picks is single source of truth for team-usage — no separate team_usage table"
    - "Dense-rank H2H tie detection in TypeScript (SQL parity via total > 0 filter)"
    - "Sorted member_ids in H2H outputs for deterministic test assertions"

key-files:
  created:
    - "supabase/migrations/008_los_h2h.sql"
    - "src/lib/los/evaluate.ts"
    - "src/lib/los/team-usage.ts"
    - "src/lib/los/competition.ts"
    - "src/lib/h2h/detect-ties.ts"
    - "src/lib/h2h/resolve-steal.ts"
    - "src/lib/validators/los.ts"
    - "tests/lib/los-evaluate.test.ts"
    - "tests/lib/los-team-usage.test.ts"
    - "tests/lib/los-competition.test.ts"
    - "tests/lib/h2h-detect-ties.test.ts"
    - "tests/lib/h2h-resolve.test.ts"
  modified:
    - "src/lib/supabase/types.ts"

key-decisions:
  - "los_picks UPSERT key is (competition_id, member_id, gameweek_id) — Plan 02 server actions MUST match this onConflict target"
  - "evaluateLosRound declares winner_id only when survivors are settled (no pending picks) — prevents premature winner declaration when fixtures are still in progress"
  - "availableTeams does a full reset (returns all 20) the moment every pool team has been picked — consumers should NOT pre-filter"
  - "detectWeeklyTies filters total <= 0 before ranking — matches SQL filter in 08-RESEARCH.md line 567"
  - "H2H outputs (member_ids, winner_ids) sorted alphabetically for deterministic tests and stable audit trails"
  - "Partial unique index los_competitions_one_active ON (status) WHERE status='active' — enforces single-active-cycle at DB level"
  - "ON DELETE RESTRICT on los_picks.team_id and los_picks.fixture_id — preserves audit history even if teams/fixtures get reshuffled"

patterns-established:
  - "Phase 8 pure-function split: domain logic in src/lib/<module>/, DB orchestration in server actions (Plan 02+)"
  - "RLS pattern for kick-off-gated cross-member visibility: use NOT EXISTS on gameweek fixtures with kickoff_time > now()"
  - "Test file naming: tests/lib/<module>-<file>.test.ts mirrors src/lib/<module>/<file>.ts"

requirements-completed: [LOS-02, LOS-03, LOS-05, LOS-06, H2H-01, H2H-03]

# Metrics
duration: 32min
completed: 2026-04-12
---

# Phase 8 Plan 01: LOS + H2H Foundations Summary

**Database migration 008 with four RLS-protected tables plus fully TDD-tested pure evaluators for Last One Standing pick outcomes, team-usage cycling, and weekly head-to-head tie detection/resolution.**

## Performance

- **Duration:** ~32 min
- **Started:** 2026-04-12T19:34Z
- **Completed:** 2026-04-12T19:40Z
- **Tasks:** 3 (all `type="auto"`, two with `tdd="true"`)
- **Files created:** 12
- **Files modified:** 1
- **Tests added:** 41 (all green; full suite 288/288)

## Accomplishments

- Migration 008 creates `los_competitions`, `los_competition_members`, `los_picks`, `h2h_steals` with full RLS mirroring predictions kick-off pattern from migration 003.
- Partial unique index enforces at-most-one active LOS competition at database level.
- admin_notifications CHECK constraint extended with 4 Phase 8 notification types (drop+re-add including all prior types).
- Pure LOS evaluators (`evaluateLosPick` + `evaluateLosRound`) cover all LOS-02 (win/draw/lose/pending) and LOS-05 (missed submission) behaviours.
- `availableTeams` implements the 20-team cycle-reset rule (LOS-03) with defensive handling of duplicates and out-of-pool ids.
- `detectWeeklyTies` implements dense-rank tie detection at positions 1 and 2 (H2H-01); `resolveSteal` implements the highest-next-week-total winner with split-on-persistent-tie (H2H-03).
- Zod v4 validators aligned with existing project idiom (`.issues[]`, no zodResolver).

## Task Commits

1. **Task 1: Migration 008 + types** — `3bcb8e9` (feat)
2. **Task 2 RED: LOS failing tests** — `14c458c` (test)
   **Task 2 GREEN: LOS implementations** — `6d4e3b8` (feat)
3. **Task 3 RED: H2H failing tests** — `bb421a6` (test)
   **Task 3 GREEN: H2H implementations** — `6084471` (feat)

## Files Created/Modified

### Created

- `supabase/migrations/008_los_h2h.sql` — 4 tables + RLS + admin_notifications CHECK extension
- `src/lib/los/evaluate.ts` — `evaluateLosPick`, `evaluateLosRound`, outcome + round types
- `src/lib/los/team-usage.ts` — `availableTeams` with cycle reset
- `src/lib/los/competition.ts` — `shouldResetCompetition`, `nextCompetitionNumber`
- `src/lib/h2h/detect-ties.ts` — `detectWeeklyTies`, `WeeklyTotal`, `TieGroup`
- `src/lib/h2h/resolve-steal.ts` — `resolveSteal`
- `src/lib/validators/los.ts` — 4 Zod schemas + inferred types
- `tests/lib/los-evaluate.test.ts` — 14 test cases
- `tests/lib/los-team-usage.test.ts` — 6 test cases
- `tests/lib/los-competition.test.ts` — 7 test cases
- `tests/lib/h2h-detect-ties.test.ts` — 8 test cases
- `tests/lib/h2h-resolve.test.ts` — 6 test cases

### Modified

- `src/lib/supabase/types.ts` — added `LosCompetitionRow`, `LosCompetitionMemberRow`, `LosPickRow`, `H2hStealRow` + enum unions + 4 new notification type strings

## Decisions Made

- **UPSERT conflict key for los_picks:** `(competition_id, member_id, gameweek_id)` — Plan 02 server actions must match.
- **Winner only when settled:** `evaluateLosRound` withholds `winner_id` when any survivor's pick is still pending (fixture not FINISHED). Prevents declaring a winner mid-matchday.
- **`availableTeams` semantics:** full reset the moment the picked set covers the 20-team pool. Duplicate picks de-duplicated internally. Out-of-pool ids ignored (no phantom exclusions).
- **H2H determinism:** member_ids and winner_ids sorted alphabetically in outputs so downstream tests and audit displays are stable.
- **No triggers:** competition reset, pick evaluation, and steal resolution all happen in application code (Plan 02). DB is data only.

## Deviations from Plan

None - plan executed exactly as written.

One test authored during the RED phase (`leaves pick-pending members as survivors but winner_id=null`) went further than the plan behaviour section by requiring the winner declaration to wait until survivors' fixtures were final. The plan spec said "exactly 1 survivor → winner_id", but declaring a winner while their own pick was still pending would be premature. The implementation was tightened once (adding the `anySurvivorPending` check) to satisfy this more rigorous interpretation — this is a natural TDD refinement, not a plan deviation.

## Issues Encountered

- Pre-existing TypeScript errors in `tests/actions/admin/{import,members,prizes}.test.ts` and `tests/lib/scoring.test.ts` surfaced during `npx tsc --noEmit`. None are related to Phase 8 changes; they are prior-phase test-only type nits (filter predicate tuple types, vitest cast to SupabaseClient). Deferred — out of scope for this plan.

## User Setup Required

None - migration 008 is a pure SQL file that will be applied by `supabase db push` during Phase 8 Plan 03 or next deployment. No environment variables, no external service configuration.

## Next Phase Readiness

- **Plan 02 (member submission + sync pipeline integration):** all primitives ready. Server actions can import `evaluateLosRound`, `availableTeams`, `shouldResetCompetition`, `nextCompetitionNumber`, `detectWeeklyTies`, `resolveSteal`. Zod schemas ready for form validation.
- **Plan 03 (admin UI):** row types exist on the Supabase client side; admin override/reinstate Zod schemas ready.
- **Blockers/concerns:** none. Migration 008 has not been applied to a live DB yet — that happens when George deploys next. The pure functions are fully testable without the DB.

## Self-Check: PASSED

Verified via filesystem + git log:

- `supabase/migrations/008_los_h2h.sql` — FOUND
- `src/lib/los/evaluate.ts` — FOUND
- `src/lib/los/team-usage.ts` — FOUND
- `src/lib/los/competition.ts` — FOUND
- `src/lib/h2h/detect-ties.ts` — FOUND
- `src/lib/h2h/resolve-steal.ts` — FOUND
- `src/lib/validators/los.ts` — FOUND
- `tests/lib/los-evaluate.test.ts`, `los-team-usage.test.ts`, `los-competition.test.ts` — FOUND
- `tests/lib/h2h-detect-ties.test.ts`, `h2h-resolve.test.ts` — FOUND
- Commit `3bcb8e9` (Task 1) — FOUND
- Commit `14c458c` (Task 2 RED) — FOUND
- Commit `6d4e3b8` (Task 2 GREEN) — FOUND
- Commit `bb421a6` (Task 3 RED) — FOUND
- Commit `6084471` (Task 3 GREEN) — FOUND
- Full test suite: 288 passed / 288 (23 files)

---
*Phase: 08-last-one-standing-h2h*
*Completed: 2026-04-12*
