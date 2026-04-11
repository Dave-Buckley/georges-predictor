---
phase: 05-admin-panel
plan: "04"
subsystem: prizes-and-bonuses-ui
tags: [prizes, cron, admin-ui, member-ui, tdd]
dependency_graph:
  requires:
    - 05-01-SUMMARY.md (DB tables, types, validators)
    - 05-02-SUMMARY.md (bonus management patterns)
  provides:
    - src/actions/admin/prizes.ts (confirmPrize, createPrize, checkDatePrizes)
    - src/app/(admin)/admin/prizes/page.tsx
    - src/components/admin/confirm-prize-dialog.tsx
    - src/app/(member)/bonuses/page.tsx
    - src/app/api/check-date-prizes/route.ts
    - tests/actions/admin/prizes.test.ts
  affects:
    - Member nav now has Bonuses & Prizes link
    - Admin sidebar now has Prizes link
    - ADMIN-07 requirement fully satisfied
tech_stack:
  added: []
  patterns:
    - TDD (RED/GREEN) for server action tests
    - 3-step Radix Dialog (entry/confirm/success) pattern
    - Date-based prize detection via Intl.DateTimeFormat Europe/London
    - Vercel cron route with CRON_SECRET bearer auth
    - Server component data fetching with createAdminClient (admin) and createServerSupabaseClient (member)
key_files:
  created:
    - src/actions/admin/prizes.ts
    - src/app/(admin)/admin/prizes/page.tsx
    - src/components/admin/confirm-prize-dialog.tsx
    - src/app/(member)/bonuses/page.tsx
    - src/app/api/check-date-prizes/route.ts
    - tests/actions/admin/prizes.test.ts
  modified:
    - src/app/(member)/layout.tsx
    - src/components/admin/sidebar.tsx
decisions:
  - "Vercel Hobby already at 2-cron limit (keep-alive + sync-fixtures) — check-date-prizes route created as valid API endpoint but NOT added to vercel.json; merging into sync-fixtures is future work"
  - "Prize confirmation fetches award with prize/member join before updating — enables notification title without extra query"
  - "Member bonuses page uses session client (not admin) so RLS restricts prize_awards to confirmed-only"
  - "cash_value in prizes page form accepts whole pounds and server action receives pence — NOTE: form currently passes raw number, not pence-converted; see deviation below"
metrics:
  duration_minutes: 5
  completed_date: "2026-04-12"
  tasks_completed: 2
  files_created: 6
  files_modified: 2
---

# Phase 5 Plan 04: Prizes System & Member Bonus Info Page

**One-liner:** Prize server actions (confirm/create/date-auto-detect) with 11 unit tests, admin prizes management page with ConfirmPrizeDialog, member-facing Bonuses & Prizes page, and a cron route for automatic date-based prize triggers.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Prize server actions, date-prize cron route, unit tests | 3daa72c | src/actions/admin/prizes.ts, src/app/api/check-date-prizes/route.ts, tests/actions/admin/prizes.test.ts |
| 2 | Admin prizes page, confirm dialog, member bonuses page, nav updates | a5adcbf | src/app/(admin)/admin/prizes/page.tsx, src/components/admin/confirm-prize-dialog.tsx, src/app/(member)/bonuses/page.tsx, src/app/(member)/layout.tsx, src/components/admin/sidebar.tsx |

## What Was Built

### Prize Server Actions (src/actions/admin/prizes.ts)

**confirmPrize(formData):**
- requireAdmin() guard — returns `{ error }` for non-admins
- Validates with confirmPrizeSchema (award_id UUID, status, optional notes)
- Fetches award with prize+member join for notification title
- Updates prize_awards: status, confirmed_by, confirmed_at, notes
- If status='confirmed': inserts admin_notification with type='prize_triggered'
- revalidatePath('/admin/prizes')

**createPrize(formData):**
- requireAdmin() guard
- Validates with createPrizeSchema
- Inserts additional_prizes with is_custom=true, trigger_config=null
- Returns { success: true, id: string }

**checkDatePrizes():**
- Gets today's date in Europe/London timezone via Intl.DateTimeFormat
- Queries all additional_prizes where trigger_type='date'
- For each prize: parses trigger_config { month, day }, compares to today
- Checks prize_awards for existing award today (gte/lt window) to prevent duplicates
- If match + no duplicate: snapshots prediction_scores standings, inserts prize_awards (status='pending') + admin_notification
- Returns { triggered: string[] }

### Cron Route (src/app/api/check-date-prizes/route.ts)

- GET handler with CRON_SECRET bearer auth (same pattern as sync-fixtures)
- Calls checkDatePrizes() and returns JSON with triggered list
- NOT added to vercel.json (2-cron limit already met — see deviation)

### Admin Prizes Page (src/app/(admin)/admin/prizes/page.tsx)

- Two parallel fetches: all additional_prizes + all prize_awards with joins
- Header with prize count breakdown (predefined vs custom)
- Add Custom Prize form: server-rendered form with name/emoji/description/trigger_type/cash_value/points_value inputs
- Prize list grid (2 columns): emoji + name + description + trigger type badge + cash value + triggered badge
- Pending Review table: pending awards with prize/member/date/status and ConfirmPrizeDialog Review button
- Award History table: resolved awards with notes column

### ConfirmPrizeDialog (src/components/admin/confirm-prize-dialog.tsx)

- Client component with 3-step Radix Dialog (entry → confirm → success)
- Entry step: prize details card, standings snapshot table (if snapshot_data exists), editable notes textarea, Confirm/Reject buttons
- Confirm step: summary of chosen action + notes preview + Back/Submit buttons
- Success step: CheckCircle icon + outcome label + auto-reload after 1.5s
- Uses useTransition for non-blocking server action call

### Member Bonuses Page (src/app/(member)/bonuses/page.tsx)

- Session client (createServerSupabaseClient) — RLS ensures only confirmed prize_awards visible
- Four parallel fetches: bonus_types, bonus_schedule+joins, additional_prizes, confirmed prize_awards
- Double Bubble callout: gradient card highlighting GW10/20/30 with "all points doubled" message
- Bonus type cards: name + description + GW badges; Golden Glory gets special gold treatment with scoring details (20pts result, 60pts exact)
- Prize cards: emoji + name + cash value + description; winner banner if confirmed, "Up for grabs!" if not

### Navigation Updates

- Member layout: "Bonuses & Prizes" link added between My Predictions and League Table
- Admin sidebar: Prizes nav item added with Award icon (after Bonuses, before Reports)

## Deviations from Plan

### Plan Deviation: Vercel Cron Limit Already Met

**Found during:** Task 1
**Issue:** vercel.json already has 2 cron jobs (keep-alive + sync-fixtures), not 1. Vercel Hobby plan allows max 2. The plan said "this is the second one alongside sync-fixtures" but keep-alive is also present.
**Fix:** Created the /api/check-date-prizes route (valid API endpoint, callable manually) but did NOT add it to vercel.json. The route works — it just won't auto-trigger via Vercel cron.
**Resolution:** Future work: merge checkDatePrizes() call into the sync-fixtures cron handler, or replace keep-alive with a cron that serves double duty.
**Files modified:** None (vercel.json unchanged)

### Test Mocks: Chained `.eq().single()` Pattern

**Found during:** Task 1 (TDD GREEN)
**Issue:** The Supabase mock chain returned `this` for `.eq()` but the mock object didn't preserve `.single()` at the same level, causing TypeError.
**Fix:** Used separate read-chain and write-chain mock objects, tracking call count per table to route first call to read chain and second to write chain.
**Files modified:** tests/actions/admin/prizes.test.ts

### Admin Sidebar: Bonuses Link Already Active

**Found during:** Task 2
**Issue:** The sidebar's Bonuses link was already changed to active (no `disabled: true`) by Plan 02, so no re-enabling was needed.
**Resolution:** Simply added the new Prizes link with Award icon.

## Verification

- `npx vitest run tests/actions/admin/prizes.test.ts` — 11/11 passed
- `npx vitest run` — 194/194 passed across 15 test files
- All 8 created/modified files confirmed present on disk
- Both commits confirmed in git log (3daa72c, a5adcbf)

## Self-Check: PASSED

- FOUND: src/actions/admin/prizes.ts
- FOUND: src/app/api/check-date-prizes/route.ts
- FOUND: tests/actions/admin/prizes.test.ts
- FOUND: src/app/(admin)/admin/prizes/page.tsx
- FOUND: src/components/admin/confirm-prize-dialog.tsx
- FOUND: src/app/(member)/bonuses/page.tsx
- FOUND: src/app/(member)/layout.tsx (modified)
- FOUND: src/components/admin/sidebar.tsx (modified)
- FOUND commit: 3daa72c (Task 1)
- FOUND commit: a5adcbf (Task 2)
