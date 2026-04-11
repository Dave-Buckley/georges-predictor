---
phase: 02-fixture-layer
plan: "03"
subsystem: member-fixtures-ui
tags: [fixtures, member-ui, components, navigation, team-filter, dashboard]
dependency_graph:
  requires: ["02-01"]
  provides: ["03-predictions-ui"]
  affects: ["src/components/fixtures/*", "src/app/(member)/gameweeks", "src/app/(member)/fixtures", "src/app/(member)/dashboard"]
tech_stack:
  added: []
  patterns: ["Server Components with client wrappers", "URL search params for filter state", "Lucide icons", "Visual lockout states (cosmetic only — server-side enforced by 02-01)"]
key_files:
  created:
    - src/components/fixtures/team-badge.tsx
    - src/components/fixtures/fixture-card.tsx
    - src/components/fixtures/gameweek-nav.tsx
    - src/components/fixtures/gameweek-view.tsx
    - src/app/(member)/gameweeks/page.tsx
    - src/app/(member)/gameweeks/[gwNumber]/page.tsx
    - src/app/(member)/fixtures/page.tsx
    - src/app/(member)/fixtures/all-fixtures-client.tsx
  modified:
    - src/middleware.ts
    - src/components/member/dashboard-overview.tsx
    - src/app/(member)/dashboard/page.tsx
decisions:
  - "Team badges use plain <img> (not next/image) to avoid SVG optimization issues with football-data.org crest URLs"
  - "All-fixtures filter state stored in URL search params (?team=id) for shareability"
  - "FixtureCard countdown uses setInterval every second — only active when showCountdown=true AND isToday()"
  - "dashboard/page.tsx fetches gameweek/fixture data server-side and passes as props — no client API calls"
metrics:
  duration: "5 minutes"
  completed_date: "2026-04-11"
  tasks_completed: 2
  files_created: 8
  files_modified: 3
---

# Phase 02 Plan 03: Member Fixture Display UI Summary

**One-liner:** Member-facing fixture display infrastructure with 7+ visual lockout states, team badge components, gameweek navigation, and all-fixtures page with team filter dropdown.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Fixture components and member gameweek page | f760ade | team-badge, fixture-card, gameweek-nav, gameweek-view, /gameweeks pages, middleware |
| 2 | All-fixtures page and dashboard update | 9864988 | /fixtures page, all-fixtures-client, dashboard-overview, dashboard/page |

## What Was Built

### Components

**TeamBadge (`src/components/fixtures/team-badge.tsx`):**
- Renders team crest `<img>` with sm/md/lg sizes (20/28/36px)
- Falls back to coloured circle with TLA when crest_url is null
- Shows short_name for md/lg, TLA for sm size
- `showName` prop controls name visibility

**FixtureCard (`src/components/fixtures/fixture-card.tsx`):**
- 7+ visual states: normal, amber/orange warning (30-min window), countdown timer (today only), locked (greyed + Lock icon), LIVE (pulsing red badge), FT (final score), postponed/suspended (orange badge), cancelled/awarded (grey badge)
- Every kick-off time shows explicit BST or GMT via `formatKickoffTime()`
- Rescheduled badge (blue) when `is_rescheduled === true`
- `prediction-area` placeholder div for Phase 3 prediction inputs
- Countdown resets via `setInterval(1s)` — only active when `showCountdown=true && isToday()`

**GameweekNav (`src/components/fixtures/gameweek-nav.tsx`):**
- Prev/next arrows (ChevronLeft/ChevronRight from lucide-react)
- Dropdown `<select>` listing all gameweeks with checkmark prefix for completed ones
- `router.push('/gameweeks/{n}')` navigation
- Arrows disabled at bounds (GW 1 / GW 38)

**GameweekView (`src/components/fixtures/gameweek-view.tsx`):**
- Sorts fixtures by kickoff_time ascending
- Groups midweek (Mon-Thu) vs weekend (Fri-Sun) using `isMidweekFixture()`
- Section headers shown only when both groups are present
- Complete/Active status badge on gameweek header
- Empty state message when no fixtures loaded

### Pages

**`/gameweeks` (smart redirect):**
- Finds earliest gameweek with SCHEDULED/TIMED fixture → redirects there
- Falls back to latest completed GW, then first GW
- Shows placeholder message if no gameweeks exist

**`/gameweeks/[gwNumber]`:**
- Validates param (1-38), shows 404 for invalid
- Fetches gameweek + fixtures with team joins + all gameweeks for nav dropdown
- Renders GameweekNav + GameweekView

**`/fixtures` (all-fixtures):**
- Server component fetches all teams + all 380 fixtures with team/gameweek joins
- AllFixturesClient: team filter dropdown with URL search param (?team=teamId)
- Groups filtered fixtures by gameweek number with status badges
- Fixture count display after filter
- Sticky filter bar (top-[73px] accounts for member header height)

### Updates

**Middleware:** Added `/gameweeks` and `/fixtures` to protected routes — redirects unauthenticated users to `/login`.

**DashboardOverview:** Added "Current Gameweek" section below rank card showing up to 5 upcoming fixtures with TeamBadge, kickoff times (BST/GMT), and "View all" link to full gameweek page.

**Dashboard page:** Server-side queries for current GW (earliest with SCHEDULED/TIMED fixtures, falling back to latest complete) and up to 5 upcoming fixtures — passed as props to DashboardOverview.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed FixtureStatus cast error in parallel plan file**
- **Found during:** Task 2 build
- **Issue:** `src/components/admin/fixture-form.tsx` (from 02-02 parallel execution) had `e.target.value` (string) assigned to `FixtureStatus` typed state, blocking the production build
- **Fix:** Added `as import('@/lib/supabase/types').FixtureStatus` cast on line 243
- **Files modified:** `src/components/admin/fixture-form.tsx`
- **Commit:** included in 9864988 (unstaged, fixed inline before commit)

## Self-Check

- [x] `src/components/fixtures/team-badge.tsx` — created
- [x] `src/components/fixtures/fixture-card.tsx` — created
- [x] `src/components/fixtures/gameweek-nav.tsx` — created
- [x] `src/components/fixtures/gameweek-view.tsx` — created
- [x] `src/app/(member)/gameweeks/page.tsx` — created
- [x] `src/app/(member)/gameweeks/[gwNumber]/page.tsx` — created
- [x] `src/app/(member)/fixtures/page.tsx` — created
- [x] `src/app/(member)/fixtures/all-fixtures-client.tsx` — created
- [x] `src/middleware.ts` — updated with /gameweeks and /fixtures protection
- [x] `src/components/member/dashboard-overview.tsx` — updated with current GW section
- [x] `src/app/(member)/dashboard/page.tsx` — updated to fetch and pass GW/fixtures
- [x] Build passes: zero errors in src/, all member routes render
- [x] Task 1 commit: f760ade
- [x] Task 2 commit: 9864988

## Self-Check: PASSED
