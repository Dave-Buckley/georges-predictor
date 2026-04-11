---
phase: 05-admin-panel
plan: "01"
subsystem: database-foundation
tags: [migration, types, validators, bonus, prizes, gameweeks]
dependency_graph:
  requires: []
  provides:
    - supabase/migrations/005_admin_panel.sql
    - src/lib/supabase/types.ts (BonusTypeRow, BonusScheduleRow, BonusAwardRow, AdditionalPrizeRow, PrizeAwardRow, AdminSettingsRow)
    - src/lib/validators/bonuses.ts
    - src/lib/validators/prizes.ts
    - src/lib/validators/gameweeks.ts
  affects:
    - Phase 5 Plans 02-04 (all depend on these tables + types)
    - Phase 6 (bonus point calculation engine)
tech_stack:
  added: []
  patterns:
    - SQL migration in BEGIN/COMMIT transaction
    - ON CONFLICT DO NOTHING for idempotent seed data
    - Tri-state boolean (NULL/true/false) for pending/confirmed/rejected
    - Zod z.coerce.number() for FormData integer fields
key_files:
  created:
    - supabase/migrations/005_admin_panel.sql
    - src/lib/validators/bonuses.ts
    - src/lib/validators/prizes.ts
    - src/lib/validators/gameweeks.ts
  modified:
    - src/lib/supabase/types.ts
decisions:
  - "bonus_awards.awarded uses tri-state boolean (NULL=pending, true=confirmed, false=rejected) to distinguish unreviewed from explicitly rejected"
  - "bonus_schedule seeded via CASE on (gameweek_number - 1) % 15 rotation; GW31 special-case UPDATE for Fergie Time per spec"
  - "admin_notifications type CHECK constraint dropped and re-added with all types rather than using ALTER COLUMN ADD CONSTRAINT approach"
  - "All Phase 5 tables use admin service role only for writes; bonus_types and additional_prizes grant authenticated SELECT so members can see names"
metrics:
  duration_minutes: 3
  completed_date: "2026-04-12"
  tasks_completed: 2
  files_created: 4
  files_modified: 1
---

# Phase 5 Plan 01: Database Foundation for Admin Panel

**One-liner:** SQL migration adding 6 bonus/prize/settings tables with 14 bonus types + 13 prizes seeded, plus TypeScript types and Zod validators for all Phase 5 server actions.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Create migration 005_admin_panel.sql | eb5e24d | supabase/migrations/005_admin_panel.sql |
| 2 | Add TypeScript types and Zod validators | 197ff57 | src/lib/supabase/types.ts, src/lib/validators/bonuses.ts, src/lib/validators/prizes.ts, src/lib/validators/gameweeks.ts |

## What Was Built

### Migration 005_admin_panel.sql

Six new tables in dependency order:
- `bonus_types` — 14 predefined bonus challenges (Brace Yourself, Fergie Time, Golden Glory, etc.) + custom
- `bonus_schedule` — one row per gameweek, confirmed boolean gates member visibility; UNIQUE on gameweek_id
- `bonus_awards` — tri-state (NULL/true/false) per-member award tracking; UNIQUE(gameweek_id, member_id)
- `additional_prizes` — 13 predefined competition prizes with trigger_type/trigger_config/cash_value; cash in pence
- `prize_awards` — tracks prize trigger events and George's confirmation status
- `admin_settings` — email notification toggle preferences per admin

Two table alterations:
- `gameweeks`: +double_bubble, +closed_at, +closed_by (GW10/20/30 pre-set to double_bubble=true)
- `admin_notifications`: type CHECK extended to include bonus_reminder, gw_complete, prize_triggered, bonus_award_needed

Seed data: 14 bonus types, full 38-GW rotation schedule, 13 additional prizes with trigger configs.

RLS: bonus_types/additional_prizes SELECT for authenticated users; all management tables admin-only; prize_awards confirmed-only SELECT for members.

### TypeScript Types (src/lib/supabase/types.ts)

- `GameweekRow` extended: +double_bubble, +closed_at, +closed_by
- `AdminNotificationRow.type` extended: +bonus_reminder, +gw_complete, +prize_triggered, +bonus_award_needed
- New interfaces: BonusTypeRow, BonusScheduleRow, BonusAwardRow, AdditionalPrizeRow, PrizeAwardRow, AdminSettingsRow
- Joined types: BonusScheduleWithType, PrizeAwardWithDetails

### Zod Validators

**bonuses.ts:** setBonusSchema, confirmBonusAwardSchema, bulkConfirmBonusSchema, toggleDoubleBubbleSchema, createBonusTypeSchema

**prizes.ts:** confirmPrizeSchema, createPrizeSchema (cash_value coerced from FormData pence string)

**gameweeks.ts:** closeGameweekSchema, reopenGameweekSchema

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `npx vitest run tests/lib/scoring.test.ts` — 18/18 passed (Task 1 verify)
- `npx vitest run` — 157/157 passed across 12 test files (Task 2 verify)
- All 5 expected files confirmed present via filesystem check
- Both commits confirmed in git log

## Self-Check: PASSED

- FOUND: supabase/migrations/005_admin_panel.sql
- FOUND: src/lib/supabase/types.ts
- FOUND: src/lib/validators/bonuses.ts
- FOUND: src/lib/validators/prizes.ts
- FOUND: src/lib/validators/gameweeks.ts
- FOUND commit: eb5e24d (Task 1)
- FOUND commit: 197ff57 (Task 2)
