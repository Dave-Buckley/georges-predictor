---
phase: 02-fixture-layer
plan: 02
subsystem: ui
tags: [next.js, supabase, react, server-actions, radix-ui, tailwind]

# Dependency graph
requires:
  - phase: 02-fixture-layer/02-01
    provides: DB schema (teams, gameweeks, fixtures, sync_log), type definitions, Zod validators, syncFixtures engine

provides:
  - addFixture/editFixture/moveFixture/triggerSync server actions with full auth guard and kickoff guard enforcement
  - SyncStatus component (last-synced timestamp + Sync Now button) on both /admin and /admin/gameweeks
  - Admin gameweeks overview page (/admin/gameweeks) with all 38 GW listed, counts, status badges
  - Single gameweek management page (/admin/gameweeks/[gwNumber]) with fixture cards and edit/move actions
  - FixtureDialog/FixtureForm (add/edit) with team dropdowns, kickoff guard UI, admin override toggle, confirmation dialogs
  - MoveFixtureDialog with confirmation and admin notification creation
  - Gameweeks sidebar link enabled

affects: [03-prediction-layer, 06-scoring, 08-reporting]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Server actions pattern with requireAdmin() guard + Zod validation + createAdminClient() for DB writes
    - Kickoff guard: server-side blocks after-kickoff edits unless admin_override=true passed in FormData
    - Client component dialog pattern with useTransition for server action pending state
    - SyncResult passed as prop from server page to client SyncStatus component

key-files:
  created:
    - src/actions/admin/fixtures.ts
    - src/components/admin/sync-status.tsx
    - src/components/admin/fixture-form.tsx
    - src/components/admin/move-fixture-dialog.tsx
    - src/app/(admin)/admin/gameweeks/page.tsx
    - src/app/(admin)/admin/gameweeks/[gwNumber]/page.tsx
  modified:
    - src/app/(admin)/admin/page.tsx
    - src/components/admin/sidebar.tsx
    - tests/actions/admin/fixtures.test.ts

key-decisions:
  - "Kickoff guard server-side: blocks kickoff_time change after kickoff unless admin_override=true in FormData; scores/status always editable without override"
  - "Negative external_id for manual fixtures (e.g. -Date.now()) prevents collision with football-data.org positive integer IDs"
  - "SyncStatus receives lastSync as prop from server page — keeps sync data fresh on each page load without client-side fetching"
  - "Zod v4 UUID validation requires real UUID version bits — test fixtures must use proper UUID v4 format"
  - "MoveFixtureDialog is separate component from FixtureForm to keep each dialog focused and simple"

patterns-established:
  - "Pattern: Admin server actions always follow requireAdmin() -> safeParse(Zod) -> createAdminClient() -> DB op -> revalidatePath"
  - "Pattern: Client component dialogs use useTransition + window.location.reload() on success for immediate state refresh"
  - "Pattern: Kickoff guard UI mirrors server guard — same hasKickedOff check in both server action and component"

requirements-completed: [FIX-04, FIX-05]

# Metrics
duration: 8min
completed: 2026-04-11
---

# Phase 02 Plan 02: Admin Fixture Management UI Summary

**Admin fixture CRUD with server-side kickoff guard, SyncStatus on dashboard and gameweeks overview, FixtureForm dialog with admin override toggle, MoveFixtureDialog, and all 38 GWs listed in admin panel**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-11T19:18:40Z
- **Completed:** 2026-04-11T19:26:19Z
- **Tasks:** 2
- **Files modified:** 9 (7 created, 2 updated)

## Accomplishments

- All 4 server actions (addFixture, editFixture, moveFixture, triggerSync) with full auth guard and Zod validation
- editFixture enforces kickoff guard: blocks kickoff_time changes post-kickoff unless admin_override=true; scores/status always editable
- Admin gameweeks overview page showing all 38 GWs with fixture counts, status badges, and manage links
- SyncStatus component deployed on both /admin dashboard and /admin/gameweeks page (locked decision honoured)
- FixtureForm with kickoff guard UI: read-only time field + admin override toggle with warning when fixture has kicked off
- 16 automated tests covering all server action contracts including kickoff guard edge cases

## Task Commits

1. **Task 1: Admin fixture server actions** - `22956b2` (feat)
2. **Task 2: Admin gameweeks UI pages and components** - `fece817` (feat)

## Files Created/Modified

- `src/actions/admin/fixtures.ts` - addFixture, editFixture (kickoff guard), moveFixture, triggerSync server actions
- `src/components/admin/sync-status.tsx` - Last-synced bar with Sync Now button, loading/error states
- `src/components/admin/fixture-form.tsx` - FixtureForm + FixtureDialog for add/edit with kickoff guard UI
- `src/components/admin/move-fixture-dialog.tsx` - Move-to-gameweek dialog with confirmation
- `src/app/(admin)/admin/gameweeks/page.tsx` - Overview of all 38 GWs, SyncStatus at top, first-sync CTA
- `src/app/(admin)/admin/gameweeks/[gwNumber]/page.tsx` - Single GW fixtures by date with edit/move actions
- `src/app/(admin)/admin/page.tsx` - Updated with SyncStatus in Fixture Sync section
- `src/components/admin/sidebar.tsx` - Gameweeks link enabled (disabled: true removed)
- `tests/actions/admin/fixtures.test.ts` - 16 tests for all 4 server actions

## Decisions Made

- **Negative external_id for manual fixtures:** Using `-Date.now()` to avoid collision with football-data.org positive integer IDs
- **Zod v4 UUID format:** Discovered Zod v4 rejects non-standard UUID formats (e.g., `11111111-1111-...`) — tests must use real UUID v4 format with correct version bits
- **SyncStatus as prop-based:** `lastSync: SyncLogRow | null` passed from server page so each page load gets fresh data without client fetching
- **MoveFixtureDialog separate from FixtureForm:** Keeps each component focused; form handles add/edit, separate dialog handles gameweek reassignment

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Zod v4 UUID validation rejects non-standard test UUIDs**
- **Found during:** Task 1 (test execution)
- **Issue:** Zod v4 validates UUID version bits — `11111111-1111-1111-1111-111111111111` fails `.uuid()` because version nibble `1` at position 14 in format `xxxxxxxx-xxxx-Mxxx...` must indicate a valid UUID version
- **Fix:** Replaced all test UUID constants with proper UUID v4 format values (e.g., `f47ac10b-58cc-4372-a567-0e02b2c3d479`)
- **Files modified:** tests/actions/admin/fixtures.test.ts
- **Verification:** All 16 tests pass
- **Committed in:** 22956b2 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug in test UUIDs)
**Impact on plan:** Test-only fix. No production code affected. Plan executed exactly as specified.

## Issues Encountered

None — all implementation proceeded as planned after the UUID test fix.

## User Setup Required

None — no external service configuration required for this plan.

## Next Phase Readiness

- Admin fixture management fully functional — George can sync, add, edit, move fixtures
- Kickoff guard enforced server-side (FIX-03) — ready for Phase 3 prediction layer
- SyncStatus visible on both admin pages as required by locked decisions
- All 38 gameweeks accessible via /admin/gameweeks with per-fixture management
- Ready for Phase 3: prediction submission forms and lockout enforcement

---
*Phase: 02-fixture-layer*
*Completed: 2026-04-11*
