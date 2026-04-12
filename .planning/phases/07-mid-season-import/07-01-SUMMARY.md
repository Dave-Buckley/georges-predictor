---
phase: 07-mid-season-import
plan: 01
subsystem: data-layer
tags: [import, migration, tdd, parsing, zod, supabase]
dependency_graph:
  requires: []
  provides: [pre_season_picks-table, handle_new_user-trigger-fix, parseImportText, parsePreSeasonPicksText, import-validators, PreSeasonPickRow-type]
  affects: [members-table, admin_notifications-type, handle_new_user-trigger]
tech_stack:
  added: []
  patterns: [pure-function-tdd, zod-v4-issues-array, text-based-denormalised-picks]
key_files:
  created:
    - supabase/migrations/007_mid_season_import.sql
    - src/lib/import/parse.ts
    - src/lib/validators/import.ts
    - tests/lib/import-parse.test.ts
  modified:
    - src/lib/supabase/types.ts
decisions:
  - text-based team names in pre_season_picks (not UUID FKs) — Championship teams not in teams table
  - handle_new_user trigger updated with case-insensitive lower(trim()) display_name matching for placeholder linking
  - members.updated_at added as nullable timestamptz — backfilled from created_at for existing rows
  - AdminNotificationType extracted as named union type — import_complete added
metrics:
  duration: 15
  completed_date: "2026-04-12"
  tasks_completed: 2
  files_changed: 5
---

# Phase 7 Plan 1: Mid-Season Import Data Layer Summary

**One-liner:** Pure parseImportText/parsePreSeasonPicksText functions with TDD, migration 007 adding pre_season_picks table and handle_new_user placeholder-linking trigger fix.

## What Was Built

### Task 1: parseImportText and parsePreSeasonPicksText (TDD)

Two pure parsing functions in `src/lib/import/parse.ts`:

- `parseImportText(text)` — parses comma/tab-separated "Name, Points" rows. Handles whitespace trimming, blank lines, negative/decimal/non-numeric rejection, and case-insensitive duplicate detection. Returns `{ rows, errors }` with partial success support.
- `parsePreSeasonPicksText(text)` — parses 13-column rows (Name + Top4x4 + 10th + Relegated x3 + Promoted x3 + PlayoffWinner). Validates column count, empty fields, and duplicate member names.

21 test cases in `tests/lib/import-parse.test.ts` — all passing. TDD RED→GREEN executed correctly.

### Task 2: Migration 007, Types, and Validators

**Migration** (`supabase/migrations/007_mid_season_import.sql`):
- `ALTER TABLE members ADD COLUMN updated_at timestamptz` — backfilled from created_at
- `CREATE TABLE pre_season_picks` — text arrays for team names (not UUID FKs), one row per member per season, UNIQUE(member_id, season), RLS with admin-all + member-select-own policies
- `CREATE OR REPLACE FUNCTION handle_new_user()` — updated trigger uses `lower(trim(display_name))` case-insensitive matching to detect and claim imported placeholder rows. If found: UPDATE to link auth user (preserving starting_points). If not found: INSERT as before.

**Types** (`src/lib/supabase/types.ts`):
- Added `updated_at: string | null` to `MemberRow`
- Added `PreSeasonPickRow` interface matching the new table
- Extracted `AdminNotificationType` named union with `import_complete` added

**Validators** (`src/lib/validators/import.ts`):
- `importRowSchema` — single member row validation with trim transform
- `importMembersSchema` — array validation (1–100 rows)
- `importPreSeasonPicksRowSchema` — full 13-field validation
- `importPreSeasonPicksSchema` — array validation (1–100 rows)

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

### Files Exist

- FOUND: supabase/migrations/007_mid_season_import.sql
- FOUND: src/lib/import/parse.ts
- FOUND: src/lib/validators/import.ts
- FOUND: tests/lib/import-parse.test.ts
- FOUND: src/lib/supabase/types.ts (modified)

### Content Verified

- pre_season_picks table: `CREATE TABLE IF NOT EXISTS public.pre_season_picks` confirmed
- PreSeasonPickRow type: `export interface PreSeasonPickRow` confirmed
- importMembersSchema: `export const importMembersSchema` confirmed
- parseImportText: `export function parseImportText` confirmed

### Commits

- `98c9c1a` feat(07-01): parseImportText and parsePreSeasonPicksText pure functions
- `b782033` feat(07-01): migration 007, updated types, and import validators

### Test Results

- 21 tests pass in tests/lib/import-parse.test.ts
- 233 total tests pass (no regressions across all 17 test files)

## Self-Check: PASSED
