---
phase: 03-predictions
plan: "03"
subsystem: admin-predictions-view
tags: [admin, table, service-role, rls-bypass, gameweek-selector, sidebar]
dependency_graph:
  requires: [03-01-predictions-backend]
  provides: [admin-predictions-grid, gameweek-selector, all-predictions-sidebar-link]
  affects: [admin-panel]
tech_stack:
  added: []
  patterns: [server-component-admin-client, url-search-params, sticky-table-column]
key_files:
  created:
    - src/components/predictions/predictions-table.tsx
    - src/app/(admin)/admin/predictions/gameweek-selector.tsx
  modified:
    - src/app/(admin)/admin/predictions/page.tsx
    - src/components/admin/sidebar.tsx
decisions:
  - "createAdminClient() (service role) used on predictions page — bypasses RLS so George sees all predictions regardless of kick-off status"
  - "GameweekSelector is a separate 'use client' component — keeps page.tsx a server component"
  - "Default gameweek: active first, then scheduled, then latest — ensures George lands on the current competition window"
  - "Sticky left column for member names via CSS sticky + z-index — no JS needed for horizontal scroll UX"
metrics:
  duration: 4 min
  completed_date: "2026-04-12"
  tasks_completed: 2
  files_changed: 4
---

# Phase 03 Plan 03: Admin All Predictions View

One-liner: Service-role-backed admin grid table (members x fixtures) showing all predictions per gameweek with gameweek selector, submission counts, and correct-score highlighting.

## What Was Built

### Component: `src/components/predictions/predictions-table.tsx`
- `'use client'` grid component; 158 lines
- Rows: approved members sorted alphabetically; sticky first column with member name + colour dot (green = submitted, red = pending)
- Columns: one per fixture; header shows home TLA / vs / away TLA stacked
- Cells: prediction as "H-A" or em-dash if none; green highlight when prediction matches actual result
- Status column: Submitted / Pending pill badges
- Handles empty states: no members, no fixtures

### Component: `src/app/(admin)/admin/predictions/gameweek-selector.tsx`
- `'use client'` wrapper for the `<select>` dropdown
- Calls `router.push('/admin/predictions?gw=N')` on change
- Renders gameweek number with Active/Complete labels

### Page: `src/app/(admin)/admin/predictions/page.tsx`
- Full replacement of placeholder page
- Server component; uses `createAdminClient()` throughout (bypasses RLS)
- Reads `searchParams.gw` for gameweek selection; defaults to active > scheduled > latest
- Fetches: all gameweeks, approved members, fixtures with joined teams, all predictions for gameweek
- Summary stat pills: submitted count, total predictions, fixtures count
- Empty state handling: no gameweeks, no gameweek found, no fixtures, no members, no predictions

### Sidebar: `src/components/admin/sidebar.tsx`
- Changed navItems entry for `/admin/predictions` from `label: 'My Predictions'` to `label: 'All Predictions'`

## Verification

- `npx tsc --noEmit` — zero errors in src/ (pre-existing test-file TS errors unchanged)
- `npm run build` — production build passes, `/admin/predictions` listed as dynamic route
- `npx vitest run` — 125/125 pass, zero regressions

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

**Files created/modified:**
- [x] `src/components/predictions/predictions-table.tsx` — FOUND (158 lines, > 60 min)
- [x] `src/app/(admin)/admin/predictions/page.tsx` — FOUND (contains createAdminClient)
- [x] `src/app/(admin)/admin/predictions/gameweek-selector.tsx` — FOUND
- [x] `src/components/admin/sidebar.tsx` — FOUND (contains "All Predictions")

**Commits:**
- [x] cb0de39 — feat(03-03): PredictionsTable component and admin predictions page
- [x] 38b3bba — feat(03-03): rename admin sidebar predictions link to All Predictions

## Self-Check: PASSED
