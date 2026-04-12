---
phase: 08-last-one-standing-h2h
plan: "03"
subsystem: ui
tags: [nextjs, react, radix-dialog, supabase-rls, server-actions, tailwind, lucide, los, h2h]

# Dependency graph
requires:
  - phase: 08-last-one-standing-h2h
    provides: "los_competitions/los_competition_members/los_picks/h2h_steals schema, resetCompetitionIfNeeded, detectH2HForGameweek, resolveStealsForGameweek, adminOverrideEliminateSchema, adminReinstateSchema"
  - phase: 05-admin-panel
    provides: "requireAdmin gating, admin sidebar navItems pattern, close-gameweek-dialog idiom, admin_notifications system table"
  - phase: 03-predictions
    provides: "submitPredictions action + LosTeamPicker integration from 08-02"
provides:
  - "Admin LOS management page (/admin/los) with override/reinstate/reset/set-pick actions"
  - "Member LOS status page (/los) with status card + standings"
  - "H2H steal banner component shown inline on gameweek page"
  - "closeGameweek admin action now triggers detectH2HForGameweek + resolveStealsForGameweek non-blocking"
  - "Admin sidebar 'Last One Standing' link (Crown icon)"
  - "Four requireAdmin-gated server actions: overrideEliminate, reinstateMember, resetCompetitionManually, setLosPickForMember"
affects: [phase-09-historical-data, phase-10-reports, phase-11-launch-qa]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server action + Radix Dialog idiom for destructive admin actions (confirm + reason select + formAction)"
    - "Non-blocking orchestrator pattern inside closeGameweek: H2H failures logged to admin_notifications, never halt the close op"
    - "Three-stage H2H banner variants (detected / resolving / resolved) driven by detected_in_gw_id vs resolves_in_gw_id vs resolved_at"
    - "LOS standings ordering: active first (teams-used ASC, alpha tiebreak), eliminated after (eliminated_at_gw DESC, alpha)"

key-files:
  created:
    - src/actions/admin/los.ts
    - src/app/(admin)/admin/los/page.tsx
    - src/app/(member)/los/page.tsx
    - src/components/los/admin-los-table.tsx
    - src/components/los/los-status-card.tsx
    - src/components/los/los-standings.tsx
    - src/components/h2h/h2h-steal-banner.tsx
    - tests/actions/admin/los.test.ts
  modified:
    - src/actions/admin/gameweeks.ts
    - src/app/(member)/gameweeks/[gwNumber]/page.tsx
    - src/app/(member)/layout.tsx
    - src/components/admin/sidebar.tsx
    - tests/actions/admin/gameweeks.test.ts

key-decisions:
  - "Admin actions wrapped requireAdmin + adminClient pattern matching Phase 5 bonuses action idiom exactly — zero drift from established conventions"
  - "closeGameweek H2H integration is non-blocking: try/catch wraps detectH2HForGameweek + resolveStealsForGameweek, failures write admin_notifications.system with action='h2h_detect_failed' metadata"
  - "resetCompetitionManually accepts winner_id?: string | null — when null, George is forcing a reset with no winner (explicit override); when set, reuses resetCompetitionIfNeeded happy path"
  - "setLosPickForMember bypasses kickoff guard (admin correction scenario) but still enforces team-not-already-used-in-cycle validation"
  - "Admin LOS table ordering computed in the client component (not SQL) — keeps the page server fetch simple (single JOIN), sorting logic colocated with presentation"
  - "H2H steal banner stages: 'detected' (this week it was flagged for NEXT week's resolution), 'resolving' (resolution week, no winner yet), 'resolved' (winners set) — driven purely by row state, no extra columns"
  - "Member LOS page standings list excludes current-GW picks per RLS — page intentionally never queries other members' current picks, only teams-used counts"

patterns-established:
  - "Admin destructive-action dialog: Radix Dialog + hidden inputs + formAction server action + toast feedback + revalidatePath"
  - "Non-blocking orchestrator failure logging: admin_notifications type='system' with {action, context, error} metadata"
  - "H2H banner presence logic: fetch steals by detected_in_gw_id OR resolves_in_gw_id at the gameweek page level, resolve member names server-side, render one banner per relevant steal"

requirements-completed: [LOS-01, LOS-04, LOS-07, H2H-01, H2H-02]

# Metrics
duration: ~2h (planning + implementation across Tasks 1–2; Task 3 QA deferred)
completed: 2026-04-12
---

# Phase 8 Plan 3: Admin LOS Page + Member LOS View + H2H Banner Summary

**Admin LOS management page with override/reinstate/reset/set-pick actions, member LOS status page with standings, H2H steal banner wired into the gameweek view, and closeGameweek extended with non-blocking H2H detection + steal resolution.**

## Performance

- **Duration:** ~2h (Tasks 1 and 2 combined)
- **Started:** 2026-04-12 (post 08-02 completion, same session)
- **Completed:** 2026-04-12T20:15:00Z (automated work)
- **Tasks:** 2 of 3 complete (Task 3 = manual QA checkpoint — see note below)
- **Files modified:** 13 (8 created, 5 modified)
- **Test suite:** 323/323 green at checkpoint

## Accomplishments

- Admin `/admin/los` page: members table with status, current pick, teams used, eliminated GW; override-eliminate / reinstate / reset-competition / set-pick dialogs all functional
- Member `/los` page: LosStatusCard + LosStandings composition; read-only banner for eliminated members
- H2HStealBanner component with three stage variants (detected / resolving / resolved)
- `src/app/(member)/gameweeks/[gwNumber]/page.tsx` now fetches h2h_steals + resolves tied/winner member names and renders banners inline
- `src/actions/admin/gameweeks.ts::closeGameweek` extended with non-blocking H2H detection + steal resolution (errors logged to admin_notifications, close op always succeeds)
- Four new requireAdmin-gated server actions: overrideEliminate, reinstateMember, resetCompetitionManually, setLosPickForMember
- Admin sidebar now carries the "Last One Standing" Crown-icon entry

## Task Commits

Each task committed atomically:

1. **Task 1 (TDD RED): Admin LOS action tests** — `3fd23f0` (test)
2. **Task 1 (TDD GREEN): Admin LOS actions + H2H close hook** — `1dfe178` (feat)
3. **Task 2: Admin LOS page + member LOS view + H2H banner** — `6399e41` (feat)

**Plan metadata:** (this commit — docs(08-03))

## Files Created/Modified

**Created:**
- `src/actions/admin/los.ts` — requireAdmin-gated server actions for LOS management
- `src/app/(admin)/admin/los/page.tsx` — admin LOS dashboard (server component)
- `src/app/(member)/los/page.tsx` — member LOS status page (server component)
- `src/components/los/admin-los-table.tsx` — admin table with dialogs and actions (client)
- `src/components/los/los-status-card.tsx` — member status card
- `src/components/los/los-standings.tsx` — active members standings list
- `src/components/h2h/h2h-steal-banner.tsx` — three-stage H2H banner
- `tests/actions/admin/los.test.ts` — 120+ lines of integration tests for admin actions

**Modified:**
- `src/actions/admin/gameweeks.ts` — closeGameweek now calls detectH2HForGameweek + resolveStealsForGameweek (non-blocking)
- `src/app/(member)/gameweeks/[gwNumber]/page.tsx` — renders H2HStealBanner for relevant steals
- `src/app/(member)/layout.tsx` — minor adjustments to support /los page
- `src/components/admin/sidebar.tsx` — added Crown-icon "Last One Standing" navItem
- `tests/actions/admin/gameweeks.test.ts` — updated to cover new H2H wiring assertions

## Decisions Made

- Used `requireAdmin()` + `createAdminClient()` pattern lifted verbatim from Phase 5 (`src/actions/admin/bonuses.ts`) — consistency over novelty
- `closeGameweek`'s H2H integration is non-blocking by design: a flaky H2H detection should never prevent George from closing a gameweek. Failures write an `admin_notifications.system` row with `{action: 'h2h_detect_failed', gameweek_id, error}` metadata so George sees it in the admin dashboard
- `resetCompetitionManually` supports explicit no-winner reset (`winner_id = null`) as a George-override escape hatch — the prizes table simply records no winner for that competition
- `setLosPickForMember` deliberately bypasses the kickoff lockout (admin correction scenario) but still runs team-not-already-used validation via the shared helper
- Admin table ordering is computed client-side (easier to sort + filter + paginate later); server query stays simple single-JOIN fetch

## Deviations from Plan

None — plan executed exactly as written. All four server actions implemented per spec, all UI components built per spec, all integration tests pass.

Minor note: `resetCompetitionIfNeeded` already accepted `winnerId: string | null` from Plan 02, so no refactor was needed (the plan flagged this as a possible deviation).

---

**Total deviations:** 0
**Impact on plan:** None — artifacts match the plan's `must_haves.artifacts` list exactly.

## Issues Encountered

None — no problems during execution. Build green, lint clean, full suite 323/323.

## Task 3 — Manual QA Status

**Status: APPROVED — deferred to end-of-project QA pass.**

User response at checkpoint: "approved". The user explicitly chose to defer all manual UI QA (the 6-scenario checklist in Task 3) to a single end-of-project QA pass that will cover every phase's human-verify scenarios in one master sheet. Rationale: avoid repeated context-switching into the dev server during rapid phase execution; consolidate real-device QA (iPhone 13, Pixel 5, admin RLS spot-check, H2H banner visuals, notification triggers) into one focused session after Phase 11.

**What this means for the project:**
- Phase 8 automated scope (tests + build + lint) is signed off — 323/323 green
- The 6 Task 3 QA scenarios are tracked as deferred items against the final QA milestone, NOT skipped
- A master QA sheet will be produced after this plan closes, aggregating every `checkpoint:human-verify` that was deferred across phases 1–11
- Any issues uncovered during that final pass generate gap-closure tasks in a post-launch hotfix phase

The 6 deferred scenarios (for the master QA sheet):
1. Admin LOS page visual + dialog flow (`/admin/los`)
2. Mobile LOS picker visual + tap interaction (iPhone 13 / Pixel 5)
3. Member `/los` page visual + standings ordering
4. H2H steal banner (all three stages: detected / resolving / resolved)
5. Admin notification triggers (los_winner_found, los_competition_started, h2h_steal_detected)
6. RLS spot-check via browser Network tab

## Hand-off Notes for Phase 10 (Reports)

Reports phase will need to query:
- **LOS history:** `los_competitions` rows ordered by `competition_num`, joined with `los_competition_members` for final standings. `ended_at_gw`, `winner_id`, and `eliminated_at_gw` per member give the complete narrative.
- **LOS pick history:** `los_picks` joined with `teams` and `gameweeks` — shows each member's weekly pick trail within a competition cycle.
- **H2H steal log:** `h2h_steals` rows with `detected_in_gw_id`, `resolves_in_gw_id`, `tied_member_ids`, `winner_ids`, `position` (1 for jackpot, 2 for runner-up), `resolved_at`. A resolved steal includes the final winner set and the jackpot/runner-up amount that was transferred.
- **Admin notifications tap:** `admin_notifications` type IN ('los_winner_found', 'los_competition_started', 'h2h_steal_detected', 'h2h_steal_resolved') gives George a weekly digest of LOS/H2H events for the report PDF.

No new DB migrations required for Phase 10 — all data surfaces already exist.

## Phase 8 Requirements Closure

Per plan frontmatter, this plan closes: LOS-01, LOS-04, LOS-07, H2H-01, H2H-02. Combined with 08-01 and 08-02, all Phase 8 requirements (LOS-01 through LOS-07, H2H-01 through H2H-03) are now complete and testable end-to-end in the running app.

## Next Phase Readiness

- **Ready for Phase 9 (Historical Data Page).** Phase 8 is functionally complete; the only remaining item is the deferred manual QA pass, which is scheduled for the end of the project and does not block subsequent planning/execution.
- Zero known blockers.
- Zero pending refactors.
- All accumulated decisions logged to STATE.md for the next planner's context.

---
*Phase: 08-last-one-standing-h2h*
*Plan: 03*
*Completed: 2026-04-12*

## Self-Check: PASSED

Verified:
- [x] `src/actions/admin/los.ts` exists (10770 bytes)
- [x] `src/app/(admin)/admin/los/page.tsx` exists (5790 bytes)
- [x] `src/app/(member)/los/page.tsx` exists (6778 bytes)
- [x] `src/components/los/admin-los-table.tsx` exists (21449 bytes)
- [x] `src/components/los/los-status-card.tsx` exists (4390 bytes)
- [x] `src/components/los/los-standings.tsx` exists (3500 bytes)
- [x] `src/components/h2h/h2h-steal-banner.tsx` exists (2918 bytes)
- [x] `tests/actions/admin/los.test.ts` exists (21910 bytes)
- [x] Commit `3fd23f0` (test) present in git log
- [x] Commit `1dfe178` (feat) present in git log
- [x] Commit `6399e41` (feat) present in git log
