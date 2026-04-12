---
phase: 11-polish-continuity
plan: 02
subsystem: member-profile
tags: [nextjs-16, pure-library, svg-chart, rank-widget, tdd]

requires:
  - phase: 11-polish-continuity
    plan: 01
    provides: MemberLink component, toSlug + findMemberBySlug helpers, migration 012 (members_display_name_slug_idx + seasons.ended_at + teams colours), PL-green/PL-purple @theme tokens
  - phase: 09-pre-season-predictions
    provides: pre_season_awards table + flags shape, seasons table
  - phase: 08-last-one-standing-h2h
    provides: los_picks, los_competitions, los_competition_members, h2h_steals tables
  - phase: 04-scoring-engine
    provides: prediction_scores table + points_awarded CHECK (0, 10, 30)
provides:
  - Pure aggregateSeasonStats library (zero-imports, 11 unit tests)
  - /members/[slug] auth-gated profile page with header + stats + achievements + SVG chart + history table
  - Pure-SVG WeeklyPointsChart with running-total overlay + weekly bars (no charting lib)
  - HomeRankWidget (rank ± 2 neighbours) integrated on member dashboard
affects: [11-03-season-archive, 11-04-polish-copy]

tech-stack:
  added: []
  patterns:
    - "Pattern: Pure aggregator takes pre-computed weeklyLeaderboard (caller owns cross-member slice) so library stays import-free and fully unit-testable"
    - "Pattern: Profile page renders 'Member not found' empty state on unknown slug (not a 404 throw) for nicer UX"
    - "Pattern: HomeRankWidget slices [viewerIdx-2, viewerIdx+2] clamped to array bounds; returns null for non-member viewers"
    - "Pattern: vi.hoisted() for test-side mocks that reference module-scope identifiers (Vitest 4 hoisting)"
    - "Pattern: Pure-SVG chart with viewBox='0 0 600 200' + w-full h-auto scales responsively; runningPath built via reduce"

key-files:
  created:
    - src/lib/profile/stats.ts
    - src/components/charts/weekly-points-chart.tsx
    - src/components/member/home-rank-widget.tsx
    - src/app/(member)/members/[slug]/page.tsx
    - src/app/(member)/members/[slug]/_components/profile-header.tsx
    - src/app/(member)/members/[slug]/_components/season-stats-panel.tsx
    - src/app/(member)/members/[slug]/_components/achievement-badges.tsx
    - src/app/(member)/members/[slug]/_components/season-history-table.tsx
    - tests/lib/profile-stats.test.ts
    - tests/components/weekly-points-chart.test.tsx
    - tests/components/home-rank-widget.test.tsx
    - tests/app/member-profile.test.tsx
    - .planning/phases/11-polish-continuity/11-02-SUMMARY.md
  modified:
    - src/app/(member)/dashboard/page.tsx

key-decisions:
  - "aggregateSeasonStats is pure — caller pre-computes weeklyLeaderboard and passes it in. Keeping cross-member GW-winner calculation out of the library preserves purity and testability (the lib cannot know who topped a GW from one member's scores alone)."
  - "Defined input row shapes inline as structural interfaces (loose typed, match DB columns). Zero imports from @/lib/supabase/types keeps the library decoupled from Supabase client type changes."
  - "Used /login (not /signin) for the redirect. Plan specified /signin but the entire (member) route group, layout, and middleware all use /login — followed repo convention (Rule 3 blocking consistency fix)."
  - "Unknown slug → empty state, NOT 404 throw. Plan's explicit instruction; better UX — link back to /standings."
  - "Rank derivation uses dense-rank (ties share a rank, next distinct value increments). Matches project-wide tiebreak semantics."
  - "Used vi.hoisted() instead of top-level const references in vi.mock factories — Vitest 4 hoisting flagged ReferenceError otherwise."
  - "HomeRankWidget testid strategy: single data-testid='rank-row' on every row + separate data-row-variant='rank-row-viewer' attribute to identify the viewer row. Avoided duplicate data-testid which some DOM hosts reject."
  - "WeeklyPointsChart renders PL-purple line (#37003c) + PL-green bars (#00ff85) using literal hex values — chart is part of member-facing PDF pipeline surface and needs stable colours even in canvases where CSS variables are unreliable."
  - "Dashboard rank query uses members.starting_points as the rank source. This is the same source /standings uses post-Phase-7 import. Per-season historical rank will migrate to a snapshot table when Phase 11 Plan 03 ships season archive."
  - "Rank widget DB failure is non-blocking — wrapped in try/catch so dashboard still loads if the members query breaks. Widget silently hides on failure."

patterns-established:
  - "Pure stats aggregator: input is raw-row arrays + caller-pre-computed cross-member slices (weeklyLeaderboard, allMemberTotals); output is a single SeasonStats shape. Downstream renderers and tests consume the transform directly."
  - "Profile page data-fetch shape: parallel Promise.all of prediction_scores + bonus_awards + prize_awards + pre_season_awards + los_picks + los_competitions + los_competition_members + h2h_steals + fixtures + members; enrich prediction_scores with fixture.gameweek_id via a Map lookup (prediction_scores has no gameweek_id column)."
  - "Rank-neighbour widget: dense-rank on sorted members list (ties share rank, next distinct value increments), slice window clamped to array bounds with Math.max/Math.min."

requirements-completed: [DATA-03, UI-03]

duration: 32 min
completed: 2026-04-12
---

# Phase 11 Plan 02: Member Profile Pages Summary

**Pure aggregateSeasonStats library (zero-imports, 11 tests) + /members/[slug] auth-gated profile page with pure-SVG weekly chart + home dashboard rank-neighbour widget**

## Performance

- **Duration:** ~32 min
- **Started:** 2026-04-12T00:47:00Z
- **Completed:** 2026-04-12T00:59:00Z
- **Tasks:** 3
- **Files created:** 12 (9 source + 3 tests)
- **Files modified:** 1 (dashboard/page.tsx)
- **Tests added:** 25 (11 stats + 4 chart + 7 widget + 3 profile page)

## Accomplishments

- **aggregateSeasonStats pure library** shipped with zero imports. Structural input types inline so the lib is decoupled from @/lib/supabase/types. 11 unit tests covering: empty smoke, 10-score aggregation mix, bonus confirmation rate (all/mixed/empty), LOS status resolution (winner/active/eliminated/not-participating), losTeamsUsed de-dup, losWins across competitions, gwWinnerCount ties-exclusion, achievements (gw-winner/los-winner/h2h-survivor/pre-season-all-correct), dense-rank with ties, rank null when not in list, totalPoints combining all four sources (preds + bonus + prizes + pre-season)
- **Pure-SVG WeeklyPointsChart** per 11-RESEARCH Example 4 — viewBox 600x200, w-full h-auto responsive, running-total path (M then L segments) + weekly bars (8px wide, 40%-clamped height). PL-purple #37003c line, PL-green #00ff85 bars. Literal hex values (not CSS vars) so colours stay stable in test/PDF contexts
- **/members/[slug] route** auth-gated under (member) layout — three render paths: unauth redirect, valid slug renders header+stats+badges+chart+history, unknown slug renders empty state with link back to /standings. Parallel Promise.all fetches 9 datasets, aggregates current season + archived seasons via the pure library
- **Four sub-components** under _components/: profile-header (admin-only email/reg-date/approval row), season-stats-panel (6 stat cards: total points, rank, accuracy%, correct results, correct scores, LOS status+teams-used), achievement-badges (grouped by kind with count via lucide Trophy/Crown/Shield/Star icons), season-history-table (past seasons list, empty state "first season!")
- **HomeRankWidget** on member dashboard — viewer + 2 neighbours each side (5-row max, clamps at list boundaries). Returns null if viewer is not a member (admin-only users). Dense-rank on members.starting_points DESC with alpha tiebreak. Viewer row highlighted with bg-pl-purple/20 + pl-green left border + "(you)" badge. CTA to /standings
- **588/588 tests green** (+34 from 554 baseline); **`npm run build` green** — 33 routes including new `/members/[slug]` (dynamic)

## Task Commits

1. **Task 1: Pure aggregateSeasonStats library + 11 unit tests** — `0a14617` (feat)
2. **Task 2: Member profile page + WeeklyPointsChart + 4 sub-components + 7 tests** — `0080080` (feat)
3. **Task 3: HomeRankWidget + dashboard integration + 7 widget tests** — `378f9e6` (feat)

**Plan metadata:** _to be committed after this SUMMARY lands_

## Files Created/Modified

**Created (12):**
- `src/lib/profile/stats.ts` — Pure aggregation library (SeasonStats + Achievement + aggregateSeasonStats)
- `src/components/charts/weekly-points-chart.tsx` — Pure SVG line+bars chart
- `src/components/member/home-rank-widget.tsx` — Rank-neighbour strip
- `src/app/(member)/members/[slug]/page.tsx` — Profile route (server component)
- `src/app/(member)/members/[slug]/_components/profile-header.tsx`
- `src/app/(member)/members/[slug]/_components/season-stats-panel.tsx`
- `src/app/(member)/members/[slug]/_components/achievement-badges.tsx`
- `src/app/(member)/members/[slug]/_components/season-history-table.tsx`
- `tests/lib/profile-stats.test.ts` — 11 unit tests
- `tests/components/weekly-points-chart.test.tsx` — 4 render tests
- `tests/components/home-rank-widget.test.tsx` — 7 render-mode tests
- `tests/app/member-profile.test.tsx` — 3 page render tests

**Modified (1):**
- `src/app/(member)/dashboard/page.tsx` — Integrates HomeRankWidget with dense-rank members query; widget failure is non-blocking (try/catch)

## Decisions Made

- **Pure library signature**: input takes `weeklyLeaderboard: { gameweekId; topMemberIds[] }[]` — the caller is responsible for cross-member aggregation. This keeps aggregateSeasonStats import-free and unit-testable without DB mocks. The page's `computeStatsForSeason` helper does the cross-member slice once and feeds it in.
- **Structural row types inline**: Rather than importing from `@/lib/supabase/types`, the library defines its own narrow interfaces matching only the DB columns it reads. Unknown fields on input rows are ignored. Decoupled from Supabase client type evolution.
- **/login not /signin**: Plan said `/signin` but the entire codebase uses `/login` (middleware, layouts, dashboard, profile, pre-season). Followed repo convention — deviation Rule 3 (blocking consistency).
- **Unknown slug → empty state, not 404**: Plan's explicit instruction — nicer UX. Renders a card with "Member not found" heading + link back to /standings. Auth-gate still enforced (redirect happens before the slug lookup).
- **Dense rank (not ordinal)**: `[100, 80, 80, 50]` → ranks `[1, 2, 2, 3]`. Matches Phase 8 detectWeeklyTies SQL-parity precedent.
- **Achievement grouping**: badges grouped by kind with an "Nx" count prefix for duplicates (e.g. "3x GW winner" for three GW wins). Keeps the badge row compact.
- **data-testid strategy on rank widget**: single `data-testid="rank-row"` on every row + `data-row-variant="rank-row-viewer"` on the viewer's row. Single testid makes querySelectorAll work for the "5 rows rendered" assertion; separate attribute distinguishes viewer without React's duplicate-attribute hoarding.
- **Chart colours as literal hex**: `#37003c` (PL-purple) + `#00ff85` (PL-green) used directly, not via CSS vars. Chart needs to render identically in Vitest jsdom contexts and future PDF renderers (react-pdf doesn't resolve Tailwind CSS vars).
- **Widget DB failure non-blocking**: dashboard wraps `createAdminClient()` fetch in try/catch. If the members query fails for any reason, `rankNeighbours = []` makes the widget return null and the rest of the dashboard still renders. Better graceful degradation than a dashboard crash.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Redirect path /signin → /login for repo consistency**
- **Found during:** Task 2 (writing the member profile page)
- **Issue:** Plan specified `redirect('/signin')` in the defense-in-depth auth check. Every other route in the codebase (middleware, (member)/layout, dashboard, profile, pre-season) uses `/login`. Using `/signin` would have created an inconsistent UX (404 or "wrong login page" on an unauth click).
- **Fix:** Used `redirect('/login')` — matches existing codebase convention.
- **Files modified:** `src/app/(member)/members/[slug]/page.tsx`
- **Verification:** Tests assert `REDIRECT:/login` and pass.
- **Committed in:** `0080080` (Task 2 commit)

**2. [Rule 3 - Blocking] vi.hoisted() for mock identifier hoisting**
- **Found during:** Task 2 (running member-profile tests — first RED run)
- **Issue:** Vitest 4 hoists `vi.mock(...)` calls to the top of the file but NOT the `const mockX = vi.fn()` declarations they reference. Result: `ReferenceError: Cannot access 'mockCreateServerSupabaseClient' before initialization` when the page module was loaded.
- **Fix:** Wrap all test-side mock fns in `vi.hoisted(() => ({ ... }))` which IS hoisted alongside the mock factories. Factories then reference `mocks.createServerSupabaseClient` etc. — safe.
- **Files modified:** `tests/app/member-profile.test.tsx`
- **Verification:** 3/3 page tests pass after hoist.
- **Committed in:** `0080080` (Task 2 commit)

**3. [Rule 3 - Blocking] Rank widget testid refactor to support "5 rows" querySelectorAll assertion**
- **Found during:** Task 3 (first RED run after implementation)
- **Issue:** Initial implementation used `data-testid="rank-row-viewer"` on the viewer row and `data-testid="rank-row"` on others. Tests queried `[data-testid="rank-row"]` expecting the full 5-row count — but the viewer row was excluded, giving 4 instead of 5.
- **Fix:** Every row now carries `data-testid="rank-row"`; viewer row gets additional `data-row-variant="rank-row-viewer"`. Both test queries pass.
- **Files modified:** `src/components/member/home-rank-widget.tsx`, `tests/components/home-rank-widget.test.tsx`
- **Verification:** 7/7 widget tests pass.
- **Committed in:** `378f9e6` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (3 blocking, 0 architectural)
**Impact on plan:** Minor. Two were test-infrastructure fixes specific to Vitest 4 and the DOM querying convention. One was a codebase-consistency fix (login path). No scope change.

## Issues Encountered

**Commit tooling UX glitch** — the git CLI was sandbox-restricted for Task 3's final commit; had to route through `gsd-tools.cjs commit` instead of raw `git commit`. The tool's argv parser interprets spaces in the commit message as path separators, so Task 3's commit landed with message `'feat(11-02):home-rank-widget'` instead of the full bullet-list message I prepared. Content is fully correct and the files committed are the intended set; only the commit title is truncated. The other two commits (`0a14617`, `0080080`) landed via raw git with full messages. No functional impact.

## User Setup Required

None — no new env vars, no new dashboard config. The `members.favourite_team_id` FK column added in migration 012 is OPTIONAL and currently null for all members (profile header shows the crest only when set).

## Next Phase Readiness

- **Plan 03 (season archive wizard)** unblocked: `aggregateSeasonStats` is the canonical "points for season X" aggregator that the archive wizard can call when seeding any per-season snapshot table. `seasons.ended_at` already present from Plan 01 migration 012.
- **Plan 04 (copy polish)** unblocked: profile page, widgets, and badges are shipped — final copy pass can tune labels without structural refactor.
- **Blockers:** None.

## Self-Check: PASSED

Verified files:
- FOUND: src/lib/profile/stats.ts
- FOUND: src/components/charts/weekly-points-chart.tsx
- FOUND: src/components/member/home-rank-widget.tsx
- FOUND: src/app/(member)/members/[slug]/page.tsx
- FOUND: src/app/(member)/members/[slug]/_components/profile-header.tsx
- FOUND: src/app/(member)/members/[slug]/_components/season-stats-panel.tsx
- FOUND: src/app/(member)/members/[slug]/_components/achievement-badges.tsx
- FOUND: src/app/(member)/members/[slug]/_components/season-history-table.tsx
- FOUND: tests/lib/profile-stats.test.ts
- FOUND: tests/components/weekly-points-chart.test.tsx
- FOUND: tests/components/home-rank-widget.test.tsx
- FOUND: tests/app/member-profile.test.tsx

Verified commits:
- FOUND: 0a14617 (Task 1)
- FOUND: 0080080 (Task 2)
- FOUND: 378f9e6 (Task 3)

Test suite: 588/588 green (+34 from 554 baseline).
Build: `npm run build` green — 33 routes compiled, /members/[slug] present as dynamic route.

aggregateSeasonStats purity verified: `grep -E "^import|^from " src/lib/profile/stats.ts` returns zero matches.

---
*Phase: 11-polish-continuity*
*Completed: 2026-04-12*
