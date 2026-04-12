---
phase: 11-polish-continuity
plan: 01
subsystem: ui
tags: [tailwind-v4, nextjs-16, supabase, migration, slug, double-bubble, reports]

requires:
  - phase: 10-reports-export
    provides: gatherGameweekData aggregator that Task 4 fixes; Tailwind v4 @theme baseline in globals.css
  - phase: 01-foundation
    provides: members table, admin_notifications CHECK ritual pattern
provides:
  - Migration 012 (teams colours + members.favourite_team_id + seasons.ended_at + members slug UNIQUE index + bonus_awards CHECK audit-fix + admin_notifications season_archived/season_launched)
  - Tailwind v4 @theme tokens --color-pl-purple / --color-pl-green (+ purple shades)
  - src/lib/members/slug.ts (toSlug + findMemberBySlug)
  - src/components/shared/member-link.tsx (MemberLink with hover accent)
  - Clickable display-name linking across 11 admin/member/public surfaces
  - Double Bubble x2 multiplier applied inside gatherGameweekData so PDFs + XLSX + public standings agree
affects: [11-02-member-profile-pages, 11-03-season-archive, 11-04-polish-copy]

tech-stack:
  added: []
  patterns:
    - "Pattern: App toSlug helper mirrors Postgres functional UNIQUE expression so app-generated URLs and DB uniqueness align"
    - "Pattern: MemberLink wraps Next Link with href=`/members/${toSlug(displayName)}`; caller className merges after defaults"
    - "Pattern: Phase-11 admin_notifications CHECK drop+re-add ritual preserved (23 prior types + 2 new)"
    - "Pattern: Migration 012 team-colour seed uses IS NULL guard so admin edits survive re-runs"
    - "Pattern: Display-layer aggregator owns Double Bubble x2 so every renderer reads single source of truth"

key-files:
  created:
    - supabase/migrations/012_polish_continuity.sql
    - src/lib/members/slug.ts
    - src/components/shared/member-link.tsx
    - tests/lib/slug.test.ts
    - tests/components/member-link.test.tsx
    - tests/components/team-badge.test.tsx
    - tests/components/prediction-card.test.tsx
    - .planning/phases/11-polish-continuity/11-01-SUMMARY.md
  modified:
    - src/app/globals.css
    - src/components/fixtures/fixture-card.tsx
    - src/lib/supabase/types.ts
    - src/lib/reports/_data/gather-gameweek-data.ts
    - tests/reports/gather-data.test.ts
    - src/components/admin/confirm-bonus-awards.tsx
    - src/components/admin/confirm-prize-dialog.tsx
    - src/components/admin/member-table.tsx
    - src/components/predictions/predictions-table.tsx
    - src/components/los/admin-los-table.tsx
    - src/components/los/los-standings.tsx
    - src/app/(admin)/admin/prizes/page.tsx
    - src/app/(admin)/admin/pre-season/_components/admin-pre-season-table.tsx
    - src/app/(member)/bonuses/page.tsx
    - src/app/(public)/standings/page.tsx
    - src/app/(public)/page.tsx

key-decisions:
  - "App-side toSlug regex uses /\\s+/ (collapses all whitespace) while Postgres functional index uses replace(x, ' ', '-'); for any well-formed display_name (trimmed single-space) they agree perfectly. Double-space edge cases would be vanishingly rare and the form already trims input"
  - "Home-team primary_color applied as 4px left-border on fixture cards; dedicated accents (bonus/warning/live) keep priority via hasDedicatedLeftAccent guard; transparent fallback when team has no seeded colour"
  - "MemberLink default hover:text-pl-green — the Phase-11 PL-green accent token is applied at the link level, not globally"
  - "/members/[slug] target page intentionally 404s until Plan 02 ships (explicit CONTEXT decision)"
  - "Task 4 applies x2 multiplier exactly once, inside the aggregator; XLSX Scores-sheet 'Total' reads from RAW per-fixture points so no double-doubling regression"
  - "Pre-existing 2 tests in gather-data.test.ts that asserted un-doubled totals despite GAMEWEEK.double_bubble=true were corrected to match the now-correct behaviour (110→170, 60→120)"

patterns-established:
  - "toSlug + functional UNIQUE index pair: any slug pattern that needs to be both generated in app and enforced in DB uses the same expression on both sides (mirrors Phase 9 championship_teams)"
  - "Dynamic routing via re-export: when re-exporting a page module, 'export const dynamic = ...' must be declared inline — Next 16 Turbopack cannot statically parse 'export { dynamic } from ...'"

requirements-completed: [UI-01, UI-04]

duration: 38 min
completed: 2026-04-12
---

# Phase 11 Plan 01: Polish Foundation Summary

**Migration 012 (team colours + slug UNIQUE index + audit-fix CHECKs) + Tailwind v4 PL palette + MemberLink across 11 surfaces + Double Bubble display-multiplier fix inside gameweek aggregator**

## Performance

- **Duration:** ~38 min
- **Started:** 2026-04-12T00:30:00Z
- **Completed:** 2026-04-12T00:41:00Z
- **Tasks:** 4
- **Files modified:** 17 (8 created, 9 modified; plus this SUMMARY.md = 18 total)

## Accomplishments

- **Migration 012** applies cleanly against a Phase-10-complete DB. 7 sections: teams.primary_color/secondary_color, members.favourite_team_id FK, seasons.ended_at archive marker, members_display_name_slug_idx functional UNIQUE index, 20-team Wikipedia colour seed with `IS NULL` guard, admin_notifications CHECK drop+re-add (+ `season_archived`, `season_launched`), and bonus_awards.points_awarded CHECK(0, 20, 60) audit-fix matching TypeScript return type
- **Tailwind v4 @theme extension** — `--color-pl-purple (#37003c)` + `--color-pl-green (#00ff85)` + two purple shades, zero tailwind.config.ts footprint (v4 CSS-first)
- **Slug + MemberLink primitives** — pure `toSlug` helper aligned with Postgres functional-index expression, async `findMemberBySlug` ready for Plan 02, MemberLink component with caller className merge + `hover:text-pl-green` default
- **FixtureCard colour accent** — home team primary_color applied as 4px left border on prediction cards, respecting existing semantic accents (bonus / warning / live states). Graceful transparent fallback for unseeded teams
- **11 admin/member/public surfaces** now render `MemberLink` where a member's display name is shown as naked text (direct edits in 10 files; 2 more — admin/bonuses + admin/predictions + member/gameweeks pages — delegate rendering to already-wrapped child components)
- **Double Bubble display-multiplier fix (HIGH pre-launch)** — `gatherGameweekData` applies x2 to `weeklyPoints` once when `gameweek.double_bubble=true`, before any renderer sees the data. Pending bonuses stay excluded. Personal PDF, group PDF, admin XLSX Standings sheet, and public /standings top-3 weekly now all agree on GW10/20/30 numbers. XLSX Scores sheet still computes its own `(base+bonus) × multiplier` from raw per-fixture points, so no 4× double-doubling

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration 012 + PL theme tokens + fixture colour accent** — `38bb700` (feat)
2. **Task 2: toSlug helper + MemberLink shared component** — `45e5be6` (feat)
3. **Task 3: Site-wide MemberLink replacement across admin/member/public** — `7219fd5` (feat)
4. **Task 4: Double Bubble x2 multiplier inside gameweek aggregator** — `4aa73f3` (fix)

**Plan metadata:** _to be committed after this SUMMARY lands_

## Files Created/Modified

**Created:**
- `supabase/migrations/012_polish_continuity.sql` — Migration 012 (7 sections)
- `src/lib/members/slug.ts` — `toSlug` pure helper + `findMemberBySlug` async DB lookup
- `src/components/shared/member-link.tsx` — `MemberLink` component
- `tests/lib/slug.test.ts` — 7 edge-case tests
- `tests/components/member-link.test.tsx` — 3 render tests
- `tests/components/team-badge.test.tsx` — crest + TLA fallback smoke tests
- `tests/components/prediction-card.test.tsx` — home-team colour accent tests

**Modified:**
- `src/app/globals.css` — PL palette @theme tokens
- `src/components/fixtures/fixture-card.tsx` — home primary_color left-border accent
- `src/lib/supabase/types.ts` — TeamRow extended with optional primary/secondary_color
- `src/lib/reports/_data/gather-gameweek-data.ts` — Double Bubble x2 multiplier
- `tests/reports/gather-data.test.ts` — 4 new DB-multiplier tests + 2 corrected pre-existing assertions
- 10 admin/member/public surfaces — MemberLink wiring
- `src/app/(public)/page.tsx` — inline `dynamic = 'force-dynamic'` (blocking fix)

## Decisions Made

- **toSlug regex vs Postgres expression**: App uses `/\s+/` collapse, DB uses `replace(x, ' ', '-')`. They agree on well-formed trimmed single-space names. Documented divergence in migration SQL comments.
- **Migration 012 idempotency**: Every structural change uses `IF NOT EXISTS`. Colour seed uses `IS NULL` so admin edits survive re-runs. `admin_notifications` uses drop+re-add ritual per Phase 11 RESEARCH Pitfall 3.
- **FixtureCard accent priority**: Existing bonus / warning / live accents take precedence over home colour — the colour-accent is a _new default_, not a replacement for state-driven visuals.
- **Double Bubble fix location**: Applied in the aggregator (single source of truth) rather than in each renderer. Downstream XLSX Scores sheet calculates from raw per-fixture `pointsAwarded`/`bonusPointsAwarded` so the separate `× multiplier` there does not create a 4× bug — verified via test.
- **Home page `/` dynamic re-export**: Turbopack rejects `export { dynamic } from ...`, so the root page.tsx now declares `export const dynamic = 'force-dynamic'` inline alongside the `export { default } from './standings/page'`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed Turbopack build failure on `/app/(public)/page.tsx` re-export**
- **Found during:** Task 3 (`npm run build` verification)
- **Issue:** Next 16.2.3 Turbopack cannot statically parse `export { dynamic } from './standings/page'` — build failed with "Next.js can't recognize the exported `dynamic` field in route. It mustn't be reexported." Pre-existing from Phase 10 Plan 04 but had not been surfaced because `npm run build` had not been run between then and now.
- **Fix:** Replace the re-export with inline `export const dynamic = 'force-dynamic'` on the home page. Default export (`export { default } from './standings/page'`) retained — only the route-segment-config value had to move.
- **Files modified:** `src/app/(public)/page.tsx`
- **Verification:** `npm run build` green — 32 routes compiled.
- **Committed in:** `7219fd5` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minor — a pre-existing Phase 10 bug that surfaced at this plan's build verification gate. Fix was mechanical (direct declaration vs re-export) and unblocked Task 3's verification without scope creep. No scope change to Plan 01.

## Issues Encountered

None — all tasks executed with TDD RED/GREEN cycles passing first try after implementation. jsdom's `getAttribute('style')` returns inline hex as `rgb(...)` so the FixtureCard assertion accepts either form.

## User Setup Required

None — no external service configuration required. Migration 012 will apply when the next database push runs. No new env vars, no new dashboard config.

## Next Phase Readiness

- **Plan 02 (member profile pages)** is unblocked: `toSlug` + `findMemberBySlug` contract defined, `MemberLink` already points at `/members/[slug]` (404s until the page lands). `teams.primary_color` seeded for future member-avatar work.
- **Plan 03+ (season archive, copy polish)** unblocked: `seasons.ended_at` column present, `season_archived` + `season_launched` admin_notifications types available.
- **Pre-launch Double Bubble display bug**: RESOLVED. Member + admin numbers now agree on GW10/20/30. Safe to ship email orchestration for any Double Bubble gameweek.
- **Pre-launch bonus_awards CHECK**: RESOLVED. DB-level protection against accidental bad values (0/20/60 only).
- Blockers: None.

## Self-Check: PASSED

Verified files:
- FOUND: supabase/migrations/012_polish_continuity.sql
- FOUND: src/lib/members/slug.ts
- FOUND: src/components/shared/member-link.tsx
- FOUND: tests/lib/slug.test.ts
- FOUND: tests/components/member-link.test.tsx
- FOUND: tests/components/team-badge.test.tsx
- FOUND: tests/components/prediction-card.test.tsx

Verified commits:
- FOUND: 38bb700 (Task 1)
- FOUND: 45e5be6 (Task 2)
- FOUND: 7219fd5 (Task 3)
- FOUND: 4aa73f3 (Task 4)

Test suite: 554/554 green (+18 from 536 baseline).
Build: `npm run build` green (32 routes).

---
*Phase: 11-polish-continuity*
*Completed: 2026-04-12*
