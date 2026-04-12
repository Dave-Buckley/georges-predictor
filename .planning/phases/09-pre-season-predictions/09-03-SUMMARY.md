---
phase: 09-pre-season-predictions
plan: 03
subsystem: pre-season-admin-flow

tags: [nextjs, react, server-action, supabase, vitest, typescript, postgres, migration, rls]

# Dependency graph
requires:
  - phase: 09-pre-season-predictions
    provides: calculatePreSeasonPoints, seasonActualsSchema, confirmPreSeasonAwardSchema, getPreSeasonExportRows, getCurrentSeason, getUpcomingSeason, setPreSeasonPicksForMember, LateJoinerPicksDialog, CHAMPIONSHIP_TEAMS_2025_26
  - phase: 07-mid-season-import
    provides: pre_season_picks table populated from spreadsheet import
provides:
  - setSeasonActuals server action (locks season-end actuals, gates calculation)
  - calculatePreSeasonAwards server action (iterates picks → upserts awards, emits admin notifications, preserves confirmed rows)
  - confirmPreSeasonAward server action (per-member confirm with optional override_points)
  - bulkConfirmPreSeasonAwards server action (confirm-all for a season)
  - /admin/pre-season page (3 conditional sections — monitoring / actuals / confirmation) + Championship management + rollover
  - AdminPreSeasonTable, SeasonActualsForm, ConfirmPreSeasonAwards, ChampionshipManagement, EndOfSeasonRollover components
  - DB-backed championship_teams table (migration 010) replacing the hardcoded CHAMPIONSHIP_TEAMS_2025_26 constant
  - endOfSeasonRollover server action (auto-swaps 3 relegated PL ↔ 3 promoted Championship based on locked actuals)
  - getChampionshipTeams / addChampionshipTeam / removeChampionshipTeam / renameChampionshipTeam admin actions
  - isChampionshipTeam helper refactored from in-memory array lookup to async DB query
  - Admin sidebar "Pre-Season" link (Crown icon)
  - Admin dashboard conditional pre-season action card (submissions / actuals / confirmation urgency states)
affects: [10-reports: getPreSeasonExportRows now reads confirmed awards; 11-polish: admin UX surfaces all stable]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - DB-backed lookup replacing hardcoded constants at application boundaries (Championship team list) — zero dev intervention at season rollover
    - Idempotent calculation with preserve-on-re-run semantics (confirmed=true awards keep their awarded_points across recalculation)
    - Application-side rollover orchestration with sanity gates (no triggers) — matches Phase 8 LOS no-DB-trigger decision
    - Pattern 5 try/catch wrapping for admin_notifications inserts — notification failure never fails primary action
    - Two-step destructive confirmation for rollover (preview → confirm) — mirrors reset dialogs elsewhere in admin

key-files:
  created:
    - supabase/migrations/010_championship_teams.sql
    - src/actions/admin/championship.ts
    - src/app/(admin)/admin/pre-season/page.tsx
    - src/app/(admin)/admin/pre-season/_components/admin-pre-season-table.tsx
    - src/app/(admin)/admin/pre-season/_components/season-actuals-form.tsx
    - src/app/(admin)/admin/pre-season/_components/confirm-pre-season-awards.tsx
    - src/app/(admin)/admin/pre-season/_components/championship-management.tsx
    - src/app/(admin)/admin/pre-season/_components/end-of-season-rollover.tsx
    - tests/actions/admin/championship.test.ts
  modified:
    - src/actions/admin/pre-season.ts (added setSeasonActuals, calculatePreSeasonAwards, confirmPreSeasonAward, bulkConfirmPreSeasonAwards)
    - src/app/(admin)/admin/dashboard/page.tsx (pre-season conditional action card)
    - src/components/admin/sidebar.tsx (Pre-Season nav entry)
    - src/lib/teams/championship.ts (array lookup → async DB query)
    - tests/actions/admin/pre-season.test.ts (extended coverage for 4 new actions + DB-backed Championship validation)
    - docs/FINAL_QA_CHECKLIST.md (expanded §10 with the full Phase 9 QA script)

key-decisions:
  - "Pre-season aggregation deferred to Phase 10 export-time SUM — no central aggregator exists yet; computeDisplayTotal covers only bonuses/prizes. Adding pre-season here would require broader refactor best done alongside the Phase 10 export/reports surfaces."
  - "DB-backed Championship list (migration 010) added mid-plan replacing the hardcoded CHAMPIONSHIP_TEAMS_2025_26 constant. Constant file retained as seed/reference documentation; the `championship_teams` table is now authoritative."
  - "endOfSeasonRollover reads season-end actuals George already entered (final_relegated + final_promoted) — single source of truth, no duplicate data entry."
  - "Rollover sanity gates: rejects if any final_relegated is not currently in teams OR any final_promoted is not currently in championship_teams — prevents silent data corruption from stale actuals."
  - "Rollover is idempotent via set-difference checks before writes; re-runs are safe no-ops that still log an admin_notifications entry."
  - "calculatePreSeasonAwards preserves confirmed=true rows' awarded_points on re-calc (George's manual overrides are protected); only calculated_points and flags are rewritten."
  - "Admin notifications (pre_season_awards_ready, pre_season_all_correct, pre_season_category_correct, season_rollover_complete) all wrapped in try/catch — notification failure never fails the primary action (Pattern 5)."
  - "Dashboard pre-season card uses 3 urgency states (submissions open / actuals needed / awards pending) — falls through to no card when all resolved, avoiding clutter."
  - "Manual QA at Task 4 deferred to the end-of-project master QA sheet (docs/FINAL_QA_CHECKLIST.md §10) rather than blocking plan close — user-approved resume signal received 2026-04-12."

patterns-established:
  - "Admin action quartet (setActuals → calculate → confirmOne / confirmBulk) — mirrors Phase 5 bonus confirmation flow; reusable template for future season-end admin surfaces"
  - "Preview + confirm dialog for destructive season-boundary operations — shows the diff (teams moving in/out) before the user commits"
  - "DB-backed reference data migration pattern: migration creates table + seeds from retired constant + updates helpers to async — future Championship-list changes need only admin UI, never code"

requirements-completed: [PRE-01, PRE-02, PRE-03, PRE-04, PRE-05]

# Metrics
duration: ~25min
completed: 2026-04-12
---

# Phase 9 Plan 3: Admin Pre-Season Flow + DB-Backed Championship Rollover Summary

**Completed Phase 9's admin loop with setActuals/calculate/confirm/bulkConfirm actions, a 3-section /admin/pre-season page, and replaced the hardcoded Championship constant with a DB-backed list plus a one-button end-of-season rollover.**

## Performance

- **Duration:** ~25 min (execution across 3 auto tasks + 1 deferred checkpoint)
- **Tasks:** 4 (3 executed, 1 deferred to master QA sheet)
- **Files modified:** 14 (9 created, 5 modified)
- **Tests:** 439/439 passing
- **Build:** clean

## Accomplishments

- 4 new admin server actions tested and shipped: `setSeasonActuals`, `calculatePreSeasonAwards`, `confirmPreSeasonAward`, `bulkConfirmPreSeasonAwards` — all with `requireAdmin` guards, Zod validation, idempotent upsert semantics, and try/catch-wrapped admin notifications.
- `/admin/pre-season` page renders 3 conditional sections (monitoring → actuals entry → awards confirmation) plus Championship management and end-of-season rollover, all driven by a single data load.
- DB-backed Championship list replacing the hardcoded constant — migration 010 seeds the 24 current teams, RLS allows member SELECT (so the member form still works) and restricts writes to admin.
- End-of-season rollover: single-button operation that reads locked actuals, previews the PL ↔ Championship swap, and executes idempotently with sanity gates and `season_rollover_complete` notification.
- Admin sidebar and dashboard wired — Pre-Season link (Crown icon) plus urgency-ordered dashboard action card.

## Task Commits

1. **Task 1: Admin actions — setSeasonActuals, calculate, confirm, bulkConfirm** (TDD)
   - `d504645` (test: RED — failing tests for all 4 actions)
   - `28723f0` (feat: GREEN — implementation + notification side-effects)

2. **Task 2: Admin /admin/pre-season page + sidebar + dashboard card**
   - `d25f026` (feat)

3. **Task 3: Migration 010 + DB-backed Championship + end-of-season rollover** (TDD)
   - `5437019` (test: RED — migration 010 + failing tests for championship quartet + rollover + DB-backed isChampionshipTeam assertions)
   - `9278eaa` (feat: GREEN — implementation, helper refactor, UI components wired)

4. **Task 4: Manual QA checkpoint** — deferred to `docs/FINAL_QA_CHECKLIST.md` §10 (approved by user 2026-04-12).

**Plan metadata commit:** (this commit) — SUMMARY + STATE + ROADMAP + REQUIREMENTS.

## Files Created/Modified

Created:
- `supabase/migrations/010_championship_teams.sql` — table, RLS, seed from `CHAMPIONSHIP_TEAMS_2025_26`
- `src/actions/admin/championship.ts` — get/add/remove/rename + `endOfSeasonRollover`
- `src/app/(admin)/admin/pre-season/page.tsx` — 3-section page
- `src/app/(admin)/admin/pre-season/_components/admin-pre-season-table.tsx` — monitoring table with late-joiner triggers
- `src/app/(admin)/admin/pre-season/_components/season-actuals-form.tsx` — 12-slot actuals entry
- `src/app/(admin)/admin/pre-season/_components/confirm-pre-season-awards.tsx` — per-member review with per-row + bulk apply
- `src/app/(admin)/admin/pre-season/_components/championship-management.tsx` — add/rename/remove Championship teams
- `src/app/(admin)/admin/pre-season/_components/end-of-season-rollover.tsx` — preview + confirm dialog
- `tests/actions/admin/championship.test.ts` — 12 tests (CRUD + rollover + RLS/admin gates)

Modified:
- `src/actions/admin/pre-season.ts` — appended 4 new actions to Plan 02's file
- `src/app/(admin)/admin/dashboard/page.tsx` — conditional pre-season action card (submissions / actuals / awards-pending states)
- `src/components/admin/sidebar.tsx` — "Pre-Season" link with Crown icon
- `src/lib/teams/championship.ts` — `isChampionshipTeam` refactored from array lookup to async DB query
- `tests/actions/admin/pre-season.test.ts` — extended with coverage for the 4 new actions + DB-backed Championship validation

## Decisions Made

- **Pre-season aggregation into display totals deferred to Phase 10:** No central aggregator exists today (`computeDisplayTotal` only covers bonuses/prizes). Rather than introduce a broader refactor here, Phase 10's export surfaces will SUM `pre_season_awards.awarded_points WHERE confirmed=true` at read time alongside other sources. Documented so Phase 10 can pick up the thread cleanly.
- **DB-backed Championship list added mid-plan:** User request during this plan's execution — "replace the hardcoded list so I never have to touch code at season boundaries." Migration 010 + helper refactor + admin UI + rollover button all landed in Task 3. The constant file stays as seed/reference with a comment pointing to the authoritative table.
- **Rollover sanity gates:** Refuses to run if any `final_relegated` team isn't in `teams` or any `final_promoted` team isn't in `championship_teams` — prevents silent data corruption from stale actuals.
- **Rollover idempotency by set-difference:** Re-running after a successful rollover is a no-op that still logs a notification — operator can safely click twice without damage.
- **Confirmed row preservation on re-calc:** Editing actuals and re-running calculate overwrites `calculated_points` for all rows but leaves `awarded_points` untouched on rows where `confirmed=true`. Guards George's manual overrides against accidental recalc.

## Deviations from Plan

### Mid-plan scope addition (not a deviation per deviation rules — explicit user-requested plan amendment committed as `8d5e513 plan(09-03): add DB-backed Championship list + end-of-season rollover task`)

**Task 3 was added to the plan mid-execution** (2026-04-12) after user feedback that the hardcoded `CHAMPIONSHIP_TEAMS_2025_26` constant shipped in Plan 01 would force a dev to touch code every year at season boundaries. The plan was updated and committed before execution resumed, so this followed the plan-change protocol rather than the deviation protocol.

**Impact:** +1 task, +1 migration (010), +~300 LOC across actions/components/tests. All prior 398 tests remained green after the array→DB refactor; total suite now 439 green.

### Auto-fixes during execution

None — the 3 executed tasks ran clean on the first GREEN pass after RED. No Rule 1/2/3 fixes applied.

### Deferred items

**Manual QA checkpoint (Task 4):** User approved deferring the 8-section (now 9-section) manual QA script to the master end-of-project QA sheet at `docs/FINAL_QA_CHECKLIST.md` §10. The full script has been merged into that document and the Phase 9 vertical slice is considered verified-pending-final-QA. Not skipped — scheduled for the pre-launch QA pass.

---

**Total deviations:** 0 deviation-rule fixes; 1 explicit plan amendment (user-requested mid-plan scope addition, committed as plan-edit before execution).
**Impact on plan:** Scope grew 33% (3 → 4 tasks) but delivered a materially better outcome (zero-code-change season rollover). No analysis paralysis, no blockers.

## Issues Encountered

None during execution. The array→DB refactor of `isChampionshipTeam` required updating every call site to `await` the helper, but all callers were already in async server-action contexts, so no interface gymnastics were needed.

## Phase 9 Final File Inventory

Across Plans 01, 02, 03 — Phase 9 shipped:

**Migrations:**
- `009_pre_season_tables.sql` (Plan 01)
- `010_championship_teams.sql` (Plan 03)

**Pure libs:**
- `src/lib/pre-season/calculate.ts`
- `src/lib/pre-season/seasons.ts`
- `src/lib/pre-season/export.ts`
- `src/lib/validators/pre-season.ts`
- `src/lib/teams/championship.ts` (DB-backed)
- `src/lib/teams/championship-2025-26.ts` (constant, retained as seed reference)

**Server actions:**
- `src/actions/pre-season.ts` (member `submitPreSeasonPicks`)
- `src/actions/admin/pre-season.ts` (6 actions: `setPreSeasonPicksForMember`, `setSeasonActuals`, `calculatePreSeasonAwards`, `confirmPreSeasonAward`, `bulkConfirmPreSeasonAwards`)
- `src/actions/admin/championship.ts` (5 actions: get/add/remove/rename + `endOfSeasonRollover`)

**Member surfaces:**
- `/pre-season` route + PreSeasonPicker/Form/ReadOnly components + nav link

**Admin surfaces:**
- `/admin/pre-season` page with 5 sub-components (table, actuals form, confirmation, championship management, rollover)
- Sidebar "Pre-Season" link (Crown icon)
- Dashboard conditional action card

**Tests:** ~65 new tests across Plans 01–03 (pure calc, seasons helper, export, validators, member action, admin action quartet, championship quartet + rollover). Suite: 439/439 green.

## User Setup Required

None - no external service configuration required. Migration 010 applies automatically via `supabase db push` alongside the rest of the schema.

## Next Phase Readiness

**Phase 9 complete.** Ready for Phase 10 (Reports & Exports):
- `getPreSeasonExportRows(season)` contract stable — Phase 10 consumes the flat shape directly.
- Confirmed pre-season awards need to be SUMmed into the export/reports display totals — noted in Decisions above as Phase 10 scope.
- No blockers. No open questions on Phase 9's surface.

## Self-Check: PASSED

Verified:
- All 5 task commits present in git log: `d504645`, `28723f0`, `d25f026`, `5437019`, `9278eaa`
- All created files exist on disk (verified via plan files_modified list against repo state)
- Tests green (439/439) and build clean at handoff
- `docs/FINAL_QA_CHECKLIST.md` §10 expanded with full 9-section Phase 9 QA script

---
*Phase: 09-pre-season-predictions*
*Completed: 2026-04-12*
