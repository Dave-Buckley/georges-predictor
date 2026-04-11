# Phase 7: Mid-Season Import - Research

**Researched:** 2026-04-12
**Domain:** Bulk member import with placeholder rows, pre-season picks schema, signup-linking integration
**Confidence:** HIGH (entire codebase readable; all patterns established in Phases 1–6; no external dependencies needed)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Import Data Format**
- George's source data is likely a spreadsheet or WhatsApp message — support paste (CSV/tab-separated) as the simplest zero-friction option
- Pre-season picks import: George has historical records of top 4, 10th place, relegation, promoted sides predictions per member — these should be importable alongside standings
- The import is a one-time admin operation accessible from the admin panel (not a recurring feature)

**Member Record Creation**
- Import creates member rows in the database with `display_name` and `starting_points` — these are the "imported names" that appear in the Phase 1 signup dropdown
- Members are created with `approval_status = 'pending'` and NO auth user — they're placeholders until the real person registers and claims their name
- When a member registers and picks their name from the dropdown, their auth user gets linked to the existing member row (inheriting their starting_points)
- "Bucks" (Dave — the builder/backup admin) must be included with points matching the current league leader for QA testing

**Late Joiner Support (DATA-05)**
- Already built in Phase 1: George can add members manually via admin panel with custom starting_points
- Phase 7 may just need to verify this works correctly with the import flow — no new feature needed unless the import reveals gaps

**Pre-Season Picks (ADMIN-08)**
- Pre-season predictions (top 4, 10th, relegation, promoted + playoff winner) need storage
- These are evaluated at season end (Phase 9) — Phase 7 just stores them
- Claude's discretion on storage schema and import UX

**Import Validation**
- At minimum: no duplicate names, point totals are non-negative integers, all required fields present
- George should see a preview of what will be imported before confirming
- Import should be reversible (George can clear and re-import if he made a mistake)

### Claude's Discretion
- Import page layout and UX (paste box, file upload, or manual entry table)
- Pre-season picks storage schema
- Import preview and confirmation flow
- Error handling for malformed data
- Whether to support XLSX upload (xlsx library already pinned to v0.18.x per STATE.md decisions) or just plain text paste
- How "Bucks" is seeded (part of the import or separate admin action)

### Deferred Ideas (OUT OF SCOPE)
- Pre-season prediction evaluation and scoring — Phase 9
- Historical cross-season analytics — v2
- Season archive and historical records — Phase 11
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DATA-01 | Mid-season import tool — load existing member names and points; league table always sorted by points descending (positions derived, not stored) | Bulk INSERT into `members` with `user_id = null`, `approval_status = 'pending'`, `starting_points` set. League table query uses `starting_points + SUM(prediction_scores.points_awarded) + SUM(bonus_awards.points_awarded)` ordered DESC. No stored position column. |
| DATA-05 | Late joiner support — George adds members mid-season with custom starting points | Already complete: `setMemberStartingPoints` action + dialog exist in Phase 1. The `addMember` action also supports arbitrary `starting_points`. Phase 7 needs to verify the "add single member" flow works post-import with no regressions, and confirm it populates the signup dropdown correctly. |
| ADMIN-08 | George can import mid-season data (existing standings, pre-season picks) | New `/admin/import` page + `importMembers` server action for bulk INSERT. New `pre_season_picks` table (migration 007). Preview-before-confirm pattern follows Phase 4/5 result override dialog. Clear/re-import operation is `DELETE FROM members WHERE user_id IS NULL` + re-insert. |
</phase_requirements>

---

## Summary

Phase 7 is primarily a data-entry acceleration feature — it replaces manually adding 48 members one-by-one through the existing AddMemberDialog with a bulk paste-and-import flow. The members table and all signup plumbing already exist and support this pattern.

The critical architectural decision for this phase is understanding the **two-step member lifecycle** that the import enables:

1. **Import step** (Phase 7): George pastes CSV/text with ~48 `display_name,points` rows. A server action does a bulk INSERT into `members` with `user_id = null`, `approval_status = 'pending'`, `starting_points` set. These rows are "placeholder" records.
2. **Claim step** (Phase 1, already built): When a real member signs up, the signup page shows a dropdown of all `members WHERE user_id IS NULL`. They pick their name. The DB trigger creates a NEW member row (via `handle_new_user`). **The link between the newly-created row and the imported placeholder row is NOT yet implemented** — this is the critical gap that Phase 7 must address.

**Critical Gap:** The current `signUpMember` action fires `signInWithOtp`, which triggers the `handle_new_user` trigger and always creates a BRAND NEW members row. It does NOT check if a `user_id = null` row with the same `display_name` already exists and update it. Phase 7 must fix the `signUpMember` action (or the `handle_new_user` trigger) to detect and merge the auth user into the existing imported row rather than creating a duplicate.

The second scope item is the `pre_season_picks` table — new schema needed for ADMIN-08. The design is straightforward: one row per member per season with columns for each prediction category (top4 team x4, tenth_place team x1, relegated teams x3, promoted teams x3, promoted_playoff_winner team x1).

**Primary recommendation:** Build in this order: (1) migration 007 with `pre_season_picks` table, (2) fix the `signUpMember`/trigger linking logic for the import flow, (3) `importMembers` bulk server action with validation, (4) `/admin/import` page with paste box + preview + confirm, (5) clear/re-import capability, (6) verify late joiner `addMember` flow still works post-import.

---

## Standard Stack

### Core (already installed — no new packages needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 16.2.3 | Server actions, pages, routing | Already in use |
| Supabase JS | ^2.103.0 | DB queries, RLS, bulk insert | Already in use |
| @supabase/ssr | ^0.10.2 | Server-side Supabase client | Already in use |
| Zod | ^4.3.6 | Server-side validation of import rows | Already in use — note: .issues[] not .errors[] |
| Radix UI Dialog | ^1.1.15 | Preview/confirm + clear dialogs | Already in use (result override pattern) |
| Lucide React | ^1.8.0 | Icons | Already in use |
| Vitest | ^4.1.4 | Unit tests | Already in use |

### Optional (available, use only if needed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| xlsx | v0.18.x (pinned in STATE.md) | XLSX file parsing | Only if George's source is a .xlsx export; plain text paste covers most cases and is simpler |

**No new packages required.** xlsx is already pinned as a decision but may not need installation unless file upload is added.

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── actions/admin/
│   └── import.ts               # NEW — importMembers, clearImport, previewImport
├── app/(admin)/admin/
│   └── import/
│       └── page.tsx             # NEW — import UI page
├── components/admin/
│   └── import-preview-table.tsx # NEW — preview + confirm UI
├── lib/
│   ├── validators/
│   │   └── import.ts            # NEW — Zod schemas for import row validation
│   └── supabase/
│       └── types.ts             # EXTEND — PreSeasonPickRow type
└── supabase/migrations/
    └── 007_mid_season_import.sql # NEW — pre_season_picks table
```

### Pattern 1: Placeholder Member Insert (members with user_id = null)
**What:** The import creates member rows that are "claimed" when the real person registers. These rows have `user_id = NULL`, `approval_status = 'pending'`, and a pre-set `starting_points`.
**Why this works:** The signup page's `getImportedNames()` already queries `WHERE user_id IS NULL` — imported names appear in the dropdown automatically with no changes to the signup page.

```typescript
// Source: src/app/(public)/signup/page.tsx (existing — reads user_id IS NULL rows)
const { data } = await supabase
  .from('members')
  .select('display_name')
  .is('user_id', null)
  .order('display_name', { ascending: true })
```

The import action bulk-inserts exactly these placeholder rows:
```typescript
// Source: follows createAdminClient() pattern from src/lib/supabase/admin.ts
const supabaseAdmin = createAdminClient()
await supabaseAdmin.from('members').insert(
  parsedRows.map(row => ({
    display_name: row.display_name,
    starting_points: row.starting_points,
    email: '',           // placeholder — updated when member registers
    user_id: null,       // not yet linked to an auth user
    approval_status: 'pending',
    email_opt_in: true,
  }))
)
```

**Important:** The `members` table has `user_id uuid UNIQUE` — NULL values are exempt from UNIQUE constraints in Postgres (multiple NULL values are allowed). This means 48 placeholder rows with `user_id = null` do not conflict. Verified from `supabase/migrations/001_initial_schema.sql`.

### Pattern 2: CRITICAL — Signup Linking Fix
**What:** When an imported member registers, their new auth user must be linked to their existing placeholder row, NOT create a second row.
**The problem:** `signUpMember` calls `signInWithOtp`, which triggers `handle_new_user`, which always does `INSERT INTO members`. This creates a duplicate row with no `starting_points`.
**How to fix:** Modify `handle_new_user` trigger to check for an existing `user_id IS NULL` row with the same `display_name`. If found, UPDATE that row to set `user_id = NEW.id`. If not found, INSERT as normal.

```sql
-- In migration 007 — extend handle_new_user trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_display_name  text;
  v_email_opt_in  boolean;
  v_existing_id   uuid;
BEGIN
  v_display_name := COALESCE((NEW.raw_user_meta_data->>'display_name')::text, 'Unknown');
  v_email_opt_in := COALESCE((NEW.raw_user_meta_data->>'email_opt_in')::boolean, true);

  -- Check if an imported placeholder row exists with this display_name
  SELECT id INTO v_existing_id
  FROM public.members
  WHERE display_name = v_display_name
    AND user_id IS NULL
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- Claim the imported row by linking the new auth user
    UPDATE public.members
    SET
      user_id    = NEW.id,
      email      = NEW.email,
      email_opt_in = v_email_opt_in,
      -- approval_status remains 'pending' — George still must approve
      -- starting_points already set by import — preserved
      updated_at = now()
    WHERE id = v_existing_id;
  ELSE
    -- Brand new member — insert as before
    INSERT INTO public.members (user_id, email, display_name, email_opt_in, approval_status)
    VALUES (NEW.id, NEW.email, v_display_name, v_email_opt_in, 'pending');
  END IF;

  -- Create admin notification
  INSERT INTO public.admin_notifications (type, title, message, member_id)
  VALUES (
    'new_signup',
    'New signup: ' || v_display_name,
    NEW.email || ' has registered and is waiting for approval.',
    COALESCE(v_existing_id, (SELECT id FROM public.members WHERE user_id = NEW.id))
  );

  RETURN NEW;
END;
$$;
```

**NOTE:** The `members` table needs an `updated_at timestamptz` column if it doesn't already have one — check migration 001. It does NOT have one currently. Migration 007 should add it.

### Pattern 3: Parse-Validate-Preview-Confirm Import Flow
**What:** George pastes text, server parses and validates it, returns a preview, George confirms. Follows Phase 4/5 result-override dialog pattern.
**Steps:**
1. George pastes CSV/tab-separated text into a textarea (UI)
2. "Preview" button calls `parseImportData(text)` client-side (pure function, no DB)
3. Preview table shows parsed rows with any validation errors highlighted in red
4. George fixes errors in the text and re-previews, or confirms
5. "Confirm Import" calls `importMembers(rows)` server action — bulk insert
6. Success: redirect/revalidate; George sees the members list

```typescript
// Parse function — pure, no DB calls, easy to test
export function parseImportText(text: string): {
  rows: Array<{ display_name: string; starting_points: number }>
  errors: Array<{ line: number; message: string }>
} {
  const lines = text.trim().split('\n').filter(l => l.trim())
  const rows = []
  const errors = []

  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split(/[,\t]/).map(p => p.trim())
    if (parts.length < 2) {
      errors.push({ line: i + 1, message: `Expected "Name, Points" — got: ${lines[i]}` })
      continue
    }
    const [display_name, pointsStr] = parts
    const starting_points = parseInt(pointsStr, 10)
    if (!display_name) {
      errors.push({ line: i + 1, message: 'Name cannot be empty' })
    } else if (isNaN(starting_points) || starting_points < 0) {
      errors.push({ line: i + 1, message: `Invalid points value: ${pointsStr}` })
    } else {
      rows.push({ display_name, starting_points })
    }
  }

  // Check for duplicate names within the paste
  const names = rows.map(r => r.display_name.toLowerCase())
  const dupes = names.filter((n, i) => names.indexOf(n) !== i)
  if (dupes.length > 0) {
    errors.push({ line: -1, message: `Duplicate names found: ${[...new Set(dupes)].join(', ')}` })
  }

  return { rows, errors }
}
```

### Pattern 4: Pre-Season Picks Table
**What:** One row per member per season, storing their predictions for Phase 9 evaluation.
**Why this design:** Simple flat table, one column per prediction slot, easy to import and easy to query at season end.

```sql
-- Migration 007
CREATE TABLE public.pre_season_picks (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       uuid        NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  season          int         NOT NULL,  -- e.g. 2025 for 2025/26 season
  -- Top 4 (order matters for tiebreaker scoring in Phase 9)
  top4_1          uuid        REFERENCES public.teams(id),
  top4_2          uuid        REFERENCES public.teams(id),
  top4_3          uuid        REFERENCES public.teams(id),
  top4_4          uuid        REFERENCES public.teams(id),
  -- 10th place
  tenth_place     uuid        REFERENCES public.teams(id),
  -- Bottom 3 relegated (order doesn't matter for Phase 9 scoring)
  relegated_1     uuid        REFERENCES public.teams(id),
  relegated_2     uuid        REFERENCES public.teams(id),
  relegated_3     uuid        REFERENCES public.teams(id),
  -- Promoted from Championship (3 teams)
  promoted_1      uuid        REFERENCES public.teams(id),
  promoted_2      uuid        REFERENCES public.teams(id),
  promoted_3      uuid        REFERENCES public.teams(id),
  -- Promotion playoff winner (1 team)
  promoted_playoff_winner uuid REFERENCES public.teams(id),
  -- Metadata
  imported_by     uuid        REFERENCES auth.users(id),
  imported_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, season)
);

COMMENT ON TABLE public.pre_season_picks IS
  'One row per member per season — their pre-season predictions. Evaluated by Phase 9 at season end.';
```

**Alternative design (JSONB):** Could store all picks in a single JSONB column. Rejected — harder to query in Phase 9, harder to validate, less transparent. Flat columns are preferred.

**Teams issue:** Pre-season picks reference promoted Championship teams that may not exist in the `teams` table (which only contains PL teams from football-data.org). Options:
- (a) Import text uses team names as strings, stored denormalised in the picks table (simpler for import)
- (b) Add Championship teams to the teams table

**Recommendation (Claude's discretion):** Use a simpler approach for Phase 7 — store picks as text fields (team names) instead of UUIDs. Phase 9 can match them to actual results. This avoids needing to insert Championship teams into a PL-focused teams table.

```sql
-- Simpler alternative for Phase 7
CREATE TABLE public.pre_season_picks (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       uuid        NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  season          int         NOT NULL,
  -- Stored as team names (text) since some teams are Championship/not in teams table
  top4            text[]      NOT NULL DEFAULT '{}',   -- up to 4 team names, ordered
  tenth_place     text,
  relegated       text[]      NOT NULL DEFAULT '{}',   -- up to 3 team names
  promoted        text[]      NOT NULL DEFAULT '{}',   -- up to 3 team names
  promoted_playoff_winner text,
  -- Metadata
  imported_by     uuid        REFERENCES auth.users(id),
  imported_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, season)
);
```

### Pattern 5: Clear/Re-Import Capability
**What:** George can clear all imported members and re-import if he made mistakes.
**Implementation:** Server action that deletes all `members WHERE user_id IS NULL`. Since no auth users are attached, there are no FK cascade concerns. This is reversible as long as no members have registered and claimed their name yet.

```typescript
export async function clearImportedMembers(): Promise<{ success?: boolean; deleted?: number; error?: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const supabaseAdmin = createAdminClient()

  // Count first for the confirmation dialog
  const { count } = await supabaseAdmin
    .from('members')
    .select('id', { count: 'exact', head: true })
    .is('user_id', null)

  const { error } = await supabaseAdmin
    .from('members')
    .delete()
    .is('user_id', null)

  if (error) return { error: 'Failed to clear imported members' }

  return { success: true, deleted: count ?? 0 }
}
```

**Safety guard:** If ANY imported members have already claimed their account (user_id is now set), they should NOT be deleted. The clear operation only affects `user_id IS NULL` rows so real members are always safe.

### Pattern 6: Server Action Guard Pattern
All import actions follow the established guard pattern:
```typescript
// Source: src/actions/admin/members.ts (requireAdmin pattern)
'use server'

async function requireAdmin(): Promise<{ userId: string } | { error: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user || user.app_metadata?.role !== 'admin') {
    return { error: 'Unauthorized — admin access required' }
  }
  return { userId: user.id }
}
```

### Anti-Patterns to Avoid
- **Generating client-side UUIDs for import rows:** Established decision (Phase 2) — let Postgres `gen_random_uuid()` handle IDs.
- **Storing league position as a column:** DATA-01 explicitly says "positions derived, not stored." The league table query derives positions by ordering `starting_points + earned_points DESC`.
- **Deleting claimed members in clear operation:** Only `user_id IS NULL` rows should ever be cleared; rows with a real `user_id` are permanent.
- **Using session client for admin bulk insert:** Always `createAdminClient()` — session client's RLS won't allow INSERT with `user_id = null` (the existing `admins_insert_members` policy handles this).
- **Storing XLSX library as a required dependency:** xlsx v0.18.x is pinned as a decision but should only be installed if file upload UX is chosen. Plain text paste avoids the dependency entirely.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV parsing | Custom regex parser | Simple `split('\n')` + `split(/[,\t]/)` pure function | The data is ~48 rows from George — no need for a CSV library; edge cases are minimal |
| Duplicate detection | Complex deduplication | Set-based check in parseImportText pure function | O(n) is fine at 48 rows |
| Bulk DB insert | Loop of individual inserts | Supabase `.insert(array)` — single round trip | Documented Supabase pattern |
| Import preview table | Custom data grid | Plain HTML table in a React component | 48 rows with 2 columns doesn't need a data grid library |
| File upload parsing | Custom XLSX parser | xlsx v0.18.x (already pinned) | Only if George specifically needs .xlsx; plain text preferred |
| Member linking logic | Complex matching algorithm | DB trigger update on `display_name = v_display_name AND user_id IS NULL` | Simple exact-match is sufficient; George controls names |

---

## Common Pitfalls

### Pitfall 1: Duplicate members row created on signup (the linking gap)
**What goes wrong:** George imports "Big Steve" with 340 points. Big Steve registers using the dropdown. The `handle_new_user` trigger creates a SECOND member row for Big Steve with 0 starting_points. Big Steve now appears twice in the standings — once as an unlinked placeholder (340 pts) and once as a live member (0 pts).
**Why it happens:** The current `handle_new_user` trigger always does `INSERT INTO members`. It doesn't know about imported placeholders.
**How to avoid:** Migration 007 must replace the `handle_new_user` function with the updated version that checks for an existing `user_id IS NULL` row with matching `display_name` and UPDATE-links it instead of inserting a new row.
**Warning signs:** After a member registers, two rows appear in the members table for the same display_name. The league table shows them with 0 starting_points.

### Pitfall 2: members table missing updated_at column
**What goes wrong:** The linking trigger UPDATE needs to set `updated_at = now()` to record when the row was claimed. The current `members` table has no `updated_at` column (verified from migration 001).
**Why it happens:** Phase 1 schema didn't include updated_at on members.
**How to avoid:** Migration 007 must `ALTER TABLE public.members ADD COLUMN IF NOT EXISTS updated_at timestamptz`.

### Pitfall 3: Imported names must exactly match signup dropdown names
**What goes wrong:** George imports "Big Steve" but the member signs up as "Big steve" (lowercase 's'). The trigger's `WHERE display_name = v_display_name` is case-sensitive and fails to match. A new member row is created with 0 points.
**Why it happens:** Postgres text equality is case-sensitive by default.
**How to avoid:** 
- Option A: Normalise both the imported display_name and the signup display_name to lowercase for the comparison (`WHERE lower(display_name) = lower(v_display_name)`).
- Option B: Trim whitespace in the trigger and in the import parser.
- Recommend: Both. The import action should trim + normalise names consistently. The trigger comparison should use `lower()` for matching, but preserve the original case in the stored name.

### Pitfall 4: Import inserts rows that conflict with existing approved members
**What goes wrong:** George imports a list that includes a name that was already added manually via AddMemberDialog in Phase 1 and approved. Now there are two members with the same display_name.
**Why it happens:** No duplicate-name check against existing DB rows at import time.
**How to avoid:** The `importMembers` server action must check for existing rows with each display_name before inserting. If any name already exists (regardless of `user_id`), surface it in the preview as a conflict warning. George can either skip that row or remove the duplicate manually.

```typescript
// Pre-import duplicate check
const { data: existingNames } = await supabaseAdmin
  .from('members')
  .select('display_name')
  .in('display_name', parsedRows.map(r => r.display_name))

if (existingNames && existingNames.length > 0) {
  return { error: `Names already exist: ${existingNames.map(r => r.display_name).join(', ')}` }
}
```

### Pitfall 5: Pre-season picks import references members not yet created
**What goes wrong:** If George tries to import pre-season picks at the same time as member standings, the `pre_season_picks` table's `member_id` FK requires that member rows already exist.
**Why it happens:** Import order matters — members must be inserted before their picks.
**How to avoid:** The import flow must be sequential: first import member standings (creates the rows), then optionally import pre-season picks in a separate step. Or, do both in a single transaction — insert members first, then picks. The server action should handle this ordering.

### Pitfall 6: RLS blocks bulk insert with user_id = null
**What goes wrong:** The import server action uses `createAdminClient()` to bypass RLS, but double-checking: the admin INSERT policy on members is `WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')`. The `createAdminClient()` uses the Supabase service role key, which bypasses RLS entirely — so no issue. But if someone accidentally uses the session client instead, the INSERT will fail.
**Why it happens:** Copying from a member-facing action that uses `createServerSupabaseClient()`.
**How to avoid:** Import actions always use `createAdminClient()`. Clearly comment this in the action file.

### Pitfall 7: "Bucks" import — Dave is admin-only, not a participant
**What goes wrong:** Dave (Bucks) is an admin user in `auth.users`. If his display_name is also imported as a placeholder member, and he later "signs up" via the normal flow, the linking trigger would fire and turn him into a regular member row — potentially causing confusion between his admin row and member row.
**Why it happens:** Dave has special status — he's admin-only (AUTH-08 says George submits predictions; Dave is admin-only, not a participant).
**How to avoid:** "Bucks" should be added via the existing `addMember` admin action (which creates an auth user + member row properly), NOT via the bulk import. The import is for the 48 real participants. Dave gets added as a special case. His `starting_points` are set to match the current league leader via `setMemberStartingPoints`.

### Pitfall 8: Clearing import after members have registered
**What goes wrong:** George panics and clicks "Clear Import" after some members have already registered and claimed their names. The action should only delete `user_id IS NULL` rows, so registered members are safe — but if George doesn't understand this, he may think they're all gone.
**Why it happens:** UX ambiguity.
**How to avoid:** The clear confirmation dialog must clearly state: "This will remove X unregistered placeholders. Members who have already signed up (Y members) will NOT be affected." Show the count of both categories.

---

## Database Design (Migration 007)

### New Table: pre_season_picks

```sql
-- Migration 007 — pre_season_picks table + members table fixes

CREATE TABLE public.pre_season_picks (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       uuid        NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  season          int         NOT NULL,
  -- Store as text arrays — Championship teams not in teams table, 
  -- and Phase 9 evaluates against actual season-end standings
  top4            text[]      NOT NULL DEFAULT '{}',
  tenth_place     text,
  relegated       text[]      NOT NULL DEFAULT '{}',
  promoted        text[]      NOT NULL DEFAULT '{}',
  promoted_playoff_winner text,
  imported_by     uuid        REFERENCES auth.users(id),
  imported_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, season)
);

ALTER TABLE public.pre_season_picks ENABLE ROW LEVEL SECURITY;

-- Only admins can manage pre-season picks (import and read)
CREATE POLICY admins_all_pre_season_picks
  ON public.pre_season_picks FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Members can read their own pre-season picks (for future member-facing display in Phase 9)
CREATE POLICY members_select_own_picks
  ON public.pre_season_picks FOR SELECT
  USING (
    member_id = (SELECT id FROM public.members WHERE user_id = auth.uid() LIMIT 1)
  );

COMMENT ON TABLE public.pre_season_picks IS
  'Pre-season predictions per member per season. Imported by George, evaluated by Phase 9.';
```

### Modifications to Existing Tables

**members** — add updated_at for tracking when placeholder rows are claimed:
```sql
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Backfill existing rows with their created_at value
UPDATE public.members SET updated_at = created_at WHERE updated_at IS NULL;
```

**handle_new_user trigger** — extend to link imported placeholder rows:
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_display_name  text;
  v_email_opt_in  boolean;
  v_existing_id   uuid;
  v_member_id     uuid;
BEGIN
  v_display_name := COALESCE((NEW.raw_user_meta_data->>'display_name')::text, 'Unknown');
  v_email_opt_in := COALESCE((NEW.raw_user_meta_data->>'email_opt_in')::boolean, true);

  -- Check for existing imported placeholder with same display_name (case-insensitive)
  SELECT id INTO v_existing_id
  FROM public.members
  WHERE lower(trim(display_name)) = lower(trim(v_display_name))
    AND user_id IS NULL
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- Claim existing imported row
    UPDATE public.members
    SET
      user_id      = NEW.id,
      email        = NEW.email,
      email_opt_in = v_email_opt_in,
      updated_at   = now()
    WHERE id = v_existing_id;
    v_member_id := v_existing_id;
  ELSE
    -- New member — insert fresh row
    INSERT INTO public.members (user_id, email, display_name, email_opt_in, approval_status)
    VALUES (NEW.id, NEW.email, v_display_name, v_email_opt_in, 'pending')
    RETURNING id INTO v_member_id;
  END IF;

  -- Create admin notification
  INSERT INTO public.admin_notifications (type, title, message, member_id)
  VALUES (
    'new_signup',
    'New signup: ' || v_display_name,
    NEW.email || ' has registered and is waiting for approval.',
    v_member_id
  );

  RETURN NEW;
END;
$$;
```

---

## Code Examples

### importMembers server action

```typescript
// Source: follows src/actions/admin/members.ts pattern
// src/actions/admin/import.ts

'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type ImportRow = { display_name: string; starting_points: number }

export async function importMembers(
  rows: ImportRow[]
): Promise<{ success?: boolean; imported?: number; error?: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  if (!rows.length) return { error: 'No rows to import' }

  const supabaseAdmin = createAdminClient()

  // Check for conflicts with existing DB names
  const { data: existing } = await supabaseAdmin
    .from('members')
    .select('display_name')
    .in('display_name', rows.map(r => r.display_name))

  if (existing && existing.length > 0) {
    const conflicts = existing.map((r: { display_name: string }) => r.display_name).join(', ')
    return { error: `Names already exist in the database: ${conflicts}` }
  }

  const { error } = await supabaseAdmin.from('members').insert(
    rows.map(row => ({
      display_name: row.display_name.trim(),
      starting_points: row.starting_points,
      email: '',              // no email yet — placeholder
      user_id: null,          // not yet linked
      approval_status: 'pending',
      email_opt_in: true,
    }))
  )

  if (error) {
    console.error('[importMembers] Insert error:', error.message)
    return { error: 'Import failed. Check for duplicate names.' }
  }

  revalidatePath('/admin/members')
  revalidatePath('/admin/import')

  return { success: true, imported: rows.length }
}
```

### League Table Query (DATA-01 — positions derived, not stored)

```typescript
// Total points = starting_points + sum(prediction_scores) + sum(confirmed bonus_awards)
// Source: derived from existing scoring patterns in src/lib/scoring/recalculate.ts

const { data: standings } = await supabaseAdmin
  .from('members')
  .select(`
    id,
    display_name,
    starting_points,
    approval_status,
    prediction_scores ( points_awarded ),
    bonus_awards ( points_awarded, awarded )
  `)
  .eq('approval_status', 'approved')

const withTotals = (standings ?? []).map(member => {
  const predPoints = member.prediction_scores?.reduce(
    (sum: number, s: { points_awarded: number }) => sum + (s.points_awarded ?? 0), 0
  ) ?? 0
  const bonusPoints = member.bonus_awards
    ?.filter((a: { awarded: boolean | null }) => a.awarded === true)
    .reduce((sum: number, a: { points_awarded: number }) => sum + (a.points_awarded ?? 0), 0) ?? 0
  return {
    ...member,
    total_points: member.starting_points + predPoints + bonusPoints,
  }
}).sort((a, b) => b.total_points - a.total_points)

// Position is derived from array index — not stored anywhere
const withPositions = withTotals.map((m, i) => ({ ...m, position: i + 1 }))
```

### Admin Import Page Structure

```typescript
// src/app/(admin)/admin/import/page.tsx
// New page — accessible from sidebar

export default async function ImportPage() {
  const supabase = createAdminClient()
  
  // Show current state — how many imported vs registered members
  const { count: importedCount } = await supabase
    .from('members')
    .select('id', { count: 'exact', head: true })
    .is('user_id', null)

  const { count: registeredCount } = await supabase
    .from('members')
    .select('id', { count: 'exact', head: true })
    .not('user_id', 'is', null)
    .eq('approval_status', 'approved')

  return (
    <div className="p-6 lg:p-8">
      <h1>Mid-Season Import</h1>
      {/* Status summary */}
      {/* Paste import textarea + preview */}
      {/* Clear import button (with count of unregistered placeholders) */}
    </div>
  )
}
```

---

## Integration Points

### Signup Flow (no code changes needed)
The signup page (`src/app/(public)/signup/page.tsx`) already queries `WHERE user_id IS NULL` for the dropdown. Once import creates placeholder rows, they appear automatically. No changes to signup page or `name-picker.tsx` component.

### Admin Sidebar — Add Import Link
```typescript
// src/components/admin/sidebar.tsx — add to navItems array
{
  href: '/admin/import',
  label: 'Import Data',
  icon: Upload,  // from lucide-react
}
```

### Late Joiner Flow (DATA-05 — verify no regression)
The existing `addMember` action creates an auth user + member row AND sends a welcome invite. This correctly bypasses the import flow entirely — it's the right path for NEW members joining mid-season who were never in George's spreadsheet. No changes needed; just verify it still works correctly after migration 007.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| handle_new_user trigger always INSERTs | Updated trigger checks for user_id IS NULL placeholder first | Prevents duplicate rows for imported members who register |
| No pre_season_picks storage | New table with text[] columns | Phase 9 can evaluate George's historical records |
| Adding 48 members one-by-one via AddMemberDialog | Bulk paste-and-import with preview | George's workflow: paste → preview → confirm = under 5 minutes |

**Existing decisions that affect Phase 7:**
- `createAdminClient()` is the bypass client — import action always uses this
- Zod v4 uses `.issues[]` not `.errors[]`
- `admins_insert_members` RLS policy already exists — admin client INSERT is allowed
- `user_id UNIQUE` on members is nullable-safe (multiple NULLs allowed in Postgres)

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.4 + jsdom |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run tests/lib/import.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | parseImportText parses valid CSV/tab rows correctly | unit | `npx vitest run tests/lib/import.test.ts` | Wave 0 |
| DATA-01 | parseImportText detects duplicate names within paste | unit | `npx vitest run tests/lib/import.test.ts` | Wave 0 |
| DATA-01 | parseImportText rejects negative point values | unit | `npx vitest run tests/lib/import.test.ts` | Wave 0 |
| DATA-01 | parseImportText rejects rows missing name or points | unit | `npx vitest run tests/lib/import.test.ts` | Wave 0 |
| DATA-01 | League table total = starting_points + prediction_scores + confirmed bonuses | unit | `npx vitest run tests/lib/import.test.ts` | Wave 0 |
| DATA-05 | addMember still works post-import (starting_points preserved) | unit | `npx vitest run tests/actions/admin/members.test.ts` | Extend existing |
| ADMIN-08 | importMembers rejects if name already exists in DB | unit | `npx vitest run tests/actions/admin/import.test.ts` | Wave 0 |
| ADMIN-08 | importMembers bulk-inserts all valid rows | unit | `npx vitest run tests/actions/admin/import.test.ts` | Wave 0 |
| ADMIN-08 | clearImportedMembers only deletes user_id IS NULL rows | unit | `npx vitest run tests/actions/admin/import.test.ts` | Wave 0 |
| ADMIN-08 | importMembers rejects non-admin callers | unit | `npx vitest run tests/actions/admin/import.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** Run the test file relevant to the changed code
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/lib/import.test.ts` — covers `parseImportText` pure function (DATA-01 parsing logic)
- [ ] `tests/actions/admin/import.test.ts` — covers `importMembers`, `clearImportedMembers` (ADMIN-08)
- [ ] Extend `tests/actions/admin/members.test.ts` — DATA-05 regression check for addMember post-import

*(Existing test infrastructure covers all other requirements — no new framework setup needed)*

---

## Open Questions

1. **Pre-season picks import UX — combined or separate step?**
   - What we know: George has picks for all 48 members; the import is one-time
   - What's unclear: Is George's data structured so picks and standings are in the same spreadsheet row, or separate documents?
   - Recommendation: Separate import steps in the UI — first import standings (name + points), then optionally import picks (name + top4 + 10th + relegated + promoted). Cleaner validation per step; George can do standings first without having picks ready. The STATE.md blocker "Confirm George's existing spreadsheet format" is relevant here — the import format should be designed after seeing the actual data.

2. **"Bucks" (Dave) — built into import or separate action?**
   - What we know: Dave needs joint-top points for QA; Dave is an admin (auth.users row exists)
   - What's unclear: Should Dave be importable via the bulk import? Or always added via addMember separately?
   - Recommendation: Dave should be added via `addMember` (not the bulk import), since he already has an auth user and the import creates placeholder rows for unauthenticated users. The pending todo in STATE.md says "Add Bucks" — this is a manual step George or the builder performs post-import via the existing AddMemberDialog. Document this clearly in the import page's UI.

3. **Email field on imported placeholder rows**
   - What we know: members.email has NOT NULL constraint (from migration 001)
   - What's unclear: What should be stored as email for placeholder rows that don't have an email yet?
   - Recommendation: Store an empty string `''` as a placeholder (the NOT NULL constraint allows this). When the member registers, the trigger UPDATE sets their real email. Verify the empty string doesn't break any email-related queries.

4. **Import idempotency — what if George runs import twice?**
   - What we know: The action checks for existing names before inserting
   - What's unclear: Should a second import attempt update existing placeholder points, or block entirely?
   - Recommendation: Block entirely with a clear error listing conflicts. George should use Clear Import first if he needs to re-import. This is simpler and safer than partial updates.

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection of `supabase/migrations/001_initial_schema.sql` — members table schema, handle_new_user trigger, UNIQUE constraint on user_id
- Direct code inspection of `src/actions/admin/members.ts` — requireAdmin pattern, createAdminClient usage, addMember/setMemberStartingPoints actions
- Direct code inspection of `src/app/(public)/signup/page.tsx` — getImportedNames queries `WHERE user_id IS NULL`
- Direct code inspection of `src/actions/auth.ts` — signUpMember calls signInWithOtp, triggers handle_new_user
- Direct code inspection of `src/lib/supabase/types.ts` — MemberRow shape (no updated_at column confirmed)
- Direct code inspection of `src/components/admin/sidebar.tsx` — existing nav items for import link placement
- Direct code inspection of `package.json` — confirmed no new packages needed

### Secondary (MEDIUM confidence)
- CONTEXT.md (07-CONTEXT.md) — all locked decisions verified
- STATE.md — confirmed xlsx v0.18.x pinned; confirmed "Bucks" pending todo

### Tertiary (LOW confidence — not needed)
- N/A — all findings from local codebase; no external research required

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — reads directly from package.json; no new installs needed
- Database design: HIGH — derived from existing migration patterns + CONTEXT.md locked decisions
- Architecture patterns (import): HIGH — read directly from existing server actions and signup page
- Critical gap (trigger linking): HIGH — verified by inspecting signUpMember action and handle_new_user trigger
- Validation architecture: HIGH — test framework already configured in vitest.config.ts

**Research date:** 2026-04-12
**Valid until:** Stable — no fast-moving external dependencies; all findings from the local codebase
