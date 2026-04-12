# Phase 10 — Deferred Items (Out-of-Scope Findings)

Items discovered during execution that are **not** caused by Phase 10 changes.
Logged per GSD scope-boundary rules; not fixed in this phase.

## Pre-existing Lint Errors (discovered during 10-01 Task 1 lint run)

`npm run lint` surfaces 18 errors + 16 warnings in files unrelated to Phase 10:

- `src/lib/los/round.ts` — 2× `@typescript-eslint/no-explicit-any` (lines 48, 265) + 2 unused-disable warnings (Phase 8 code)
- `tests/actions/auth.test.ts` — 2× `no-explicit-any` (lines 133, 316) + 1 unused var (Phase 1 code)
- `tests/lib/fixtures.test.ts` — 1 unused-var warning (Phase 2 code)
- `tests/lib/scoring.test.ts` — 1 unused-var warning (Phase 4 code)
- Remaining errors/warnings across other pre-existing test files

These were already present before Phase 10 started. Phase 10 code itself is lint-clean.

**Recommendation:** Tackle in a dedicated lint-cleanup pass (could be a quick mini-plan) or let the master QA sheet sweep handle them. Not a launch blocker.
