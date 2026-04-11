---
phase: 05-admin-panel
plan: "02"
subsystem: bonus-management
tags: [server-actions, radix-dialog, bonus-rotation, double-bubble, tdd]
dependency_graph:
  requires:
    - 05-01 (bonus_types, bonus_schedule, bonus_awards tables + Zod validators)
  provides:
    - src/actions/admin/bonuses.ts (setBonusForGameweek, toggleDoubleBubble, confirmBonusAward, bulkConfirmBonusAwards, createBonusType)
    - src/app/(admin)/admin/bonuses/page.tsx (full season rotation table + awards review)
    - src/components/admin/set-bonus-dialog.tsx (3-step Radix Dialog for setting GW bonus)
    - src/components/admin/confirm-bonus-awards.tsx (bulk award confirmation table)
  affects:
    - Phase 6 (bonus picking uses these server actions as the confirmation layer)
    - GW detail page now shows bonus context inline
tech_stack:
  added: []
  patterns:
    - TDD RED-GREEN for all server actions (vitest)
    - requireAdmin() inline pattern (copied from scoring.ts)
    - 3-step Radix Dialog: entry -> confirm -> success (matches ResultOverrideDialog pattern)
    - Form action pattern: server actions used as form action= props directly
    - Tri-state boolean (NULL/true/false) for pending/confirmed/rejected bonus awards
    - Radix Select for bonus type dropdown in SetBonusDialog
key_files:
  created:
    - src/actions/admin/bonuses.ts
    - src/app/(admin)/admin/bonuses/page.tsx
    - src/components/admin/set-bonus-dialog.tsx
    - src/components/admin/confirm-bonus-awards.tsx
    - tests/actions/admin/bonuses.test.ts
  modified:
    - src/app/(admin)/admin/gameweeks/[gwNumber]/page.tsx
    - src/components/admin/sidebar.tsx
decisions:
  - "SetBonusDialog existingPickCount passed as prop from server (not fetched client-side) — avoids client DB round-trip"
  - "Bonuses page Double Bubble toggle uses toggleDoubleBubble imported directly as form action — no inline 'use server' needed in server components"
  - "ConfirmBonusAwards uses client state only for showUnreviewedOnly filter — all mutations via form actions"
metrics:
  duration_minutes: 4
  completed_date: "2026-04-12"
  tasks_completed: 2
  files_created: 5
  files_modified: 2
---

# Phase 5 Plan 02: Bonus Management System Summary

**One-liner:** Full bonus management vertical slice — 5 server actions with TDD coverage, 38-GW rotation page with Double Bubble toggles, 3-step SetBonusDialog, bulk ConfirmBonusAwards table, and bonus controls embedded in GW detail page.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Bonus server actions with unit tests | 0675925 | src/actions/admin/bonuses.ts, tests/actions/admin/bonuses.test.ts |
| 2 | Admin Bonuses page, set-bonus dialog, confirm-awards UI, GW detail bonus controls, sidebar enable | 3404243 | src/app/(admin)/admin/bonuses/page.tsx, src/components/admin/set-bonus-dialog.tsx, src/components/admin/confirm-bonus-awards.tsx, src/app/(admin)/admin/gameweeks/[gwNumber]/page.tsx, src/components/admin/sidebar.tsx |

## What Was Built

### Server Actions (src/actions/admin/bonuses.ts — 323 lines)

Five exported server actions with `requireAdmin()` guard, Zod validation, and `revalidatePath`:

- **`setBonusForGameweek`** — upserts `bonus_schedule` row (onConflict: gameweek_id), checks existing pick count, creates audit notification, returns `{ success: true, existingPickCount }`
- **`toggleDoubleBubble`** — updates `gameweeks.double_bubble`, creates audit notification, revalidates both admin pages
- **`confirmBonusAward`** — updates `bonus_awards.awarded` + `confirmed_by` + `confirmed_at` for a single award
- **`bulkConfirmBonusAwards`** — bulk updates all `awarded IS NULL` rows for a gameweek (approve_all or reject_all)
- **`createBonusType`** — inserts `bonus_types` with `is_custom=true`, returns `{ success: true, id }`

All actions parse boolean FormData values explicitly (`formData.get('enabled') === 'true'`) before Zod validation.

### Test Coverage (tests/actions/admin/bonuses.test.ts — 465 lines)

13 tests across 5 `describe` blocks covering:
- Auth rejection for all 5 actions
- Validation failure paths (missing fields, non-UUID values, empty strings)
- Success paths with payload assertion for upserted/updated rows

### Admin Bonuses Page (src/app/(admin)/admin/bonuses/page.tsx — 319 lines)

- `force-dynamic` server component fetching bonus_types, bonus_schedule, gameweeks, pending awards
- **Create Custom Bonus Type** form at top with name + description inputs
- **Season Rotation table** — all 38 GWs with: GW number + status badge, assigned bonus name, Double Bubble toggle button (submits toggleDoubleBubble action), confirmed status badge, SetBonusDialog button
- GW10/20/30 highlighted with star indicator (special Double Bubble gameweeks)
- Row color-coding: complete GWs dimmed, active GW highlighted purple
- **Bonus Awards** section below table — empty state until Phase 6 populates data; renders ConfirmBonusAwards for any GW with pending awards

### SetBonusDialog (src/components/admin/set-bonus-dialog.tsx — 290 lines)

3-step Radix Dialog pattern matching ResultOverrideDialog:
- **Step 1 (Entry):** Radix Select dropdown of all bonus types with name + description preview
- **Step 2 (Confirm):** Shows GW number, selected bonus name; amber warning if existingPickCount > 0
- **Step 3 (Success):** Green confirmation card, `window.location.reload()` on Done

### ConfirmBonusAwards (src/components/admin/confirm-bonus-awards.tsx — 189 lines)

- Client component with "Show unreviewed only" filter toggle
- Scrollable table: Member | Bonus Pick | Status badge | Action buttons
- Per-row Approve (green) / Reject (red) buttons via `confirmBonusAward` form actions
- "Approve All Eligible" bulk button via `bulkConfirmBonusAwards` form action
- Tri-state status badges: Clock=Pending, CheckCircle=Approved, XCircle=Rejected
- Empty state message for when no awards exist yet

### GW Detail Page Extension (src/app/(admin)/admin/gameweeks/[gwNumber]/page.tsx)

Added bonus section between header and fixtures:
- Shows assigned bonus type name + description (or "No bonus set" italic)
- Double Bubble toggle button (submit form action to `toggleDoubleBubble`)
- SetBonusDialog button with current bonus type pre-selected
- Amber notice if `pendingAwardCount > 0` with link to `/admin/bonuses#awards`

### Sidebar (src/components/admin/sidebar.tsx)

Removed `disabled: true` from Bonuses nav item — Bonuses link now clickable and navigates to `/admin/bonuses`.

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `npx vitest run tests/actions/admin/bonuses.test.ts` — 13/13 passed (Task 1 verify)
- `npx vitest run` — 194/194 passed across 15 test files (Task 2 verify, up from 157 pre-plan)
- All 7 expected files confirmed present via filesystem check
- Both commits confirmed in git log

## Self-Check: PASSED

- FOUND: src/actions/admin/bonuses.ts (323 lines, min 0)
- FOUND: src/app/(admin)/admin/bonuses/page.tsx (319 lines, min 80)
- FOUND: src/components/admin/set-bonus-dialog.tsx (290 lines, min 40)
- FOUND: src/components/admin/confirm-bonus-awards.tsx (189 lines, min 50)
- FOUND: tests/actions/admin/bonuses.test.ts (465 lines, min 40)
- FOUND commit: 0675925 (Task 1)
- FOUND commit: 3404243 (Task 2)
