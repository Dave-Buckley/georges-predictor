# Phase 3: Predictions - Research

**Researched:** 2026-04-11
**Domain:** Next.js 15 server actions + Supabase RLS + React form state
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Prediction Entry UX**
- Inline score inputs directly on each fixture card — two small number fields (home/away) appear in the existing `prediction-area` placeholder below the teams
- Mobile input: +/- stepper buttons with tap-to-type fallback (tapping the number opens phone keypad for direct entry)
- No modal, no separate form — members see fixtures and enter scores in one view

**Submission Flow**
- All-at-once submission — member fills in scores across all fixtures, then hits one "Submit Predictions" button at the bottom of the gameweek page
- Partial submission allowed — only filled-in fixtures are saved; unfilled ones are skipped without error
- After initial submission, the button changes to "Update Predictions" — member edits scores and re-submits with the same button
- No auto-save — explicit submit/update action required

**Visibility & Reveal (OVERRIDES PRED-03)**
- Predictions become visible to ALL members at kick-off, not after gameweek completion
- Rule: kick-off = locked + visible. Once a fixture's kick-off time passes, everyone can see everyone's predictions for that match
- Before kick-off: member sees only their own predictions; other members' predictions are hidden
- Gameweek-level submission counter shown: "34 of 48 members have submitted" — no per-fixture counts
- No special export for WhatsApp — the page itself is the transparency tool
- George can view all members' predictions at any time (before and after kick-off) from the admin panel

**George's Prediction Experience**
- George submits his own predictions from the regular member gameweek page — same form as everyone else
- George does NOT use the admin "My Predictions" tab to submit — that tab repurposed (Claude's discretion)
- Admin panel has a dedicated "All Predictions" view: table showing all members' predictions per gameweek (members as rows, fixtures as columns)

### Claude's Discretion
- Saved prediction display on fixture cards (filled inputs vs read-only with edit vs colour-coded)
- Visual distinction between submitted and un-submitted fixtures
- Confirmation feedback after submit (banner vs dialog vs inline)
- On-page deadline urgency (sticky banner vs relying on existing amber/countdown UX + email reminders)
- Prediction reveal layout (per-fixture expandable vs separate view)
- Admin "My Predictions" tab content (redirect to member page, read-only summary, or remove)
- Empty state design (no predictions yet, no fixtures loaded)
- Late submission messaging (how to inform members that some fixtures are already locked)
- Overall gameweek submission counter placement and design

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PRED-01 | Member can submit score predictions (home/away goals) for all fixtures in a gameweek | Server action pattern from `fixtures.ts`; `predictions` table migration; form wrapping `GameweekView` |
| PRED-02 | Member can edit predictions any time before that fixture's kick-off | `canSubmitPrediction()` in `lockout.ts` is already built; upsert pattern on `predictions` table |
| PRED-03 | Predictions hidden from all other members until all fixtures in the gameweek are complete | **OVERRIDDEN by context**: visibility gates at kick-off, not gameweek complete; enforced via RLS using `kickoff_time > now()` |
| PRED-04 | George can view all members' predictions at any time | Admin bypasses RLS via `app_metadata.role = 'admin'`; admin panel All Predictions table |
| PRED-05 | Late submissions accepted for remaining un-kicked-off fixtures only | `canSubmitPrediction()` already enforces this per-fixture; partial saves skip locked fixtures |
</phase_requirements>

---

## Summary

Phase 3 builds on top of two fully-deployed phases. The database schema, lockout utility, RLS policy template, and all UI components exist. The core work is: (1) a new `predictions` table migration with RLS enforcing the kick-off visibility rule, (2) a prediction server action following the exact pattern of `src/actions/admin/fixtures.ts`, (3) a client-side prediction form injected into the `prediction-area` placeholder on each `FixtureCard`, and (4) the admin "All Predictions" table replacing the current placeholder page.

The most critical design decision is already made: visibility gates at kick-off time, not gameweek completion. This simplifies the RLS policy significantly — a single `kickoff_time > now()` condition controls both write access (INSERT/UPDATE) and read visibility (SELECT for non-admin members). The exact commented-out RLS template for INSERT/UPDATE is already written in `002_fixture_layer.sql` and needs a SELECT policy added alongside it.

The submission counter ("34 of 48 members have submitted") requires a count query joining `predictions` with `members`. This must be scoped to return only the count (not individual names/scores) to avoid leaking pre-kick-off data. The admin panel bypasses this restriction entirely via service role.

**Primary recommendation:** Follow the `fixtures.ts` server action pattern exactly. Build a single `submitPredictions` server action that accepts a gameweek number and an array of `{fixture_id, home_score, away_score}` entries. Use upsert on `(member_id, fixture_id)` unique constraint. Skip fixtures where `canSubmitPrediction()` returns false rather than erroring.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js (App Router) | 16.2.3 (installed) | Server actions, routing | Already in project |
| Supabase JS | 2.103.0 (installed) | Database, auth, RLS | Already in project |
| react-hook-form | 7.72.1 (installed) | Form state for stepper inputs | Already in project, used in auth forms |
| Zod | 4.3.6 (installed) | Prediction input validation | Already in project, used in all validators |
| Tailwind CSS | v4 (installed) | Styling | Already in project |
| Lucide React | 1.8.0 (installed) | Icons (lock, check etc.) | Already in project |

### No New Dependencies Required
All libraries needed for Phase 3 are already installed. The stepper button UI is built with standard HTML inputs and Tailwind — no additional library needed.

**Installation:** None required.

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── actions/
│   └── predictions.ts          # NEW: submitPredictions server action
├── components/
│   └── predictions/
│       ├── prediction-inputs.tsx     # NEW: inline home/away stepper inputs
│       ├── prediction-form.tsx       # NEW: form wrapper for gameweek page
│       └── predictions-table.tsx    # NEW: admin all-predictions table
├── app/
│   ├── (member)/gameweeks/[gwNumber]/
│   │   └── page.tsx            # MODIFY: pass member predictions + submission count
│   └── (admin)/admin/predictions/
│       └── page.tsx            # REPLACE: all-predictions table view
└── lib/
    └── supabase/
        └── types.ts            # EXTEND: PredictionRow, PredictionWithMember types
supabase/
└── migrations/
    └── 003_predictions.sql     # NEW: predictions table + RLS
```

### Pattern 1: Predictions Table Schema
**What:** The `predictions` table stores one row per (member, fixture) pair. Scores are nullable to support partial saves.
**When to use:** Upsert on unique constraint `(member_id, fixture_id)`.

```sql
-- Source: established pattern from 002_fixture_layer.sql
CREATE TABLE public.predictions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id    uuid        NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  fixture_id   uuid        NOT NULL REFERENCES public.fixtures(id) ON DELETE CASCADE,
  home_score   int         NOT NULL CHECK (home_score >= 0),
  away_score   int         NOT NULL CHECK (away_score >= 0),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, fixture_id)
);
```

### Pattern 2: RLS Visibility Policy
**What:** Members can only read their own predictions OR predictions for fixtures that have already kicked off. Admins bypass via JWT claim.
**When to use:** This is the core visibility rule decided in CONTEXT.md (overriding PRED-03).

```sql
-- Source: adapted from 002_fixture_layer.sql RLS patterns + CONTEXT.md decision

-- Members can INSERT/UPDATE their own predictions only before kickoff
-- (template already exists commented in 002_fixture_layer.sql - apply here)
CREATE POLICY predictions_insert_before_kickoff
  ON public.predictions FOR INSERT
  WITH CHECK (
    member_id = (SELECT id FROM public.members WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.fixtures f
      WHERE f.id = fixture_id
        AND f.kickoff_time > now()
    )
  );

-- Members can read: their OWN predictions (any fixture) OR predictions for kicked-off fixtures
CREATE POLICY predictions_select_member
  ON public.predictions FOR SELECT
  USING (
    member_id = (SELECT id FROM public.members WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.fixtures f
      WHERE f.id = fixture_id
        AND f.kickoff_time <= now()
    )
  );

-- Admin can read ALL predictions at any time
CREATE POLICY predictions_select_admin
  ON public.predictions FOR SELECT
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
```

### Pattern 3: Server Action — submitPredictions
**What:** Follows exact pattern from `src/actions/admin/fixtures.ts`. Accepts array of prediction entries, checks lockout per fixture, upserts valid ones.
**When to use:** Called from the prediction form on gameweek page submit.

```typescript
// Source: follows src/actions/admin/fixtures.ts pattern exactly
'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { canSubmitPrediction } from '@/lib/fixtures/lockout'
import { predictionSchema } from '@/lib/validators/predictions'

export async function submitPredictions(
  gameweekNumber: number,
  entries: Array<{ fixture_id: string; home_score: number; away_score: number }>
): Promise<{ success?: boolean; saved: number; skipped: number; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) return { error: 'Not authenticated', saved: 0, skipped: 0 }

  // Look up member_id from user_id
  const { data: member } = await supabase
    .from('members')
    .select('id, approval_status')
    .eq('user_id', user.id)
    .single()

  if (!member || member.approval_status !== 'approved') {
    return { error: 'Member not approved', saved: 0, skipped: 0 }
  }

  let saved = 0
  let skipped = 0

  for (const entry of entries) {
    const lockout = await canSubmitPrediction(entry.fixture_id)
    if (!lockout.canSubmit) { skipped++; continue }

    const { error } = await supabase
      .from('predictions')
      .upsert(
        { member_id: member.id, fixture_id: entry.fixture_id,
          home_score: entry.home_score, away_score: entry.away_score,
          updated_at: new Date().toISOString() },
        { onConflict: 'member_id,fixture_id' }
      )

    if (!error) saved++
    else skipped++
  }

  revalidatePath(`/gameweeks/${gameweekNumber}`)
  return { success: true, saved, skipped }
}
```

### Pattern 4: Stepper Input Component
**What:** Mobile-first score input with +/- buttons. Uses `type="number"` with `inputmode="numeric"` so mobile devices show numeric keypad on tap. Controlled via react-hook-form or local state.
**When to use:** Inside `prediction-area` div of each `FixtureCard`.

```tsx
// Source: established mobile UX pattern for score entry
// inputmode="numeric" triggers phone keypad without arrow spinners
<input
  type="number"
  inputMode="numeric"
  min={0}
  max={20}
  className="w-10 text-center bg-slate-700 border border-slate-600 rounded text-white text-sm"
  value={score}
  onChange={(e) => setScore(parseInt(e.target.value) || 0)}
/>
```

### Pattern 5: Submission Counter Query
**What:** Count how many distinct members have at least one prediction for a given gameweek, without revealing individual predictions.
**When to use:** Displayed on the gameweek page header as "X of Y members have submitted".

```typescript
// Source: established Supabase count pattern
// This query returns only a count — no individual predictions or member names
const { count: submittedCount } = await supabase
  .from('predictions')
  .select('member_id', { count: 'exact', head: false })
  .in('fixture_id', fixtureIds)  // fixtureIds for this gameweek

// For total members:
const { count: totalMembers } = await supabase
  .from('members')
  .select('*', { count: 'exact', head: true })
  .eq('approval_status', 'approved')
```

**Note:** The count query above returns rows (one per prediction), not distinct members. Use a Supabase RPC function or distinct subquery to get unique member count. See Pitfall 2.

### Pattern 6: Admin All-Predictions Table
**What:** Replaces `/admin/predictions` placeholder. Shows a grid: rows = members, columns = fixtures. Admin uses `createAdminClient()` (service role, bypasses RLS) to read all predictions regardless of kick-off time.
**When to use:** George checking who has submitted and what they picked.

```typescript
// Source: follows admin patterns from fixtures.ts — admin client for unrestricted reads
import { createAdminClient } from '@/lib/supabase/admin'

const supabaseAdmin = createAdminClient()
const { data: allPredictions } = await supabaseAdmin
  .from('predictions')
  .select('member_id, fixture_id, home_score, away_score, members(display_name), fixtures(kickoff_time, home_team_id, away_team_id)')
  .eq('fixtures.gameweek_id', gameweekId)
```

### Anti-Patterns to Avoid
- **Separate submit per fixture:** The UX decision is all-at-once submit. Don't build per-fixture save buttons.
- **Auto-save on input change:** Explicitly decided against. No debounced saves, no onChange server calls.
- **Client-side lockout only:** `canSubmitPrediction()` MUST be called server-side. Client timer alone is bypassable.
- **Generating member_id client-side:** Always look up `member_id` from `user_id` in the server action, never trust client-passed member IDs.
- **Using `createServerSupabaseClient` for admin reads:** Admin "All Predictions" view must use `createAdminClient()` (service role) to bypass RLS and see pre-kick-off predictions.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Lockout enforcement | Custom time-check logic | `canSubmitPrediction()` in `lockout.ts` | Already built in Phase 2, two-layer enforcement |
| RLS visibility | Application-layer filtering | Supabase RLS policies | Cannot be bypassed client-side, enforced at DB level |
| Form validation | Manual score range checks | Zod `predictionSchema` (new file) | Consistent with all existing validators |
| Idempotent upsert | Custom "check then insert or update" | Supabase `.upsert({ onConflict: 'member_id,fixture_id' })` | Single atomic operation, race-condition safe |
| Stepper UI | Custom wheel/picker component | `type="number" inputMode="numeric"` with +/- buttons | Sufficient for 0-20 score range; no extra library |
| Submission count | Complex SQL | Simple count query with `head: false` + distinct | Supabase handles this efficiently |

**Key insight:** The lockout system, RLS policy templates, server action pattern, and all UI primitives are pre-built. Phase 3 is wiring them together, not building from scratch.

---

## Common Pitfalls

### Pitfall 1: RLS Policy Allows INSERT Without member_id Check
**What goes wrong:** The commented RLS template in `002_fixture_layer.sql` only checks `kickoff_time > now()`. Without also checking `member_id = auth.uid()`'s member row, any authenticated user could insert predictions on behalf of any member.
**Why it happens:** The template was a minimal documentation placeholder.
**How to avoid:** The INSERT policy must check BOTH the kickoff constraint AND that `member_id` matches the authenticated user's member row.
**Warning signs:** A member can submit predictions that show `member_id` belonging to another member.

### Pitfall 2: Submission Counter Counts Predictions, Not Members
**What goes wrong:** `SELECT COUNT(*) FROM predictions WHERE fixture_id IN (...)` counts total prediction rows, not distinct submitting members. A member with 10 predictions is counted 10 times.
**Why it happens:** Count queries default to row count, not distinct.
**How to avoid:** Use `SELECT COUNT(DISTINCT member_id)` via a Supabase RPC, or fetch distinct member_ids and count in application code. Alternatively use a subquery: `SELECT COUNT(*) FROM (SELECT DISTINCT member_id FROM predictions WHERE fixture_id = ANY($1)) sub`.
**Warning signs:** Counter shows "48 of 48" with only a few members having submitted.

### Pitfall 3: FixtureCard Is a Client Component — Server Action Cannot Be Called Directly
**What goes wrong:** `fixture-card.tsx` is marked `'use client'`. A server action imported directly into a client component works in Next.js 15 (you can pass server actions as props), but the prediction form needs to manage optimistic state client-side. Mixing server and client state incorrectly causes stale UI.
**Why it happens:** Next.js App Router client/server boundary confusion.
**How to avoid:** Keep `FixtureCard` as the display component. Create `PredictionForm` as the wrapping client component on the gameweek page. `PredictionForm` manages all input state and calls the server action on submit. `FixtureCard` receives `prediction` data as a prop.
**Warning signs:** Form state resets on every keystroke due to re-render from server.

### Pitfall 4: Admin Gameweek Page Must Also Show Predictions (George Predicts from Member Page)
**What goes wrong:** The admin layout (`/admin/*`) has no member gameweek pages. George must use the member gameweek page (`/gameweeks/[gwNumber]`) to submit predictions. If the member page checks `approval_status = 'approved'` and George (admin) doesn't have a members row, the page breaks.
**Why it happens:** George is both admin and participant. Phase 1 established AUTH-08: George submits from admin panel, but CONTEXT.md overrides this to the member page.
**How to avoid:** Confirm George has a `members` row with `approval_status = 'approved'` (Phase 1 established this). The member page must not gate on `role !== 'admin'` — it should allow admins through as members too.
**Warning signs:** George sees a "pending" notice or gets redirected away from the gameweek prediction page.

### Pitfall 5: Duplicate `prediction-area` div — Phase 3 Injects Content Into It
**What goes wrong:** `FixtureCard` has `<div className="mt-3 prediction-area" data-fixture-id={fixture.id} />`. If Phase 3 creates a new `FixtureCard` variant, there could be confusion about which component to modify.
**Why it happens:** The placeholder approach defers the injection point.
**How to avoid:** The correct approach is to extend `FixtureCard`'s props to accept an optional `prediction` prop and optional `onScoreChange` callback. The `prediction-area` div gets replaced with the actual inputs component. `GameweekView` is updated to pass prediction data down.
**Warning signs:** Two different fixture card components existing, both used inconsistently.

### Pitfall 6: Re-reading Predictions on Every Keystroke (Performance)
**What goes wrong:** If the form triggers a server fetch on every score change (e.g., via `useEffect` + server action), the gameweek page becomes slow with 10 fixtures.
**Why it happens:** Not using local form state for input management.
**How to avoid:** Predictions are loaded once when the page loads (as a prop). All input changes are managed in local React state. Only the final submit triggers a server action.
**Warning signs:** Network tab shows 10+ requests while typing scores.

---

## Code Examples

### Migration 003 — predictions table with RLS
```sql
-- Source: established schema pattern from 002_fixture_layer.sql
-- File: supabase/migrations/003_predictions.sql

CREATE TABLE public.predictions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id    uuid        NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  fixture_id   uuid        NOT NULL REFERENCES public.fixtures(id) ON DELETE CASCADE,
  home_score   int         NOT NULL CHECK (home_score >= 0),
  away_score   int         NOT NULL CHECK (away_score >= 0),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, fixture_id)
);

ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

-- Member writes own predictions before kickoff
CREATE POLICY predictions_insert_before_kickoff
  ON public.predictions FOR INSERT
  WITH CHECK (
    member_id = (SELECT id FROM public.members WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.fixtures f
      WHERE f.id = fixture_id AND f.kickoff_time > now()
    )
  );

CREATE POLICY predictions_update_before_kickoff
  ON public.predictions FOR UPDATE
  USING (
    member_id = (SELECT id FROM public.members WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.fixtures f
      WHERE f.id = fixture_id AND f.kickoff_time > now()
    )
  );

-- Members read own predictions + predictions for kicked-off fixtures
CREATE POLICY predictions_select_member
  ON public.predictions FOR SELECT
  USING (
    member_id = (SELECT id FROM public.members WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.fixtures f
      WHERE f.id = fixture_id AND f.kickoff_time <= now()
    )
  );

-- Admin reads everything
CREATE POLICY predictions_select_admin
  ON public.predictions FOR SELECT
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Indexes
CREATE INDEX predictions_member_id_idx  ON public.predictions(member_id);
CREATE INDEX predictions_fixture_id_idx ON public.predictions(fixture_id);
```

### Prediction Zod Validator
```typescript
// Source: follows src/lib/validators/admin.ts pattern
// File: src/lib/validators/predictions.ts

import { z } from 'zod'

export const predictionEntrySchema = z.object({
  fixture_id: z.string().uuid('Invalid fixture ID'),
  home_score: z.coerce.number().int().min(0, 'Score cannot be negative').max(20, 'Score too high'),
  away_score: z.coerce.number().int().min(0, 'Score cannot be negative').max(20, 'Score too high'),
})

export const submitPredictionsSchema = z.object({
  gameweek_number: z.coerce.number().int().min(1).max(38),
  entries: z.array(predictionEntrySchema).min(1, 'At least one prediction required'),
})
```

### PredictionRow type extension
```typescript
// Source: follows src/lib/supabase/types.ts pattern — add to existing file

export interface PredictionRow {
  id: string
  member_id: string
  fixture_id: string
  home_score: number
  away_score: number
  submitted_at: string
  updated_at: string
}

export interface PredictionWithMember extends PredictionRow {
  member: Pick<MemberRow, 'id' | 'display_name'>
}
```

### Gameweek page — loading existing predictions
```typescript
// Source: follows gameweeks/[gwNumber]/page.tsx pattern

// After fetching fixtures, fetch current member's predictions for this gameweek
const { data: memberData } = await supabase
  .from('members')
  .select('id')
  .eq('user_id', user.id)
  .single()

const fixtureIds = fixtures.map(f => f.id)

const { data: existingPredictions } = await supabase
  .from('predictions')
  .select('fixture_id, home_score, away_score')
  .eq('member_id', memberData.id)
  .in('fixture_id', fixtureIds)

// Map to lookup: { [fixture_id]: { home_score, away_score } }
const predictionMap = Object.fromEntries(
  (existingPredictions ?? []).map(p => [p.fixture_id, p])
)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Server Components with page-level forms | Server Actions + client form state | Next.js 13+ App Router | Form can manage local state while server handles persistence |
| RLS on gameweek status | RLS on per-fixture kickoff_time | CONTEXT.md decision | Simpler, more granular, real-time visibility |
| Separate admin prediction route | George uses same member page | CONTEXT.md decision | Less code duplication, George sees exactly what members see |

---

## Open Questions

1. **Submission counter distinct member count**
   - What we know: Need `COUNT(DISTINCT member_id)` across predictions for a gameweek's fixture IDs
   - What's unclear: Whether Supabase JS client supports `COUNT(DISTINCT ...)` natively or requires an RPC
   - Recommendation: Use a Postgres function `get_gameweek_submission_count(gameweek_id uuid)` returning `{ submitted int, total int }` — clean, testable, reusable in Phase 4

2. **Admin sidebar "My Predictions" label**
   - What we know: CONTEXT.md says the tab is repurposed (Claude's discretion)
   - What's unclear: Whether to redirect to member gameweek page, show a read-only admin summary, or remove the nav item
   - Recommendation: Relabel to "All Predictions" and replace the placeholder page with the admin predictions table. Remove the confusing "My Predictions" framing entirely.

3. **Predictions for fixtures in future gameweeks**
   - What we know: Members predict for a specific gameweek. The member page shows one GW at a time via `[gwNumber]` route param.
   - What's unclear: Whether members can predict gameweeks other than the "current" one
   - Recommendation: Allow — the nav already lets members browse all gameweeks. If fixtures are SCHEDULED/TIMED and not past kickoff, `canSubmitPrediction()` will return true. No artificial restriction needed.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run tests/actions/predictions.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PRED-01 | submitPredictions saves entries for un-kicked-off fixtures | unit | `npx vitest run tests/actions/predictions.test.ts` | Wave 0 |
| PRED-02 | submitPredictions upserts when prediction already exists | unit | `npx vitest run tests/actions/predictions.test.ts` | Wave 0 |
| PRED-03 | canSubmitPrediction returns false after kickoff (already tested in Phase 2) | unit | `npx vitest run tests/actions/predictions.test.ts` | Wave 0 |
| PRED-04 | Admin client bypasses RLS — integration via admin service client | unit | `npx vitest run tests/actions/predictions.test.ts` | Wave 0 |
| PRED-05 | submitPredictions skips kicked-off fixtures without error, saves the rest | unit | `npx vitest run tests/actions/predictions.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/actions/predictions.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/actions/predictions.test.ts` — covers PRED-01 through PRED-05 (stubs on Wave 0, implemented as tests complete)
- [ ] `tests/lib/predictions.test.ts` — unit tests for `predictionEntrySchema` validation (score range, UUID format)

*(Existing `tests/setup.ts` infrastructure covers all mocking needs — no framework changes required)*

---

## Sources

### Primary (HIGH confidence)
- Codebase: `src/actions/admin/fixtures.ts` — server action pattern to replicate
- Codebase: `src/lib/fixtures/lockout.ts` — lockout utility, ready to use
- Codebase: `supabase/migrations/002_fixture_layer.sql` — RLS template and policy patterns
- Codebase: `src/components/fixtures/fixture-card.tsx` — injection point for prediction inputs
- Codebase: `src/app/(member)/gameweeks/[gwNumber]/page.tsx` — page to extend
- Codebase: `src/lib/supabase/types.ts` — types to extend
- Codebase: `tests/setup.ts` — mock infrastructure to reuse

### Secondary (MEDIUM confidence)
- Next.js 15 docs: Server Actions with client forms — `useActionState` / direct action prop pattern
- Supabase RLS docs: Per-row policies using `auth.uid()` and subqueries against related tables

### Tertiary (LOW confidence)
- None — all critical claims are verified against existing codebase

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and in use
- Architecture: HIGH — verified against existing working patterns in codebase
- RLS policies: HIGH — template already written in 002_fixture_layer.sql, patterns proven in Phases 1 and 2
- Pitfalls: HIGH — derived from reading actual code, not hypothetical
- Test infrastructure: HIGH — vitest.config.ts and tests/setup.ts confirmed working

**Research date:** 2026-04-11
**Valid until:** Stable — no fast-moving dependencies; all stack choices locked
