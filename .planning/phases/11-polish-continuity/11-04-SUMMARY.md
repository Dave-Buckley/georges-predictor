---
phase: 11-polish-continuity
plan: 04
subsystem: season-lifecycle-and-archive
tags: [nextjs-16, server-actions, wizard, url-param-state, idempotency, archive, end-of-season, zod, tdd, qa-deferred]

requires:
  - phase: 09-pre-season-predictions
    plan: 03
    provides: endOfSeasonRollover + championship_teams DB-backed list + seasons table + pre_season_awards confirmation workflow
  - phase: 08-last-one-standing-h2h
    plan: 03
    provides: los_competitions + resetCompetitionManually + winner tracking (feeds end-of-season LOS winners list)
  - phase: 10-reports-export
    plan: 04
    provides: /standings public view + gatherGameweekData (feeds final-standings snapshot)
  - phase: 11-polish-continuity
    plan: 01
    provides: seasons.ended_at column (migration 012) + admin_notifications 'season_archived' / 'season_launched' types
  - phase: 11-polish-continuity
    plan: 03
    provides: LandingHero + seasons.ended_at branching hook on src/app/page.tsx
provides:
  - 6 idempotent season-rollover server actions (getArchiveReadiness, archiveSeason, defineNewSeason, carryForwardChampionshipTeams, carryForwardMembers, launchNewSeason)
  - 8-step wizard at /admin/season-rollover with URL-param state (?step=1..8) — cancel-safe until final launch
  - /end-of-season public summary page (champion spotlight top-3, full final standings, LOS winners, prize awards, pre-season awards)
  - src/app/page.tsx branching — renders end-of-season content when current season archived AND no new active season
  - Admin sidebar + dashboard "Season rollover" entry points (urgency-sensitive card)
  - FINAL_QA_CHECKLIST.md §13 — Phase 11 master QA (visual polish, clickable usernames E2E, /how-it-works, wizard walkthrough, end-of-season page, mobile audit reference, launch gate)
affects: [post-launch operations, v1.1 planning, v2.0 multi-season]

tech-stack:
  added: []
  patterns:
    - "Pattern: URL-param wizard state (Next.js 16 async searchParams) — zero client-side state tracking, every step is a server-component, server actions issue redirect() to advance"
    - "Pattern: 6-action idempotent lifecycle — every action re-runnable with identical outcome, enforced via WHERE guards (ended_at IS NULL, ON CONFLICT DO NOTHING, approval_status = 'approved')"
    - "Pattern: carryForwardMembers approval_status guard — Pitfall 6 enforcement; pending + rejected + user_id=null placeholders never touched"
    - "Pattern: Cancel-safe until step 8 — steps 1-7 have explicit per-step submit actions; closing the tab before step 8 leaves zero global side effects beyond any already-confirmed step"
    - "Pattern: End-of-season content branching at /page.tsx — seasons.ended_at NOT NULL AND no active row → render /end-of-season content; no redirect hop"
    - "Pattern: Master-QA-sheet deferral (5th application) — matches Phase 8 §7-8, Phase 9 §10, Phase 10 §12, Phase 11 Plan 03 §14.1 precedent"

key-files:
  created:
    - src/actions/admin/season-rollover.ts
    - src/app/(admin)/admin/season-rollover/page.tsx
    - src/app/(admin)/admin/season-rollover/_components/step-1-readiness.tsx
    - src/app/(admin)/admin/season-rollover/_components/step-2-archive.tsx
    - src/app/(admin)/admin/season-rollover/_components/step-3-new-season.tsx
    - src/app/(admin)/admin/season-rollover/_components/step-4-fixture-sync.tsx
    - src/app/(admin)/admin/season-rollover/_components/step-5-championship.tsx
    - src/app/(admin)/admin/season-rollover/_components/step-6-members.tsx
    - src/app/(admin)/admin/season-rollover/_components/step-7-preseason.tsx
    - src/app/(admin)/admin/season-rollover/_components/step-8-launch.tsx
    - src/app/(public)/end-of-season/page.tsx
    - tests/actions/season-rollover.test.ts
    - tests/app/season-rollover.test.tsx
    - tests/app/end-of-season.test.tsx
    - .planning/phases/11-polish-continuity/11-04-SUMMARY.md
  modified:
    - src/app/page.tsx
    - src/components/admin/sidebar.tsx
    - src/components/admin/dashboard.tsx
    - docs/FINAL_QA_CHECKLIST.md

key-decisions:
  - "URL-param wizard (?step=N) instead of client-side state — server components + redirect() advance; cancel = close tab, zero residual state"
  - "6 actions not 8 — getArchiveReadiness is pure read, defineNewSeason + launchNewSeason cover the season-creation + activation split cleanly without a separate 'activate' action"
  - "carryForwardMembers WHERE approval_status = 'approved' AND user_id IS NOT NULL — approved-only reset guard documented inline with Pitfall 6 comment; pending/rejected/placeholder rows explicitly preserved"
  - "launchNewSeason flips admin_settings.current_active_season (not seasons.is_active column) — re-uses Phase 5 settings-key pattern, avoids schema change"
  - "End-of-season content inlined at /page.tsx (not server redirect to /end-of-season) — saves a network hop, keeps SEO URL stable, fallback-safe"
  - "Step 8 launch is the ONLY action with global revalidation — steps 1-7 revalidate /admin + /admin/season-rollover only, so pre-launch browsing stays consistent"
  - "Master QA deferred to FINAL_QA_CHECKLIST.md §13 (approved 2026-04-12) — 5th application of the master-QA-sheet pattern across Phase 8/9/10/11"

patterns-established:
  - "URL-param wizard: server component switches on parseInt(searchParams.step) to render the matching step component; server actions issue redirect() on success"
  - "Idempotent UPDATE with WHERE sentinel: ended_at column set only when IS NULL; re-runs are silent no-ops, not errors"
  - "admin_notifications metadata envelope: every lifecycle action emits a row with type + metadata JSON (season, timestamp, counts) — audit trail + dashboard trigger"

requirements-completed: [DATA-02, UI-03]

duration: 55 min
completed: 2026-04-12
---

# Phase 11 Plan 04: Season Rollover Wizard + End-of-Season Summary Summary

**8-step URL-param wizard at `/admin/season-rollover` (6 idempotent server actions + cancel-safe steps 1-7 + launch at step 8), end-of-season champion-spotlight summary at `/` when current season archived, admin nav wiring + master QA §13 deferred to FINAL_QA_CHECKLIST**

## Performance

- **Duration:** 55 min
- **Started:** 2026-04-12T22:10:00Z
- **Completed:** 2026-04-12T23:05:00Z
- **Tasks:** 2 auto + 1 deferred QA
- **Files modified:** 19 (14 created + 5 modified)

## Accomplishments

- 6 idempotent season-rollover server actions in one file — every action re-runnable with identical outcome
- 8-step wizard at `/admin/season-rollover` navigable by `?step=` URL param — zero client-side state, cancel-safe until step 8
- `/end-of-season` public summary page — champion spotlight (top 3 with crests), full final standings, LOS winners per competition, prize awards, pre-season awards
- `src/app/page.tsx` branches to end-of-season content when current season `ended_at` set AND no newer active season exists
- Admin sidebar + dashboard "Season rollover" entries (dashboard card escalates to URGENT when all GWs closed + pre-season confirmed + LOS resolved + `ended_at` still null)
- 614/614 tests green after wizard + rollover coverage added
- `npm run build` clean, 34 routes (33 existing + /end-of-season + /admin/season-rollover)
- Master QA checklist appended as FINAL_QA_CHECKLIST.md §13 — 7 sub-sections covering visual polish, clickable usernames E2E, /how-it-works, wizard walkthrough, end-of-season summary, mobile audit reference, launch gate

## Task Commits

Each task was committed atomically (TDD RED → GREEN pattern):

1. **Task 1 RED: add failing tests for 6 season-rollover server actions** — `df8af87` (test)
2. **Task 1 GREEN: implement 6 idempotent season-rollover server actions** — `a9bfce6` (feat)
3. **Task 2 RED: add failing tests for wizard shell + end-of-season page** — `fe3647b` (test)
4. **Task 2 GREEN: wizard shell + 8 step components + end-of-season page + admin nav** — `e91ff16` (feat)

**Plan metadata:** (this commit) — docs(11-04): complete season rollover wizard + end-of-season plan

## Idempotency Notes — What Each Action Does on Re-Run

| Action | Re-run behaviour |
|--------|------------------|
| `getArchiveReadiness(season)` | Pure aggregation over gameweeks + pre_season_awards + los_competitions — read-only, deterministic. |
| `archiveSeason({season})` | `UPDATE seasons SET ended_at = now() WHERE season = X AND ended_at IS NULL` — second run is a no-op (zero rows affected). admin_notifications row emitted only on first successful set. |
| `defineNewSeason({season, gw1Kickoff})` | UPSERT on (season) — second run UPDATEs gw1_kickoff to the latest supplied value (intentional: George can correct a typo). |
| `carryForwardChampionshipTeams({fromSeason, toSeason})` | SELECT from source + INSERT each with `ON CONFLICT (season, team_name) DO NOTHING` — second run inserts nothing new. |
| `carryForwardMembers()` | `UPDATE members SET starting_points = 0 WHERE approval_status = 'approved' AND user_id IS NOT NULL` — second run sets 0→0 (idempotent by value). Pending/rejected/user_id-null rows untouched. |
| `launchNewSeason({season})` | UPSERT into admin_settings (key='current_active_season', value=season) — second run overwrites to same value. admin_notifications row emitted each run (intentional audit trail; George can see if accidentally re-triggered). |

## Files Created/Modified

- `src/actions/admin/season-rollover.ts` — 6 idempotent server actions with Zod schemas at top, requireAdmin + createAdminClient pattern, revalidatePath fanout on every mutation
- `src/app/(admin)/admin/season-rollover/page.tsx` — wizard shell, awaits searchParams, switches on parseInt(step) default 1, routes to step component
- `src/app/(admin)/admin/season-rollover/_components/step-[1..8]-*.tsx` — 8 step components, each with Title + Body + Back/Cancel/Next actions; server components where possible, client only for the confirm checkbox on step 6
- `src/app/(public)/end-of-season/page.tsx` — reads latest archived season, renders hero + champion spotlight (TeamBadge on favourite_team_id) + full standings + LOS winners + prize awards + pre-season all-correct
- `src/app/page.tsx` — added seasons query branching; renders end-of-season content when `ended_at IS NOT NULL AND no row WHERE ended_at IS NULL`
- `src/components/admin/sidebar.tsx` — added "Season rollover" entry (CalendarClock icon) linking to /admin/season-rollover
- `src/components/admin/dashboard.tsx` — added "Season rollover" action card; URGENT visual when current season ready-to-archive (all GWs closed + pre-season confirmed + LOS resolved + ended_at null)
- `tests/actions/season-rollover.test.ts` — happy path + idempotency + approval_status guard (pending + rejected + user_id-null untouched) for every action
- `tests/app/season-rollover.test.tsx` — per-step rendering (step 1 readiness, step 3 form inputs, step 6 approval warning, step 8 launch confirmation)
- `tests/app/end-of-season.test.tsx` — archived-season content + fallback when no archived season
- `docs/FINAL_QA_CHECKLIST.md` — appended §13 (Phase 11 master QA) — 7 sub-sections

## Decisions Made

- **URL-param wizard over client-side state** — per CONTEXT.md pattern and 11-RESEARCH.md Example 5; every step is server-rendered, advance = server action issues redirect(), cancel = close tab. No useState, no hydration.
- **6 actions not 8** — getArchiveReadiness is a pure aggregation read (no mutation), and defineNewSeason + launchNewSeason together cover what would otherwise be "create" + "activate" separately.
- **carryForwardMembers guard wording** — inline comment at the WHERE clause explicitly references Pitfall 6 and cites the approval_status + user_id NOT NULL semantics so a future maintainer can't accidentally drop one leg of the guard.
- **launchNewSeason stores flag in admin_settings** — re-uses the Phase 5 settings-key row idiom (same shape as email toggles). Avoids adding an `is_active` boolean column to `seasons` which would need a CHECK (at most one active) constraint to stay safe.
- **End-of-season inlined at `/page.tsx`** — no server-side redirect to /end-of-season; the content renders directly. URL stays stable, SEO is happy, and a hypothetical future direct link to /end-of-season still works independently.
- **Step 8 has global revalidation; steps 1-7 don't** — steps 1-7 revalidate only /admin + /admin/season-rollover so members browsing mid-rollover don't see half-states. Step 8 revalidates /, /standings, /dashboard, /admin, /admin/season-rollover — the full fanout only fires at the launch moment.
- **Master QA deferred to FINAL_QA_CHECKLIST.md §13** — user approved 2026-04-12. 5th application of the master-QA-sheet deferral pattern established in Phase 8 §7-8, Phase 9 §10, Phase 10 §12, Phase 11 Plan 03 §14.1.

## Deviations from Plan

**None — plan executed exactly as written.**

All 6 server actions shipped per spec with inline Pitfall 6 comment on carryForwardMembers. All 8 step components shipped with URL-param state. End-of-season page shipped with all five content blocks (champion spotlight, full standings, LOS winners, prize awards, pre-season all-correct). Admin sidebar + dashboard wiring shipped with urgency gating. 614/614 tests green on first full-suite pass, `npm run build` clean, 34 routes.

## Issues Encountered

None — patterns from Phase 5-10 admin actions carried through verbatim. The inline `'export const dynamic = force-dynamic'` pattern established in Plan 01 prevented any Turbopack re-export parsing issues on src/app/page.tsx.

## Phase 11 — All 4 Plans Shipped (Cross-Plan Summary)

| Plan | Subsystem | Requirements | Key deliverables |
|------|-----------|--------------|------------------|
| 11-01 | Polish foundation + visual identity | UI-01, UI-04 | Migration 012 (toSlug, PL team colours, seasons.ended_at, admin_notifications season-lifecycle types, bonus_awards CHECK), Tailwind @theme PL palette, MemberLink + site-wide username linking, team kit accents on fixture cards, Double-Bubble display fix |
| 11-02 | Member profile | UI-02 | /members/[slug] profile page, aggregateSeasonStats pure library, WeeklyPointsChart SVG, HomeRankWidget on dashboard |
| 11-03 | Public explainer + hero | UI-01, UI-02, UI-05 | /how-it-works (9 sections + 4 FAQs + anchor nav), StandingsHero + LandingHero inline-SVG, footer + signin links, 5 placeholder PNGs, screenshot runbook, §14.1 mobile audit deferred |
| 11-04 | Season rollover + end-of-season | DATA-02, UI-03 | 8-step wizard + 6 idempotent server actions, /end-of-season summary, admin nav wiring, §13 master QA deferred |

**Requirements completed across Phase 11:** UI-01, UI-02, UI-03, UI-04, UI-05, DATA-02 (6/7 — DATA-03 remains pending per roadmap, tracked separately)

**Tests:** 614/614 green at phase completion.
**Build:** clean, 34 routes.
**Deferred QA:** §13 (Phase 11 master QA) + §14.1 (5-flow mobile audit) both in docs/FINAL_QA_CHECKLIST.md.

## User Setup Required

None — no external service configuration required. The `admin_settings` row for `current_active_season` is populated by the first successful `launchNewSeason` action invocation; no manual SQL needed.

## Next Phase Readiness

**Phase 11 complete. v1.0 launch-ready.**

- All 37 plans across 11 phases shipped.
- FINAL_QA_CHECKLIST.md is the single pre-launch gate — sections 1-18 + §14.1 (mobile audit) + §13 (Phase 11 master QA).
- `/gsd:complete-milestone` is the next orchestrator-level action to close v1.0 — not invoked here (per user directive).

**Phase 11 shipped — v1.0 launch ready.**

## Self-Check

Files created:
- src/actions/admin/season-rollover.ts — FOUND (via commit a9bfce6)
- src/app/(admin)/admin/season-rollover/page.tsx — FOUND (via commit e91ff16)
- src/app/(admin)/admin/season-rollover/_components/step-[1..8]-*.tsx — FOUND (8 components, via commit e91ff16)
- src/app/(public)/end-of-season/page.tsx — FOUND (via commit e91ff16)
- tests/actions/season-rollover.test.ts — FOUND (via commit df8af87)
- tests/app/season-rollover.test.tsx — FOUND (via commit fe3647b)
- tests/app/end-of-season.test.tsx — FOUND (via commit fe3647b)

Commits verified (git log):
- df8af87 test(11-04): add failing tests for 6 season-rollover server actions — FOUND
- a9bfce6 feat(11-04): implement 6 idempotent season-rollover server actions — FOUND
- fe3647b test(11-04): add failing tests for wizard shell + end-of-season page — FOUND
- e91ff16 feat(11-04): wizard shell + 8 step components + end-of-season page + admin nav — FOUND

## Self-Check: PASSED

---
*Phase: 11-polish-continuity*
*Completed: 2026-04-12*
