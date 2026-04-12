---
phase: 08-last-one-standing-h2h
verified: 2026-04-12T20:20:00Z
status: passed
score: 10/10 must-haves verified
human_verification:
  - test: "Admin /admin/los page visual + dialog flows"
    expected: "Override/reinstate/reset dialogs render and mutate DB; ordering correct"
    why_human: "Deferred by user to master end-of-project QA sheet (docs/FINAL_QA_CHECKLIST.md). Visual/interaction quality cannot be grep-verified."
  - test: "Mobile LOS picker on iPhone 13 / Pixel 5 responsive mode"
    expected: "Radix Select sheet full-width, 56px touch targets, team crests visible, selection persists"
    why_human: "Deferred to master QA; requires real device or DevTools responsive simulation."
  - test: "Member /los status page visual + standings ordering"
    expected: "Status card + standings render; eliminated banner when applicable"
    why_human: "Deferred to master QA; visual layout check."
  - test: "H2H steal banner — three stages (detected / resolving / resolved)"
    expected: "Correct copy and amber/green accent color per stage; manual SQL insert drives variant"
    why_human: "Deferred to master QA; requires manual test data seeding and visual check."
  - test: "Admin notification triggers (los_winner_found, los_competition_started, h2h_steal_detected, h2h_steal_resolved)"
    expected: "Notifications appear in admin dashboard after trigger events"
    why_human: "Deferred to master QA; requires live scenario (sole-survivor trigger or GW close with tie)."
  - test: "RLS spot-check — member cannot see other members' current-GW picks before kickoff"
    expected: "Network tab: los_picks query returns only own row pre-kickoff; all rows post-kickoff"
    why_human: "Deferred to master QA; requires browser session + network inspection."
---

# Phase 8: Last One Standing & H2H Verification Report

**Phase Goal:** The Last One Standing sub-competition runs automatically alongside weekly predictions, and H2H steal situations are detected and flagged without manual work from George.
**Verified:** 2026-04-12T20:20:00Z
**Status:** passed (with deferred manual QA per user instruction)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (derived from ROADMAP Success Criteria)

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1   | Members can select one team to win as their LOS pick during weekly prediction submission | VERIFIED | `LosTeamPicker` imported + rendered in `prediction-form.tsx:10,294-298`; `submitPredictions` accepts `losTeamId` param (predictions.ts:32); `getLosContext` loads available teams for picker |
| 2   | Members who pick a losing/drawing team are automatically marked eliminated; winners progress | VERIFIED | `evaluateLosPick` returns `eliminated=true` on draw/lose (evaluate.ts); `runLosRound` persists `los_competition_members.status='eliminated'` with reason; sync pipeline calls it (sync.ts:457) |
| 3   | System prevents member from picking a team already used in current cycle | VERIFIED | Server-side guard: predictions.ts:147-161 queries prior `los_picks` by team_id with `.neq('gameweek_id', current)`; `availableTeams` pure helper excludes used (team-usage.ts); picker filters client-side too |
| 4   | George can view a table showing every member's LOS status, current pick, team usage history | VERIFIED | `/admin/los` page renders `AdminLosTable` (admin-los-table.tsx, 528 LOC) with columns: Member, Status, Current Pick, Teams Used, Eliminated GW, Actions; server fetch joins members + picks + teams |
| 5   | If member misses a round without submitting, they are automatically eliminated | VERIFIED | `evaluateLosRound` returns `missed_submission_member_ids` (evaluate.ts); `runLosRound` writes `los_competition_members.status='eliminated', reason='missed'` (round.ts) |
| 6   | When a LOS winner is found, competition resets and all 20 teams become available again | VERIFIED | `shouldResetCompetition(1)===true`; `resetCompetitionIfNeeded` closes old + inserts new competition with all approved members (round.ts:264); `availableTeams` returns all 20 on full cycle; admin_notifications `los_winner_found` + `los_competition_started` fired |
| 7   | Tied weekly points leaders are automatically detected and flagged for following week's report as H2H steal | VERIFIED | `detectH2HForGameweek` runs on `closeGameweek` (gameweeks.ts:224) + sync pipeline (sync.ts:465); `detectWeeklyTies` at positions 1+2; inserts `h2h_steals` with `resolves_in_gw_id = next GW`; `H2HStealBanner` displays on gameweek page; `admin_notifications h2h_steal_detected` fired |
| 8   | H2H ties resolve automatically in next gameweek (highest scorer wins, split on persistent tie) | VERIFIED | `resolveStealsForGameweek` invoked from `closeGameweek` (gameweeks.ts:234) + sync (sync.ts:473); `resolveSteal` returns single winner or split; `admin_notifications h2h_steal_resolved` fired |
| 9   | Sub-competition runs automatically alongside weekly predictions (no manual work) | VERIFIED | Sync pipeline auto-wires: `detectFullyFinishedGameweeks` → `runLosRound` → `detectH2HForGameweek` → `resolveStealsForGameweek` (sync.ts:449-477); all orchestrators idempotent via `outcome IS NULL` / `resolved_at IS NULL` filters; `closeGameweek` additionally triggers H2H hooks non-blocking |
| 10  | H2H detection respects Phase 6 bonus confirmation (excludes unconfirmed bonuses) | VERIFIED | `loadWeeklyTotals` in sync-hook.ts filters `bonus_awards.awarded=true`; gw `closed_at IS NULL` short-circuits detection (Pitfall 3 respected); verified by test `excludes unconfirmed bonus awards` |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Status | LOC | Wiring |
| -------- | ------ | --- | ------ |
| `supabase/migrations/008_los_h2h.sql` | VERIFIED | 282 | Contains all 4 tables, RLS policies, `los_competitions_one_active` partial unique index, admin_notifications CHECK extension with 4 new types |
| `src/lib/los/evaluate.ts` | VERIFIED | 202 | Pure `evaluateLosPick` + `evaluateLosRound`; imported by `round.ts:20` |
| `src/lib/los/team-usage.ts` | VERIFIED | 41 | `availableTeams` with 20-team cycle reset; used in `predictions.ts` via shared logic + picker filtering |
| `src/lib/los/competition.ts` | VERIFIED | 33 | `shouldResetCompetition` + `nextCompetitionNumber`; imported by `round.ts:21` |
| `src/lib/los/round.ts` | VERIFIED | 340 | `runLosRound` + `resetCompetitionIfNeeded`; called from `sync.ts:457` and `admin/los.ts:203` |
| `src/lib/h2h/detect-ties.ts` | VERIFIED | 59 | `detectWeeklyTies` dense-rank; imported by `sync-hook.ts:20` |
| `src/lib/h2h/resolve-steal.ts` | VERIFIED | 42 | `resolveSteal`; imported by `sync-hook.ts:21` |
| `src/lib/h2h/sync-hook.ts` | VERIFIED | 237 | `detectH2HForGameweek` + `resolveStealsForGameweek`; called from `sync.ts:465,473` and `gameweeks.ts:224,234` |
| `src/lib/validators/los.ts` | VERIFIED | 51 | 4 Zod schemas exported; imported by `admin/los.ts` |
| `src/lib/supabase/types.ts` | VERIFIED | 232 | 4 new row types appended |
| `src/actions/predictions.ts` | VERIFIED | 385 | `submitPredictions` signature extended with `losTeamId`; `getLosContext` exported; used by prediction form |
| `src/actions/admin/los.ts` | VERIFIED | 318 | 4 actions with `requireAdmin` gating: `overrideEliminate`, `reinstateMember`, `resetCompetitionManually`, `setLosPickForMember` |
| `src/actions/admin/gameweeks.ts` | VERIFIED | 280 | `closeGameweek` calls `detectH2HForGameweek` + `resolveStealsForGameweek` non-blocking (lines 224, 234) |
| `src/app/(admin)/admin/los/page.tsx` | VERIFIED | 185 | Server component; fetches competition/members/picks; renders `AdminLosTable` |
| `src/app/(member)/los/page.tsx` | VERIFIED | 206 | Member status page; renders `LosStatusCard` + `LosStandings` |
| `src/app/(member)/gameweeks/[gwNumber]/page.tsx` | VERIFIED | — | Fetches `h2h_steals` by `detected_in_gw_id` + `resolves_in_gw_id`; renders `H2HStealBanner` line 340 |
| `src/components/predictions/prediction-form.tsx` | VERIFIED | 464 | Imports `LosTeamPicker`; renders conditionally on `losEligible`; wired to `submitPredictions(..., losTeamId)` |
| `src/components/los/los-team-picker.tsx` | VERIFIED | 172 | Radix Select component; exported; imported by prediction-form |
| `src/components/los/admin-los-table.tsx` | VERIFIED | 528 | Admin client table with override/reinstate/reset/set-pick dialogs |
| `src/components/los/los-status-card.tsx` | VERIFIED | 129 | Used by `/los` page |
| `src/components/los/los-standings.tsx` | VERIFIED | 105 | Used by `/los` page |
| `src/components/h2h/h2h-steal-banner.tsx` | VERIFIED | 91 | Three stage variants; imported by gameweek page |
| `src/components/admin/sidebar.tsx` | VERIFIED | 169 | Contains `{ href: '/admin/los', label: 'Last One Standing', icon: Crown }` (lines 75-77) |

All 23 artifacts exist, substantive, and wired.

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| `src/lib/fixtures/sync.ts` | `src/lib/los/round.ts` | `runLosRound` call post-scoring | WIRED (sync.ts:12,457) |
| `src/lib/fixtures/sync.ts` | `src/lib/h2h/sync-hook.ts` | `detectH2HForGameweek`, `resolveStealsForGameweek` calls | WIRED (sync.ts:13,465,473) |
| `src/actions/admin/gameweeks.ts` | `src/lib/h2h/sync-hook.ts` | `closeGameweek` calls H2H hooks non-blocking | WIRED (gameweeks.ts:7,224,234) |
| `src/actions/admin/los.ts` | `src/lib/los/round.ts` | `resetCompetitionIfNeeded` in manual reset | WIRED (los.ts:21,203) |
| `src/actions/predictions.ts` | `src/lib/los/team-usage.ts` | `availableTeams` via `getLosContext` | WIRED (inline usage verified) |
| `src/lib/los/round.ts` | `src/lib/los/evaluate.ts` | `evaluateLosRound` pure call | WIRED (round.ts:20,156) |
| `src/lib/h2h/sync-hook.ts` | `src/lib/h2h/detect-ties.ts` | `detectWeeklyTies` pure call | WIRED (sync-hook.ts:20,126) |
| `src/lib/h2h/sync-hook.ts` | `src/lib/h2h/resolve-steal.ts` | `resolveSteal` pure call | WIRED (sync-hook.ts:21,212) |
| `src/components/predictions/prediction-form.tsx` | `src/components/los/los-team-picker.tsx` | Component import + conditional render | WIRED (form.tsx:10,294) |
| `src/components/admin/sidebar.tsx` | `src/app/(admin)/admin/los/page.tsx` | navItem href | WIRED (sidebar.tsx:75) |
| `src/app/(member)/gameweeks/[gwNumber]/page.tsx` | `src/components/h2h/h2h-steal-banner.tsx` | Banner import + render | WIRED (page.tsx:8,340) |
| `supabase/migrations/008_los_h2h.sql` | `admin_notifications` | CHECK drop/re-add with 4 new types | WIRED (migration.sql:126-153) |

All 12 key links WIRED.

### Requirements Coverage

All 10 phase 8 requirement IDs declared across plan frontmatter are accounted for:

| Requirement | Source Plan(s) | Description | Status | Evidence |
| ----------- | -------------- | ----------- | ------ | -------- |
| LOS-01 | 08-02, 08-03 | Members pick one team to win each week alongside predictions | SATISFIED | `submitPredictions(losTeamId)` + `LosTeamPicker` in prediction-form |
| LOS-02 | 08-01, 08-02 | Win→progress, draw/loss→eliminated | SATISFIED | `evaluateLosPick` + `runLosRound` persistence; tested in `los-evaluate.test.ts` + `los-round.test.ts` |
| LOS-03 | 08-01, 08-02 | Team cannot be repicked until all 20 used | SATISFIED | `availableTeams` pure + server-side `.neq('gameweek_id', current)` already-used guard in predictions.ts:147-161 |
| LOS-04 | 08-03 | Tool tracks elimination + team usage history | SATISFIED | `AdminLosTable` renders Teams Used + Eliminated GW columns; data from `los_competition_members` + `los_picks` |
| LOS-05 | 08-01, 08-02 | Missed round → eliminated | SATISFIED | `evaluateLosRound.missed_submission_member_ids` + persisted with reason='missed' |
| LOS-06 | 08-01, 08-02 | Winner→reset, all 20 teams reavailable | SATISFIED | `shouldResetCompetition` + `resetCompetitionIfNeeded` creates new competition; `availableTeams` cycle reset |
| LOS-07 | 08-03 | George can view + manage LOS status | SATISFIED | `/admin/los` page + 4 admin actions (override/reinstate/reset/setPick) with `requireAdmin` gate |
| H2H-01 | 08-01, 08-02 | Auto-detects tied weekly winners | SATISFIED | `detectWeeklyTies` pure + `detectH2HForGameweek` orchestrator |
| H2H-02 | 08-02, 08-03 | H2H flagged in next-week report | SATISFIED | `h2h_steals.resolves_in_gw_id = next GW`; `H2HStealBanner` on gameweek page shows flagged state |
| H2H-03 | 08-01 | H2H resolved next GW, highest scorer wins | SATISFIED | `resolveSteal` + `resolveStealsForGameweek` orchestrator; tested in `h2h-resolve.test.ts` + `sync-h2h.test.ts` |

No orphaned requirements. REQUIREMENTS.md already marks all 10 as `[x]` complete.

### Anti-Patterns Found

None. Grep for TODO/FIXME/PLACEHOLDER across phase 8 files returns only one match: a legitimate Radix `Select.Value placeholder="Select your LOS team"` UX attribute in `los-team-picker.tsx:74`.

No stub returns, no empty handlers, no placeholder UIs.

### Test Suite

**Full suite: 323/323 green** (27 test files). Phase 8 contributed 41+20+~33 = ~94 tests:
- `tests/lib/los-evaluate.test.ts`
- `tests/lib/los-team-usage.test.ts`
- `tests/lib/los-competition.test.ts`
- `tests/lib/los-round.test.ts`
- `tests/lib/h2h-detect-ties.test.ts`
- `tests/lib/h2h-resolve.test.ts`
- `tests/lib/sync-h2h.test.ts`
- `tests/actions/predictions-los.test.ts`
- `tests/actions/admin/los.test.ts`

### Human Verification Required (Deferred)

Task 3 of plan 08-03 is a manual-QA checkpoint explicitly deferred by the user to the master end-of-project QA sheet (per 08-03-SUMMARY "Task 3 — Manual QA Status: APPROVED — deferred"). The 6 deferred scenarios are documented in the `human_verification` frontmatter above. Per user instruction in this verification request, these are tracked but do not fail verification since automated evidence covers the must_haves.

### Gaps Summary

None. All 10 observable truths backed by existing, substantive, wired code. All 23 artifacts verified at levels 1–3 (exists, substantive, wired). All 12 key links wired. All 10 requirement IDs satisfied with evidence. Full test suite green. Manual QA formally deferred to master end-of-project QA sheet per user decision.

Phase 8 goal **achieved**: The LOS sub-competition runs automatically via the sync pipeline (`runLosRound` after all fixtures finish), H2H ties are auto-detected on gameweek close (`detectH2HForGameweek` in `closeGameweek`), and auto-resolved the following week (`resolveStealsForGameweek`). George only interacts for overrides/corrections via `/admin/los` — zero manual work required for the happy path.

---

*Verified: 2026-04-12T20:20:00Z*
*Verifier: Claude (gsd-verifier)*
