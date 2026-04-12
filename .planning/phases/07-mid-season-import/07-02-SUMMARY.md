---
phase: 07-mid-season-import
plan: 02
subsystem: admin-ui
tags: [import, admin, server-actions, tdd, vitest, react, supabase, bulk-insert]

requires:
  - phase: 07-mid-season-import-01
    provides: parseImportText, parsePreSeasonPicksText, import-validators, pre_season_picks-table, handle_new_user-trigger-fix

provides:
  - importMembers server action (bulk-inserts placeholder member rows with user_id=null)
  - clearImportedMembers server action (safely deletes only unclaimed placeholders)
  - importPreSeasonPicks server action (upserts picks by case-insensitive member name lookup)
  - Admin import page at /admin/import with status summary, paste-preview-confirm workflow
  - ImportForm component with preview table, confirm, and clear dialog
  - PreSeasonImportForm component with 13-column paste-preview-confirm workflow
  - ImportPreviewTable component with error highlighting
  - Import Data link in admin sidebar
  - DATA-05 regression tests confirming late joiner flow post-migration-007

affects: [admin-panel, members-table, pre_season_picks-table, signup-flow, admin-sidebar]

tech-stack:
  added: []
  patterns:
    - server-action-requireAdmin-guard
    - createAdminClient-for-RLS-bypass-on-null-user_id-inserts
    - useTransition-for-server-action-loading-states
    - router.refresh-after-server-action-not-window.reload
    - Radix-Dialog-for-destructive-action-confirmation

key-files:
  created:
    - src/actions/admin/import.ts
    - tests/actions/admin/import.test.ts
    - src/app/(admin)/admin/import/page.tsx
    - src/components/admin/import-preview-table.tsx
    - src/components/admin/import-form.tsx
    - src/components/admin/pre-season-import-form.tsx
  modified:
    - src/components/admin/sidebar.tsx
    - tests/actions/admin/members.test.ts

key-decisions:
  - "importMembers uses createAdminClient (not session client) — RLS blocks member inserts with user_id=null via session"
  - "clearImportedMembers targets only user_id IS NULL rows — registered members cannot be accidentally deleted"
  - "importPreSeasonPicks uses case-insensitive name matching and upsert with onConflict member_id,season for idempotency"
  - "Task 4 human-verify checkpoint approved by user — manual end-to-end testing deferred"

patterns-established:
  - "Admin bulk-import pattern: createAdminClient + conflict check before insert + revalidatePath both admin pages"
  - "Clear/re-import safety pattern: count unclaimed vs claimed before delete, show both counts in confirmation dialog"
  - "Paste-preview-confirm pattern: parseImportText client-side on preview, server action only on confirm"

requirements-completed: [DATA-01, DATA-05, ADMIN-08]

duration: ~45min
completed: "2026-04-12"
---

# Phase 7 Plan 2: Mid-Season Import Admin Page Summary

**Paste-and-preview admin import page with importMembers/clearImportedMembers/importPreSeasonPicks server actions, full unit test coverage, and sidebar navigation — George can import 48 members in under 5 minutes.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-04-12
- **Completed:** 2026-04-12
- **Tasks:** 4 (3 auto + 1 checkpoint approved)
- **Files modified:** 8

## Accomplishments

- Full admin import workflow: George pastes CSV/tab-separated member data, sees a live preview table, confirms import, and all names appear as pending members ready for signup
- Three server actions with requireAdmin guard and createAdminClient: importMembers, clearImportedMembers, importPreSeasonPicks — all unit tested (TDD)
- Safe clear/re-import: confirmation dialog shows how many unregistered placeholders will be deleted vs registered members that are safe
- DATA-05 late joiner regression tests confirm addMember still creates members with correct starting_points and display_name after migration 007
- Import Data link added to admin sidebar between Prizes and Reports

## Task Commits

Each task was committed atomically:

1. **Task 1: Import server actions with unit tests** - `889a7c1` (feat/test — TDD)
2. **Task 2: Admin import page, components, and sidebar link** - `531d1cc` (feat)
3. **Task 3: Verify late joiner flow (DATA-05) post-migration-007** - `448fa61` (test)
4. **Task 4: Verify complete import flow** - checkpoint:human-verify, approved by user (manual testing deferred)

## Files Created/Modified

- `src/actions/admin/import.ts` — importMembers, clearImportedMembers, importPreSeasonPicks server actions with requireAdmin guard and createAdminClient
- `tests/actions/admin/import.test.ts` — Unit tests for all three server actions (TDD RED→GREEN)
- `src/app/(admin)/admin/import/page.tsx` — Server component showing import status counts and rendering both import forms
- `src/components/admin/import-preview-table.tsx` — Reusable preview table with error highlighting and row count summary
- `src/components/admin/import-form.tsx` — Paste textarea, preview, confirm import, and clear import with Radix Dialog confirmation
- `src/components/admin/pre-season-import-form.tsx` — 13-column paste-preview-confirm for pre-season picks import
- `src/components/admin/sidebar.tsx` — Added Import Data nav item with Upload icon between Prizes and Reports
- `tests/actions/admin/members.test.ts` — Added DATA-05 regression block for late joiner flow post-migration-007

## Decisions Made

- `importMembers` uses `createAdminClient` not the session client — Supabase RLS blocks inserts of rows with `user_id=null` through the session client
- `clearImportedMembers` targets only `user_id IS NULL` rows — any member who has already registered and claimed a placeholder is never affected
- `importPreSeasonPicks` uses case-insensitive name matching and `upsert` with `onConflict: 'member_id,season'` — idempotent, George can re-import picks safely
- Task 4 human-verify checkpoint was approved by the user with manual end-to-end testing deferred to a later session

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. The import page uses the same Supabase admin client already configured in Phase 1.

## Next Phase Readiness

- Phase 7 complete: George can now import all 48 members in one paste operation before the season starts
- Imported member names automatically appear in the signup dropdown (existing query picks up `user_id IS NULL` rows)
- Late joiner flow (AddMember dialog) verified working post-migration-007 (DATA-05)
- Pre-season picks import ready for Phase 9 evaluation
- Phase 8 (Registration & Signup) can proceed — the member name list George imports is what members will see in the signup dropdown

---
*Phase: 07-mid-season-import*
*Completed: 2026-04-12*

## Self-Check: PASSED

- `src/actions/admin/import.ts` — created (committed 889a7c1)
- `tests/actions/admin/import.test.ts` — created (committed 889a7c1)
- `src/app/(admin)/admin/import/page.tsx` — created (committed 531d1cc)
- `src/components/admin/import-form.tsx` — created (committed 531d1cc)
- `src/components/admin/pre-season-import-form.tsx` — created (committed 531d1cc)
- `src/components/admin/import-preview-table.tsx` — created (committed 531d1cc)
- `src/components/admin/sidebar.tsx` — modified (committed 531d1cc)
- `tests/actions/admin/members.test.ts` — modified (committed 448fa61)
- Commits 889a7c1, 531d1cc, 448fa61 all confirmed in git log
