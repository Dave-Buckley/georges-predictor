# Phase 5: Admin Panel - Research

**Researched:** 2026-04-12
**Domain:** Admin dashboard expansion — bonus management, Double Bubble, gameweek closing, additional prizes, audit trail
**Confidence:** HIGH (all decisions locked in CONTEXT.md; codebase is readable and patterns are well-established)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Bonus Setup Flow**
- Bonus rotation pre-populated from fixed schedule (14 named types cycling across 38 GWs)
- System auto-seeds full season schedule; George confirms each week before it goes live
- Bonus visible to members immediately once confirmed
- Changing a confirmed bonus shows warning with member pick count; existing picks cleared and members notified
- George can add new custom bonus types beyond the 14 predefined ones
- Dashboard + email reminder if GW approaching and bonus not yet confirmed
- Bonus management accessible from TWO entry points: Bonuses sidebar page AND individual GW detail page

**Bonus Rotation Management**
- Bonuses sidebar page shows full season view — all 38 GWs with assigned bonus type
- George can edit any assignment from this page
- Rotation auto-seeded from defined schedule at season start
- George can create new bonus types with name and description

**Double Bubble**
- GW10, GW20, GW30 pre-toggled on by default
- George can toggle Double Bubble on or off for ANY gameweek
- Toggle accessible from both the Bonuses page and the gameweek detail page

**Bonus Confirmation After Gameweek**
- Claude's discretion on confirmation UX (bulk table recommended for ~50 members)
- George must confirm/reject bonus awards before a gameweek can be closed

**Gameweek Closing Workflow**
- Closing finalises everything: locks scores + predictions, requires bonus confirmation first, triggers report generation
- Blocked if fixtures haven't finished — show blocking fixtures, offer to void them
- George can reopen closed GW with confirmation dialog
- Close button accessible from TWO entry points: GW detail page AND dashboard action card
- Full pre-close summary: total fixtures, all results, bonus awards confirmed, total points, warnings
- Dashboard + email notification when all fixtures in a GW finish (toggleable)

**Additional Prizes**
- 13 predefined milestone prizes auto-seeded (with names, emoji, trigger conditions, cash values £10-£20)
- System auto-detects triggers for detectable prizes
- Date-based prizes auto-snapshot standings at midnight on relevant date
- George notified (dashboard + email) when prize triggered, then confirms to award
- George can edit auto-detected result before confirming
- George can add NEW custom prizes mid-season
- Prize list visible to members but winners hidden until George confirms
- Prizes carry points and/or cash values

**Member-Facing Bonus Info**
- Active bonus shown on GW prediction page (read-only; Phase 6 adds pick interaction)
- Dedicated bonus info page showing all bonus types, their rules, and GW assignments
- Bonus pick UX: Claude's discretion

**Dashboard Expansion**
- Stays as one scrollable page (no tabs)
- New action cards: set bonus, confirm bonus awards, close gameweek, review prize triggers
- Gameweek lifecycle display: Claude's discretion

**Admin Settings**
- Email notification toggles: bonus reminders, gameweek completion alerts, prize trigger alerts
- Additional settings: Claude's discretion

**Admin Audit Trail**
- Claude's discretion on scope and presentation
- Must extend existing audit log pattern from Phase 4 result_overrides

### Claude's Discretion
- Bonus confirmation UX for ~50 members (bulk table, auto-suggest, etc.)
- Bonus pick UX for members (inline on fixture cards vs separate step)
- Dashboard gameweek lifecycle display format
- Audit trail scope and presentation
- Admin settings page additions beyond email toggles
- Pre-close summary layout and design
- Bonus info page design for members

### Deferred Ideas (OUT OF SCOPE)
- Bonus point calculation engine and member bonus pick submission — Phase 6
- H2H Steal detection and resolution — Phase 8
- Last One Standing tracking — Phase 8
- Pre-season predictions — Phase 9
- Weekly PDF/XLSX reports — Phase 10
- Historical backfill of past gameweeks — not planned
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ADMIN-02 | George can set the active bonus for each gameweek before it starts | bonus_types + bonus_schedule tables; setBonusForGameweek server action; GW detail page integration |
| ADMIN-03 | George can confirm or reject bonus point awards after gameweek | bonus_awards table with status column; confirmBonusAward / rejectBonusAward actions; bulk review UI |
| ADMIN-04 | George can override match results and trigger score recalculation | Already exists (applyResultOverride in scoring.ts) — this requirement is already met by Phase 4 |
| ADMIN-05 | George can toggle Double Bubble for specific gameweeks | gameweeks table needs double_bubble boolean; toggleDoubleBubble server action; accessible from Bonuses page and GW detail |
| ADMIN-07 | Additional prizes tracked and surfaced — only applied when George confirms | additional_prizes + prize_triggers tables; auto-detection logic; confirmPrize server action |
| ADMIN-08 | George can import mid-season data — Phase 7, NOT this phase | Out of scope for Phase 5 |
| ADMIN-09 | George can close a gameweek manually | gameweeks.status transition to 'closed'; closeGameweek server action with pre-close validation and summary |
</phase_requirements>

---

## Summary

Phase 5 adds the operational layer George needs to run each week's competition lifecycle. The codebase from Phases 1–4 is mature and well-patterned, so this phase is primarily additive: new database tables for bonus management and prizes, new server actions following the established `requireAdmin()` + `createAdminClient()` + audit log pattern, new UI pages and dialog components following the Radix UI Dialog pattern, and dashboard expansion with new action cards.

The key insight is that ADMIN-04 (result override) is **already complete** from Phase 4. The `applyResultOverride` action in `src/actions/admin/scoring.ts` fully satisfies that requirement. Phase 5 work for it is zero.

The biggest design decision is the **gameweek status model**. Currently `gameweeks.status` is `'scheduled' | 'active' | 'complete'`. This phase needs to extend that to include a `'closed'` state (George explicitly closed it) or alternatively treat 'complete' as the closed state and add a `closed_at` timestamp. Given the CONTEXT.md requirement that George can close AND reopen, a separate `closed_by` / `closed_at` pattern on the gameweeks table is cleaner than a new status enum value.

The second major design decision is the **notification system extension**. The `admin_notifications` table currently constrains `type` to a fixed CHECK list. Phase 5 needs bonus_reminder, gw_complete, prize_triggered notification types — the migration must ALTER that constraint.

**Primary recommendation:** Build in dependency order: (1) migration 005 with all new tables, (2) server actions, (3) Bonuses page, (4) GW detail additions, (5) dashboard new action cards, (6) Settings email toggles, (7) member bonus info page (read-only).

---

## Standard Stack

### Core (already installed — no new packages needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 16.2.3 | Server actions, pages, routing | Already in use |
| Supabase JS | ^2.103.0 | DB queries, RLS | Already in use |
| @supabase/ssr | ^0.10.2 | Server-side Supabase client | Already in use |
| Zod | ^4.3.6 | Server-side validation of action inputs | Already in use — note: .issues[] not .errors[] |
| Radix UI Dialog | ^1.1.15 | Confirmation dialogs | Already in use (ResultOverrideDialog pattern) |
| Radix UI Select | ^2.2.6 | Bonus type dropdowns | Already in use |
| Lucide React | ^1.8.0 | Icons | Already in use |
| react-hook-form | ^7.72.1 | Form handling | Already in use |
| Resend + react-email | ^6.10.0 / ^5.2.10 | Email notifications | Already in use |
| Vitest + jsdom | ^4.1.4 | Unit tests | Already in use |

**No new packages required for Phase 5.**

---

## Architecture Patterns

### Established Patterns to Follow

**1. Server Actions (mutations)**
Every admin mutation follows the same shape:
```typescript
// Source: src/actions/admin/scoring.ts (existing pattern)
'use server'

async function requireAdmin(): Promise<{ userId: string } | { error: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user || user.app_metadata?.role !== 'admin') {
    return { error: 'Unauthorized — admin access required' }
  }
  return { userId: user.id }
}

export async function setBonusForGameweek(formData: FormData) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth
  // ... validate with Zod, then createAdminClient() for DB writes
  // ... insert audit record
  // ... create admin_notification
  // ... revalidatePath()
  return { success: true }
}
```

**2. Radix UI Dialog — 3-step pattern**
```typescript
// Source: src/components/admin/result-override-dialog.tsx (existing pattern)
type Step = 'entry' | 'confirm' | 'success'
// entry: collect input
// confirm: show impact summary + warning
// success: done state with close/reload
```
Use this pattern for: setBonusDialog, confirmBonusAwardDialog, closeGameweekDialog, confirmPrizeDialog.

**3. Admin page data fetching**
```typescript
// Source: src/app/(admin)/admin/page.tsx (existing pattern)
export const dynamic = 'force-dynamic'

async function getPageData() {
  const supabase = createAdminClient()
  // parallel queries with Promise.all
  return { ... }
}

export default async function AdminPage() {
  const data = await getPageData()
  // ...
}
```

**4. Audit log pattern**
```typescript
// Source: src/actions/admin/scoring.ts — result_overrides table
// Every significant admin action inserts a row to an audit table
// Columns: id, changed_by (auth.users ref), created_at, plus action-specific fields
```
Phase 5 extends this with an `admin_audit_log` table for bonus + prize + GW close actions, or individual audit tables per action type (consistent with existing result_overrides pattern — separate tables per action type is simpler and already established).

**5. Zod validation**
```typescript
// Source: src/lib/validators/scoring.ts — overrideResultSchema
// All form inputs validated with Zod in server actions
// Note: Zod v4 uses .issues[] not .errors[]
// Note: z.coerce.number() for form string->number coercion
```

### Recommended New Directory Structure
```
src/
├── actions/admin/
│   ├── scoring.ts          # existing — ADMIN-04 already complete
│   ├── bonuses.ts          # NEW — ADMIN-02, ADMIN-03, ADMIN-05
│   ├── gameweeks.ts        # NEW — ADMIN-09 (close/reopen GW)
│   └── prizes.ts           # NEW — ADMIN-07
├── app/(admin)/admin/
│   ├── page.tsx            # EXTEND — new action cards
│   ├── bonuses/
│   │   └── page.tsx        # NEW — full season bonus rotation view
│   ├── gameweeks/[gwNumber]/
│   │   └── page.tsx        # EXTEND — bonus setter + close GW button
│   └── settings/
│       └── page.tsx        # EXTEND — email notification toggles
├── app/(member)/
│   └── bonuses/
│       └── page.tsx        # NEW — member bonus info page (read-only)
├── components/admin/
│   ├── set-bonus-dialog.tsx        # NEW — Radix 3-step
│   ├── confirm-bonus-awards.tsx    # NEW — bulk table UI
│   ├── close-gameweek-dialog.tsx   # NEW — pre-close summary + confirm
│   └── confirm-prize-dialog.tsx    # NEW — prize award confirmation
└── lib/
    ├── validators/
    │   ├── bonuses.ts       # NEW — Zod schemas for bonus actions
    │   └── prizes.ts        # NEW — Zod schemas for prize actions
    └── supabase/
        └── types.ts         # EXTEND — new row types for new tables
```

### Anti-Patterns to Avoid
- **Don't implement bonus point calculation** — that's Phase 6. Phase 5 only sets up the admin controls and data structures.
- **Don't generate client-side UUIDs** — established decision from Phase 2; always query DB after insert.
- **Don't use session client for admin writes** — always use `createAdminClient()` for mutations that bypass RLS.
- **Don't auto-apply bonuses or prizes** — locked decision: everything requires George's explicit confirmation.
- **Don't poll for GW completion in the browser** — server-side detection on sync; notification on dashboard.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email sending | Custom SMTP | Resend (already installed) | Zero-config, free tier, already integrated |
| Email templates | String concatenation | react-email (already installed) | Type-safe, already integrated |
| Form dialogs | Custom modal CSS | Radix UI Dialog (already installed) | Accessibility, focus trapping, already used in result-override |
| Dropdown selects | Custom select | Radix UI Select (already installed) | Accessibility, already in use |
| Date-based prize snapshots | Complex cron | Supabase pg_cron or Vercel cron route | Already on free tier, simpler than alternatives |
| Seeding 14 bonus types + 13 prizes | Manual insert UI | SQL seed in migration 005 | One-time data, deterministic, auditable |

---

## Common Pitfalls

### Pitfall 1: admin_notifications type CHECK constraint
**What goes wrong:** Inserting a bonus_reminder or prize_triggered notification fails with a Postgres CHECK violation because the existing `admin_notifications.type` column only allows `('new_signup', 'approval_needed', 'system')`.
**Why it happens:** The CHECK constraint was defined in migration 001 and hasn't been extended.
**How to avoid:** Migration 005 must ALTER TABLE admin_notifications to extend the CHECK constraint to include all new notification types: `bonus_reminder`, `gw_complete`, `prize_triggered`, `bonus_award_needed`.
**Warning signs:** Notification inserts silently succeed in local dev if the constraint isn't enforced, but fail in production.

### Pitfall 2: gameweeks.status doesn't support 'closed' state
**What goes wrong:** Trying to store GW close state using the existing status enum fails — the CHECK constraint only allows `'scheduled' | 'active' | 'complete'`.
**Why it happens:** Phase 2 defined status for fixture-sync purposes, not for the admin lifecycle.
**How to avoid:** Migration 005 must add `closed_at timestamptz` and `closed_by uuid` columns to gameweeks, keeping the existing status enum unchanged. Use `closed_at IS NOT NULL` to check if a GW is closed. This also supports the reopen requirement (set closed_at = NULL).

### Pitfall 3: Bonus types table needs seed data before GW assignments
**What goes wrong:** The bonus_schedule table can't be seeded with GW assignments until bonus_types rows exist to reference.
**Why it happens:** Foreign key dependency.
**How to avoid:** In migration 005, seed bonus_types rows first, then seed bonus_schedule rows in a single transaction. Use `INSERT ... ON CONFLICT DO NOTHING` for idempotency.

### Pitfall 4: Double Bubble interacts with bonus_schedule
**What goes wrong:** Double Bubble is conceptually a bonus modifier, not a bonus type. Modelling it as a bonus type creates ambiguity (can a GW have both a bonus type AND Double Bubble?).
**Why it happens:** The CONTEXT.md says "Toggle accessible from both Bonuses page and GW detail page" — it's a separate feature.
**How to avoid:** Add `double_bubble boolean NOT NULL DEFAULT false` directly to the `gameweeks` table. It's independent of the bonus schedule. GW10/20/30 default to true in the seed.

### Pitfall 5: Pre-close summary requires all fixture results to be present
**What goes wrong:** Closing a GW when some fixtures haven't been scored leaves prediction_scores rows missing, making point totals incorrect.
**Why it happens:** The close action runs before sync has processed all results.
**How to avoid:** The `closeGameweek` server action must query: count of FINISHED fixtures vs total fixtures in the GW. If any fixture is non-FINISHED (excluding CANCELLED/POSTPONED that have been voided), block the close and surface which fixtures are blocking. Show them in the pre-close summary.

### Pitfall 6: Date-based prize snapshots require server-side cron, not client triggers
**What goes wrong:** Building date-based prize detection into client-side code means it only fires when someone visits the page.
**Why it happens:** Next.js pages are request-driven.
**How to avoid:** Use a Vercel cron route (`/api/check-date-prizes`) scheduled daily at midnight UTC. The route checks if today matches any prize trigger date and creates a notification if so. George then confirms. This is consistent with the existing `/api/sync-fixtures` pattern.

### Pitfall 7: Bulk bonus confirmation UX needs pagination for ~50 members
**What goes wrong:** Rendering all 50 member bonus awards in a single table loads slowly and is hard to scan.
**Why it happens:** 50 members × bonus details = significant DOM.
**How to avoid:** Use a simple scrollable table sorted by member name with bulk "Approve All" and individual per-row approve/reject. No pagination needed at 50 members — it's within reasonable scroll range. Include a filter for "unreviewed only".

---

## Database Design (Migration 005)

This is the core of Phase 5. All new tables follow the established patterns from migrations 001-004.

### New Tables

**bonus_types** — the 14 predefined + custom bonus definitions
```sql
CREATE TABLE public.bonus_types (
  id           uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text  NOT NULL,
  description  text  NOT NULL,
  is_custom    boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);
-- Seed: 14 predefined bonus types as part of migration
```

**bonus_schedule** — one row per gameweek, which bonus type is assigned
```sql
CREATE TABLE public.bonus_schedule (
  id             uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  gameweek_id    uuid  NOT NULL REFERENCES public.gameweeks(id) ON DELETE CASCADE,
  bonus_type_id  uuid  NOT NULL REFERENCES public.bonus_types(id),
  confirmed      boolean NOT NULL DEFAULT false,
  confirmed_at   timestamptz,
  confirmed_by   uuid REFERENCES auth.users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gameweek_id)
);
```

**bonus_awards** — per-member bonus award tracking for a gameweek (populated by Phase 6 logic, reviewed here)
```sql
CREATE TABLE public.bonus_awards (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gameweek_id    uuid NOT NULL REFERENCES public.gameweeks(id) ON DELETE CASCADE,
  member_id      uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  bonus_type_id  uuid NOT NULL REFERENCES public.bonus_types(id),
  awarded        boolean,  -- NULL=pending, true=confirmed, false=rejected
  confirmed_by   uuid REFERENCES auth.users(id),
  confirmed_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gameweek_id, member_id)
);
```

**additional_prizes** — the 13 predefined + custom prize definitions
```sql
CREATE TABLE public.additional_prizes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  emoji           text,
  description     text NOT NULL,
  trigger_type    text NOT NULL CHECK (trigger_type IN ('auto', 'date', 'manual')),
  trigger_config  jsonb,  -- stores trigger condition metadata
  points_value    int NOT NULL DEFAULT 0,
  cash_value      int NOT NULL DEFAULT 0,  -- in pence (£10 = 1000)
  is_custom       boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);
-- Seed: 13 predefined prizes
```

**prize_awards** — when a prize is triggered and whether George has confirmed it
```sql
CREATE TABLE public.prize_awards (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prize_id        uuid NOT NULL REFERENCES public.additional_prizes(id),
  member_id       uuid REFERENCES public.members(id),  -- NULL for group prizes
  gameweek_id     uuid REFERENCES public.gameweeks(id),
  triggered_at    timestamptz NOT NULL DEFAULT now(),
  snapshot_data   jsonb,  -- standings snapshot for date-based prizes
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  confirmed_by    uuid REFERENCES auth.users(id),
  confirmed_at    timestamptz,
  notes           text  -- George's editable notes/corrections
);
```

**admin_settings** — toggleable notification preferences
```sql
CREATE TABLE public.admin_settings (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id            uuid NOT NULL UNIQUE REFERENCES auth.users(id),
  email_bonus_reminders    boolean NOT NULL DEFAULT true,
  email_gw_complete        boolean NOT NULL DEFAULT true,
  email_prize_triggered    boolean NOT NULL DEFAULT true,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);
```

### Modifications to Existing Tables

**gameweeks** — add Double Bubble + close state
```sql
ALTER TABLE public.gameweeks
  ADD COLUMN IF NOT EXISTS double_bubble boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by uuid REFERENCES auth.users(id);
```

**admin_notifications** — extend type CHECK constraint
```sql
ALTER TABLE public.admin_notifications
  DROP CONSTRAINT IF EXISTS admin_notifications_type_check;
ALTER TABLE public.admin_notifications
  ADD CONSTRAINT admin_notifications_type_check
    CHECK (type IN (
      'new_signup', 'approval_needed', 'system',
      'sync_failure', 'fixture_rescheduled', 'fixture_moved',
      'result_override', 'scoring_complete',
      'bonus_reminder', 'gw_complete', 'prize_triggered', 'bonus_award_needed'
    ));
```

---

## Code Examples

### setBonusForGameweek action pattern
```typescript
// Source: following src/actions/admin/scoring.ts pattern
export async function setBonusForGameweek(
  formData: FormData
): Promise<{ success: true } | { error: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const parsed = setBonusSchema.safeParse({
    gameweek_id: formData.get('gameweek_id'),
    bonus_type_id: formData.get('bonus_type_id'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const adminClient = createAdminClient()

  // Check if members have already picked for this GW — if so, warn + clear
  const { count: existingPickCount } = await adminClient
    .from('bonus_awards')
    .select('id', { count: 'exact', head: true })
    .eq('gameweek_id', parsed.data.gameweek_id)

  // Upsert the bonus schedule
  await adminClient.from('bonus_schedule').upsert({
    gameweek_id: parsed.data.gameweek_id,
    bonus_type_id: parsed.data.bonus_type_id,
    confirmed: true,
    confirmed_at: new Date().toISOString(),
    confirmed_by: auth.userId,
  }, { onConflict: 'gameweek_id' })

  // If picks existed, clear them and notify members (Phase 6 will add member picks)

  revalidatePath('/admin/bonuses')
  revalidatePath('/admin/gameweeks')
  return { success: true }
}
```

### closeGameweek action with pre-close validation
```typescript
export async function getCloseGameweekSummary(
  gameweekId: string
): Promise<CloseGameweekSummary | { error: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const adminClient = createAdminClient()

  // Get all fixtures
  const { data: fixtures } = await adminClient
    .from('fixtures')
    .select('id, status, home_team:teams!home_team_id(name), away_team:teams!away_team_id(name)')
    .eq('gameweek_id', gameweekId)

  const blockingFixtures = fixtures?.filter(
    f => !['FINISHED', 'CANCELLED', 'POSTPONED'].includes(f.status)
  ) ?? []

  // Check bonus awards confirmed
  const { data: pendingAwards } = await adminClient
    .from('bonus_awards')
    .select('id')
    .eq('gameweek_id', gameweekId)
    .is('awarded', null)

  return {
    totalFixtures: fixtures?.length ?? 0,
    blockingFixtures,
    pendingBonusAwards: pendingAwards?.length ?? 0,
    canClose: blockingFixtures.length === 0 && (pendingAwards?.length ?? 0) === 0,
  }
}
```

### toggleDoubleBubble action
```typescript
export async function toggleDoubleBubble(
  gameweekId: string,
  enabled: boolean
): Promise<{ success: true } | { error: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  await createAdminClient()
    .from('gameweeks')
    .update({ double_bubble: enabled })
    .eq('id', gameweekId)

  revalidatePath('/admin/bonuses')
  revalidatePath(`/admin/gameweeks/${gameweekId}`)
  return { success: true }
}
```

### Bulk bonus confirmation UI approach
For ~50 members, use a scrollable table rendered server-side with form actions per row:
- Sort by member display_name
- Show: member name | their bonus pick game | condition met? | approve/reject buttons
- Add "Approve All Eligible" bulk action at top
- Filter toggle: "Show unreviewed only"
- No client-side state needed — each button submits a server action

### Dashboard action card pattern
```tsx
// Following existing dashboard pattern from src/app/(admin)/admin/page.tsx
{bonusNotConfirmed ? (
  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-center justify-between">
    <div>
      <p className="font-semibold text-amber-900">GW{activeGW} bonus not set</p>
      <p className="text-amber-700 text-sm mt-0.5">Set the bonus before the gameweek opens.</p>
    </div>
    <Link href={`/admin/gameweeks/${activeGW}`} className="px-4 py-2 bg-amber-600 ...">
      Set Bonus
    </Link>
  </div>
) : null}
```

---

## State of the Art

| Old Approach | Current Approach | Impact on Phase 5 |
|--------------|------------------|-------------------|
| Manually managing admin_notifications type CHECK | Alter constraint in migration | Migration 005 must alter the existing CHECK |
| GameweekStatus enum only had 3 values | Add closed_at + closed_by columns instead of new enum value | Simpler than enum change, supports reopen |
| No bonus infrastructure | New tables: bonus_types, bonus_schedule, bonus_awards | Foundation for Phase 6 to build on |

**Important existing decisions that affect Phase 5:**
- `admin_notifications.type` CHECK is defined inline in migration 001 — must ALTER not recreate
- `gameweeks.status` type was typed as `'scheduled' | 'active' | 'complete'` in `src/lib/supabase/types.ts` — `GameweekStatus` type needs extending if any new status values are added
- `createAdminClient()` is the bypass client — every admin write uses this, never the session client
- Zod v4 `.issues[]` not `.errors[]` — apply to all new validators

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.4 + jsdom |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run tests/actions/admin/bonuses.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ADMIN-02 | setBonusForGameweek validates input + upserts | unit | `npx vitest run tests/actions/admin/bonuses.test.ts` | Wave 0 |
| ADMIN-02 | setBonusForGameweek rejects non-admin | unit | `npx vitest run tests/actions/admin/bonuses.test.ts` | Wave 0 |
| ADMIN-03 | confirmBonusAward updates status | unit | `npx vitest run tests/actions/admin/bonuses.test.ts` | Wave 0 |
| ADMIN-05 | toggleDoubleBubble updates gameweek | unit | `npx vitest run tests/actions/admin/bonuses.test.ts` | Wave 0 |
| ADMIN-07 | confirmPrize updates prize_awards status | unit | `npx vitest run tests/actions/admin/prizes.test.ts` | Wave 0 |
| ADMIN-09 | closeGameweek blocked if fixtures not finished | unit | `npx vitest run tests/actions/admin/gameweeks.test.ts` | Wave 0 |
| ADMIN-09 | closeGameweek blocked if pending bonus awards | unit | `npx vitest run tests/actions/admin/gameweeks.test.ts` | Wave 0 |
| ADMIN-09 | closeGameweek sets closed_at on gameweek | unit | `npx vitest run tests/actions/admin/gameweeks.test.ts` | Wave 0 |
| ADMIN-04 | Already complete in Phase 4 | — | `npx vitest run tests/actions/admin/scoring.test.ts` | Exists |

### Sampling Rate
- **Per task commit:** Run the test file relevant to the changed action
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/actions/admin/bonuses.test.ts` — covers ADMIN-02, ADMIN-03, ADMIN-05
- [ ] `tests/actions/admin/prizes.test.ts` — covers ADMIN-07
- [ ] `tests/actions/admin/gameweeks.test.ts` — covers ADMIN-09

*(Existing `tests/actions/admin/scoring.test.ts` covers ADMIN-04 — no gap there)*

---

## Open Questions

1. **Prize cash value currency storage**
   - What we know: Context says £10-£20 cash values
   - What's unclear: Store as pence (integer) or decimal? Display format?
   - Recommendation: Store as integer pence (1000 = £10) following standard money storage — avoids floating point. Display as `£${value/100}`.

2. **Date-based prize cron trigger**
   - What we know: Christmas, Halloween, Easter, Valentine's need midnight snapshots
   - What's unclear: Vercel Hobby plan supports one cron job; current cron is used for fixture sync
   - Recommendation: Add a separate `/api/check-date-prizes` route invoked by a Vercel cron expression. Check if Vercel Hobby now supports multiple cron jobs (it does as of 2023 — up to 2 on Hobby). If limit is hit, combine the date-prize check into the existing sync cron route.

3. **Bonus awards before Phase 6**
   - What we know: ADMIN-03 requires George to confirm/reject bonus awards; Phase 6 adds member pick submission
   - What's unclear: The bonus_awards table will be empty until Phase 6 exists
   - Recommendation: Build the ADMIN-03 UI and action fully — it will simply show an empty state "No bonus awards pending" until Phase 6 populates the table. The action and UI are ready; they just have no data yet.

4. **Bonus schedule seeding — which season?**
   - What we know: Rotation auto-seeds for 38 GWs from defined schedule
   - What's unclear: Season year (2024/25 or 2025/26?) and whether gameweeks table has all 38 rows yet
   - Recommendation: Migration 005 seeds bonus_schedule rows by joining on gameweeks.number (1-38). If some gameweek rows don't exist yet (mid-season start), seed with ON CONFLICT DO NOTHING and surface a count of unseeded GWs on the Bonuses page.

---

## Sources

### Primary (HIGH confidence)
- Existing codebase (`src/actions/admin/scoring.ts`) — requireAdmin pattern, audit log pattern, notification insert pattern
- Existing codebase (`src/components/admin/result-override-dialog.tsx`) — 3-step Dialog pattern with impact preview
- Existing codebase (`supabase/migrations/001-004`) — exact table structure, CHECK constraints, RLS policies, foreign key patterns
- Existing codebase (`src/lib/supabase/types.ts`) — exact TypeScript row types and current GameweekStatus union
- Existing codebase (`package.json`) — exact library versions in use

### Secondary (MEDIUM confidence)
- CONTEXT.md (`05-CONTEXT.md`) — all locked decisions and specific data (14 bonus types, 13 prize names, GW assignments)

### Tertiary (LOW confidence — not needed, all findings from codebase)
- N/A — no external research required for this phase; all patterns are established in the existing codebase

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — reads directly from package.json
- Database design: HIGH — derived from existing migration patterns and CONTEXT.md locked decisions
- Architecture patterns: HIGH — read directly from existing server actions and components
- Pitfalls: HIGH — derived from established decisions in STATE.md + migration constraints in SQL files
- Validation architecture: HIGH — test framework already configured in vitest.config.ts

**Research date:** 2026-04-12
**Valid until:** Stable — no fast-moving external dependencies; all findings from the local codebase
