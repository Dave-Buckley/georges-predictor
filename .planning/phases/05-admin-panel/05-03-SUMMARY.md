---
phase: 05-admin-panel
plan: "03"
subsystem: gameweek-lifecycle
tags: [gameweeks, close, reopen, dashboard, settings, email-notifications, tdd]
dependency_graph:
  requires:
    - supabase/migrations/005_admin_panel.sql (Plan 01 — tables and types)
    - src/lib/validators/gameweeks.ts (Plan 01 — closeGameweekSchema, reopenGameweekSchema)
  provides:
    - src/actions/admin/gameweeks.ts (getCloseGameweekSummary, closeGameweek, reopenGameweek, updateAdminSettings)
    - src/components/admin/close-gameweek-dialog.tsx
    - src/components/admin/email-notification-toggles.tsx
    - src/app/(admin)/admin/page.tsx (expanded dashboard with action cards)
    - src/app/(admin)/admin/settings/page.tsx (email notification toggles)
  affects:
    - Phase 5 Plan 02 (GW detail page — both plans modified it; close controls integrated alongside bonus section)
    - Phase 5 Plan 04 (prizes — dashboard shows pending prize count)
tech_stack:
  added: []
  patterns:
    - TDD RED-GREEN cycle for server actions
    - 3-step dialog pattern (summary → confirm → success) from ResultOverrideDialog
    - Server-side re-check of blocking conditions (never trust client state)
    - Optimistic UI with useTransition for email toggle auto-save
    - Context-aware dashboard cards ordered by urgency
key_files:
  created:
    - src/actions/admin/gameweeks.ts
    - src/components/admin/close-gameweek-dialog.tsx
    - src/components/admin/email-notification-toggles.tsx
    - tests/actions/admin/gameweeks.test.ts
  modified:
    - src/app/(admin)/admin/page.tsx
    - src/app/(admin)/admin/settings/page.tsx
    - src/app/(admin)/admin/gameweeks/[gwNumber]/page.tsx (CloseGameweekDialog import + header integration)
decisions:
  - "Server-side re-check on closeGameweek: canClose conditions re-queried from DB — client summary is display-only"
  - "Dashboard action cards ordered by urgency: approvals > set bonus > confirm awards > close GW > prizes"
  - "GW detail page integrated with Plan 02 changes by adding import and header controls alongside existing bonus section"
  - "EmailNotificationToggles auto-saves on toggle change — no submit button needed, simpler UX for George"
  - "CloseGameweekDialog success step does NOT reload page — Dialog.Close handles dismissal; dashboard revalidates via revalidatePath"
metrics:
  duration_minutes: 5
  completed_date: "2026-04-12"
  tasks_completed: 2
  files_created: 4
  files_modified: 3
---

# Phase 5 Plan 03: Gameweek Close/Reopen Workflow Summary

**One-liner:** Gameweek close/reopen server actions with blocking validation, pre-close summary dialog accessible from both dashboard and GW detail page, dashboard expanded with context-aware action cards, email notification toggles in settings.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Gameweek close/reopen server actions and admin settings action with tests | 323a2b4 | src/actions/admin/gameweeks.ts, tests/actions/admin/gameweeks.test.ts |
| 2 | Close-gameweek dialog, dashboard expansion, GW detail close button, settings email toggles | 982a249 | src/components/admin/close-gameweek-dialog.tsx, src/components/admin/email-notification-toggles.tsx, src/app/(admin)/admin/page.tsx, src/app/(admin)/admin/settings/page.tsx |

## What Was Built

### Server Actions (`src/actions/admin/gameweeks.ts`)

Four exported functions:

1. **`getCloseGameweekSummary(gameweekId)`** — Pre-close data fetch (not a form action).
   - requireAdmin() guard
   - Returns `CloseGameweekSummary` interface with: totalFixtures, finishedFixtures, blockingFixtures (non-terminal statuses), pendingBonusAwards (IS NULL), bonusConfirmed, totalPointsDistributed, canClose
   - `canClose = blockingFixtures.length === 0 && pendingBonusAwards === 0`

2. **`closeGameweek(formData)`** — Closes a gameweek.
   - requireAdmin() guard + closeGameweekSchema validation
   - Re-checks blocking conditions server-side (security: never trust client)
   - Sets `closed_at = now()`, `closed_by = auth.userId` on gameweek row
   - Inserts `gw_complete` admin_notification
   - `revalidatePath('/admin', 'layout')` to revalidate all admin pages

3. **`reopenGameweek(formData)`** — Reopens a closed gameweek.
   - requireAdmin() guard + reopenGameweekSchema validation
   - Clears `closed_at = null`, `closed_by = null`
   - Inserts `system` notification
   - `revalidatePath('/admin', 'layout')`

4. **`updateAdminSettings(formData)`** — Upserts email notification preferences.
   - requireAdmin() guard
   - Parses 3 boolean toggles from FormData (`'true'` string comparison)
   - UPSERT on `admin_user_id` conflict with `updated_at = now()`
   - `revalidatePath('/admin/settings')`

### Tests (`tests/actions/admin/gameweeks.test.ts`)

13 tests across 4 describe blocks:
- **getCloseGameweekSummary** (4 tests): auth rejection, blocking fixtures detected, pending awards counted, canClose=true when all clear
- **closeGameweek** (5 tests): auth rejection, validation failure, blocked by IN_PLAY fixture, blocked by pending awards, success path verifying update payload and notification
- **reopenGameweek** (2 tests): auth rejection, clears closed_at/closed_by on success
- **updateAdminSettings** (2 tests): auth rejection, upserts correct payload with updated_at

### CloseGameweekDialog (`src/components/admin/close-gameweek-dialog.tsx`)

Client component with two modes:

**Close flow (isClosed=false):**
- Trigger: red "Close Gameweek" button with Lock icon
- Loads pre-close summary via `getCloseGameweekSummary` on dialog open (useEffect)
- Summary step shows: fixture counts, blocking fixtures list (red warning with names), pending bonus awards (amber warning), bonus confirmation status, points distributed, warning if 0 points
- Close button disabled when `canClose=false` with explanation text
- On confirm: calls `closeGameweek` server action
- Success step: confirmation message with Done button

**Reopen flow (isClosed=true):**
- Trigger: gray "Reopen Gameweek" button with Unlock icon (less prominent)
- Single confirmation step with amber warning about reports needing regeneration
- On confirm: calls `reopenGameweek`, then `window.location.reload()`

### Dashboard Expansion (`src/app/(admin)/admin/page.tsx`)

`getDashboardData()` expanded to fetch:
- Active/most-recent gameweek (`status != 'scheduled'`, highest number)
- Upcoming gameweek (lowest `status = 'scheduled'`)
- Pending bonus awards for active GW
- Whether all fixtures in active GW are in terminal statuses
- Whether active GW is closed
- Whether bonus is confirmed for upcoming/active GW
- Pending prize_awards count

Replaced bonuses placeholder with 5 context-aware action cards:
1. **Set Bonus** (amber) — shows when `!nextGwBonusConfirmed`; links to `/admin/gameweeks/{N}`
2. **Confirm Bonus Awards** (amber) — shows when `pendingBonusAwards > 0`; links to `/admin/bonuses`
3. **Close Gameweek** (green) — shows when `allFixturesFinished && !gwIsClosed`; embeds `CloseGameweekDialog`
4. **Gameweek Closed** (blue, informational) — shows when `gwIsClosed`; shows closed date + Reopen via `CloseGameweekDialog`
5. **Review Prizes** (purple) — shows when `pendingPrizeCount > 0`; links to `/admin/prizes`

### Settings Page Email Toggles

**`src/app/(admin)/admin/settings/page.tsx`** — New "Email Notifications" section added below Admin Account Recovery. Fetches `admin_settings` row for current admin user (handles null gracefully with defaults of `true`).

**`src/components/admin/email-notification-toggles.tsx`** — Client component:
- 3 toggle switches: Bonus reminders, Gameweek completion, Prize triggers
- Auto-saves on each toggle change via `updateAdminSettings`
- Optimistic UI: toggle updates immediately, reverts on error
- Status footer: shows "Saving...", "Saved", or error message

### GW Detail Page Integration

The 05-02 parallel plan had already added the `CloseGameweekDialog` import in its commit. My changes added:
- "Closed" badge (blue pill) in the GW title area when `gameweek.closed_at !== null`
- `CloseGameweekDialog` rendered in the header action buttons alongside the Add Fixture button
- Header buttons wrapped in a `flex gap-2` container

## Deviations from Plan

None — plan executed exactly as written. The parallel execution note about 05-02 also modifying the GW detail page was observed (05-02 committed first and already added the CloseGameweekDialog import), which was integrated seamlessly.

## Verification

- `npx vitest run tests/actions/admin/gameweeks.test.ts` — 13/13 passed (Task 1 verify)
- `npx vitest run` — 194/194 passed across 15 test files (Task 2 verify)
- All 6 expected files confirmed present via filesystem check
- Both commits confirmed in git log

## Self-Check: PASSED

- FOUND: src/actions/admin/gameweeks.ts
- FOUND: src/components/admin/close-gameweek-dialog.tsx
- FOUND: src/components/admin/email-notification-toggles.tsx
- FOUND: src/app/(admin)/admin/page.tsx
- FOUND: src/app/(admin)/admin/settings/page.tsx
- FOUND: tests/actions/admin/gameweeks.test.ts
- FOUND commit: 323a2b4 (Task 1)
- FOUND commit: 982a249 (Task 2)
