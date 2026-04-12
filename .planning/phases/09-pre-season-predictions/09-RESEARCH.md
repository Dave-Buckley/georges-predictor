# Phase 9: Pre-Season Predictions - Research

**Researched:** 2026-04-12
**Domain:** Seasonal prediction submission + lockout + end-of-season scoring confirmation (Next.js 16 App Router + Supabase RLS)
**Confidence:** HIGH

## Summary

Phase 9 ships the full pre-season predictions feature: a member submission form (only active before GW1 of a future season), a read-only view for the current season (picks already imported via Phase 7), server-side lockout on GW1 kickoff, an admin late-joiner entry flow, end-of-season calculation, George-confirmation of awards, and inclusion in the export.

Every architectural lever this phase needs already exists in the codebase. The `pre_season_picks` table is live (migration 007). The `handle_new_user` trigger already links imported placeholder rows. Phase 2 established server-side timestamp lockout. Phase 6 established two-phase confirmation (member → George). Phase 5 established admin notifications with per-migration CHECK-constraint extension. Phase 8 showed how to reuse `requireAdmin` + `createAdminClient` + Zod parse + `revalidatePath` verbatim. The only new DB concepts are a `seasons` table (or equivalent) to hold the GW1 kickoff + season-end actuals, a `pre_season_awards` table to hold confirmed awards, an extended `admin_notifications` CHECK constraint, and optional columns on `pre_season_picks` to track admin-override submissions.

**Primary recommendation:** Ship as a 3-plan phase — (1) schema + pure `calculatePreSeasonPoints` lib + validators + Championship constant, (2) member submission + read-only view + admin late-joiner + lockout wiring, (3) end-of-season confirmation flow + admin dashboard + export hook. Reuse the Phase 6 bonus-confirmation UI pattern for the confirmation flow — no invention needed.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Scoring**
- 30 pts per correct team pick (flat — top 4, 10th, relegated, promoted, playoff winner all score the same)
- No fixed "all correct" bonus formula
- System **detects and flags** to George (via existing admin notification pattern) when a member gets all picks correct in any category (top 4, relegated, promoted) OR all 12 picks overall
- George decides manually what reward (if any) to give — zero-config for the bonus layer, full control for George
- Per-category flags: `all_top4_correct`, `all_relegated_correct`, `all_promoted_correct`, `all_correct_overall`
- Flags shown on the admin confirmation page and emitted as `admin_notifications` entries at season-end calc time

**Late joiners**
- Members who register AFTER pre-season lockout can still have picks, entered by George via the admin panel
- Reuses the admin-can-override-lockout pattern
- No self-submission grace window — consistent with mid-season import / member-addition flows from Phase 7

**Current season (picks already imported)**
- Members see a read-only view of their own pre-season picks (imported via Phase 7 `importPreSeasonPicks`)
- Route: `/pre-season` for members — shows own picks with category sections, team crests/names, lock status banner ("Locked since GW1")
- No editing, no submission button — form only exists for future seasons before GW1

**Championship team list**
- Hardcoded seasonal constant in code (e.g., `CHAMPIONSHIP_TEAMS_2025_26`) — 24 teams
- One file update per season, no admin UI, no schema overhead
- Constant lives alongside existing team data (e.g., `src/lib/teams/championship-2025-26.ts`)
- Next season's constant added by the developer before the new pre-season submission window opens

**Pick validation scope**
- "Top 4" and "10th place" picks: must be from the 20 PL teams (teams table)
- "Relegated" picks: must be from the 20 PL teams (teams table)
- "Promoted" picks and "playoff winner": must be from the hardcoded Championship list
- Enforced server-side in the submission action (reject any pick outside its allowed list)
- Enforced client-side in the picker UI (filter dropdowns to valid sources)

**Lockout**
- Server-side rejection where `current_season.gw1_kickoff < now()` — same pattern as fixture lockout (Phase 2)
- `seasons` table (or env config) holds the GW1 kickoff timestamp per season
- Admin override flag allows George to enter picks after lock for late joiners
- UI shows a "Locked" banner when submission window has closed

**Submission form UX**
- Single page, all 5 categories on one screen (not a wizard)
- Category sections with counters ("Top 4: 0/4 selected")
- Radix Select or searchable dropdown per slot for team picking
- Submit button disabled until all 12 picks are filled
- Mobile-first layout (most members on phone per UI-02)
- Form shows only before lockout for future seasons

**Admin monitoring**
- Dashboard action card: "Pre-season submissions — N/M submitted" with link (appears only when pre-season window is open)
- Full page `/admin/pre-season` shows: every member's picks in a table, "not submitted" list, submission timestamps
- Submission status visible to George at all times (even after lock) for record-keeping

**End-of-season confirmation**
- George's flow mirrors Phase 6 bonus confirmation pattern (per-member review, adjustable amounts, apply)
- Admin page lists every member with: their picks, which were correct (highlighted), calculated 30pts/correct subtotal, any all-correct flags, an editable "final award" field pre-filled with the system calculation, a one-click "Apply all" button plus per-member apply
- Applied awards written to a `pre_season_awards` table with `confirmed_by`, `confirmed_at`
- Awards added to season totals only after confirmation (never auto-applied)

**Export**
- Pre-season picks and awards included in the data export (Phase 10 / RPT-03 / RPT-07 / DATA-04 / PRE-05)
- Format: one row per member per season with all 12 picks + total pre-season points awarded

### Claude's Discretion
- Exact form layout (card vs list style for categories)
- Whether to show an "N of 12 picks complete" progress bar
- Whether correct picks in the admin end-of-season view show crests or just team names
- Copy/microcopy for lock banners, empty states, submission success
- Whether the admin page has a filter for "not submitted" / "all-correct flagged" / "submitted"
- Whether to batch-email members at end-of-season with their pre-season result (coordinate with Phase 10 reports)

### Deferred Ideas (OUT OF SCOPE)
- Self-submission grace window for late joiners (admin-enters-picks is enough for v1)
- Historical pre-season data browsing across multiple seasons (data layer exists via `season` column, but UI = DATA-02 / DATA-03, not this phase)
- Member-facing "how did I do" celebration page at season end with animations — Phase 10 report or v2 social feature
- Batch email of pre-season results — coordinate with Phase 10 reports
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PRE-01 | Members submit pre-season predictions — top 4, 10th place, 3 relegated, 3 promoted + playoff winner | Form on `/pre-season` (member) driven by `submitPreSeasonPicks` server action; Zod `submitPreSeasonPicksSchema` extended from existing `importPreSeasonPicksRowSchema` (src/lib/validators/import.ts). Form uses Radix Select (already in deps: `@radix-ui/react-select ^2.2.6`). |
| PRE-02 | Pre-season predictions locked before GW1 | Server-side check of `seasons.gw1_kickoff < now()` inside `submitPreSeasonPicks` — exact pattern mirrors fixture lockout (Phase 2 `editFixture`). `admin_override` flag allowed only for `setPreSeasonPicksForMember` (admin). UI banner when locked. |
| PRE-03 | Pre-season points calculated at season end — 30pts per correct team, bonuses for all correct | Pure `calculatePreSeasonPoints(picks, actuals)` lib — same idiom as `calculatePoints` / `calculateBonusPoints`. Returns `{ correctByCategory, pointsByCategory, totalPoints, flags: { all_top4_correct, all_relegated_correct, all_promoted_correct, all_correct_overall } }`. 30pts flat per correct; flags emitted but zero implicit bonus points. |
| PRE-04 | George confirms pre-season point awards | `confirmPreSeasonAwards` admin action mirrors Phase 6 `confirmBonusAward` + `bulkConfirmBonus` — writes `pre_season_awards` with `confirmed_by`/`confirmed_at`, optional `override_points` if George edits. Awards only feed season totals once `confirmed=true`. |
| PRE-05 | Pre-season predictions logged in exportable format | Shape exposed via a query helper (`getPreSeasonExportRows`) returning one row per `(member_id, season)` with all 12 picks + awarded points — Phase 10 report/export consumes this directly (RPT-03 / RPT-07 / DATA-04). |
</phase_requirements>

## Standard Stack

### Core (already in project — versions from package.json)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.3 (App Router) | Server actions + RSC pages | Locked project stack |
| React | 19.2.4 | UI | Locked |
| Supabase (`@supabase/ssr`, `@supabase/supabase-js`) | 0.10.2 / 2.103.0 | Auth + DB + RLS | Locked |
| Zod | 4.3.6 | Server-action validation | Already used in every admin action; note `.issues[]` (not `.errors[]`) — Phase 1 decision |
| react-hook-form + @hookform/resolvers | 7.72.1 / 5.2.2 | Client form state | Already used in predictions/auth forms |
| Radix Select | 2.2.6 | Team picker dropdowns | Already used in `SetBonusDialog` — ideal for team picking |
| Radix Dialog | 1.1.15 | Late-joiner admin dialog | Already used for close-gameweek, result-override |
| lucide-react | 1.8.0 | Icons (Crown, Lock, CheckCircle, etc.) | Already used throughout admin/member pages |
| Vitest | 4.1.4 | Tests | Locked |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New `seasons` table | Env var for GW1 kickoff | Env-only means no admin edit; table is cheap and future-proofs DATA-02 season archive |
| Hardcoded Championship constant | `championship_teams` table | Table adds admin UI surface area + RLS for 24 rows once a year; constant is right call (user-locked) |
| New `pre_season_awards` table | Column on `pre_season_picks` | Separate table keeps audit cleanly: picks are member-authored, awards are admin-confirmed — same split as predictions/prediction_scores (Phase 4) |

**Installation:** No new npm dependencies required.

## Architecture Patterns

### Recommended Structure (follows existing conventions)
```
supabase/migrations/
  009_pre_season.sql                      # seasons, pre_season_awards, admin_notifications CHECK extend, optional admin_override cols on pre_season_picks

src/lib/
  teams/
    championship-2025-26.ts               # hardcoded Championship constant + typed helper
  pre-season/
    calculate.ts                          # pure calculatePreSeasonPoints
    actuals.ts                            # (optional) shape of season-end actuals used by calculate
  validators/
    pre-season.ts                         # submitPreSeasonPicksSchema, setPreSeasonPicksForMemberSchema, confirmPreSeasonAwardSchema

src/actions/
  pre-season.ts                           # member: submitPreSeasonPicks
  admin/
    pre-season.ts                         # setPreSeasonPicksForMember, calculatePreSeasonAwards, confirmPreSeasonAwards, bulkConfirm

src/app/(member)/pre-season/
  page.tsx                                # read-only view (current season) OR submission form (future season, window open)
  _components/
    pre-season-form.tsx                   # 5-category picker, 12 slots
    pre-season-read-only.tsx              # current-season locked view

src/app/(admin)/admin/pre-season/
  page.tsx                                # admin monitoring + end-of-season confirmation
  _components/
    admin-pre-season-table.tsx            # all members, submission status, picks
    confirm-pre-season-awards.tsx         # mirrors ConfirmBonusAwards component pattern
    late-joiner-picks-dialog.tsx          # admin sets picks for a member

src/components/admin/sidebar.tsx          # add "Pre-Season" link
src/app/(admin)/admin/dashboard/page.tsx  # add conditional action card
src/app/(member)/layout.tsx               # add /pre-season to member nav

tests/
  lib/
    pre-season-calculate.test.ts          # pure-fn scoring tests (TDD-first)
    championship-teams.test.ts            # smoke test on constant shape
  actions/
    pre-season.test.ts                    # member submit + lockout
  actions/admin/
    pre-season.test.ts                    # late-joiner + confirm + bulk
```

### Pattern 1: Pure calculation library (TDD-first)
**What:** A pure function with zero imports, zero DB access — single source of truth for scoring.
**When to use:** All pre-season scoring must run through this. Matches `calculatePoints` (src/lib/scoring/calculate.ts) and `calculateBonusPoints` (src/lib/scoring/calculate-bonus.ts).

```typescript
// src/lib/pre-season/calculate.ts
export interface PreSeasonPicks {
  top4: string[]            // ordered, 4 PL team names
  tenth_place: string       // PL team name
  relegated: string[]       // 3 PL team names (unordered)
  promoted: string[]        // 3 Championship team names (unordered)
  promoted_playoff_winner: string  // Championship team name
}

export interface PreSeasonActuals {
  final_top4: string[]           // actual top 4 (ordered) at end of season
  final_tenth: string            // team that finished 10th
  final_relegated: string[]      // 3 teams actually relegated
  final_promoted: string[]       // 3 teams actually promoted (2 auto + 1 playoff = 3 total)
  final_playoff_winner: string   // promotion playoff winner
}

export interface PreSeasonFlags {
  all_top4_correct: boolean            // all 4 top-4 teams matched (set equality)
  all_relegated_correct: boolean       // all 3 relegated matched (set equality)
  all_promoted_correct: boolean        // all 3 promoted matched (set equality)
  all_correct_overall: boolean         // all 12 picks correct
}

export interface PreSeasonScore {
  correctByCategory: {
    top4: number             // 0–4
    tenth: 0 | 1
    relegated: number        // 0–3
    promoted: number         // 0–3
    playoff_winner: 0 | 1
  }
  totalPoints: number        // 30 × total correct
  flags: PreSeasonFlags
}

export function calculatePreSeasonPoints(
  picks: PreSeasonPicks,
  actuals: PreSeasonActuals,
): PreSeasonScore {
  // Use lower(trim()) comparison — matches project convention (handle_new_user, teams)
  // Use Set semantics for unordered categories (relegated, promoted, top4 existence-in-set)
  // 30 pts flat per correct team (never tiered, never doubled)
}
```

Tests: `tests/lib/pre-season-calculate.test.ts` — TDD-first. Cover each category, set-equality semantics, case-insensitive matching, flag emission (per-category + all-correct-overall).

### Pattern 2: Server-side lockout with admin override
**What:** Server action rejects submissions after kickoff timestamp, except when `admin_override` is set.
**When to use:** `submitPreSeasonPicks` (member) enforces lockout; `setPreSeasonPicksForMember` (admin) bypasses it.
**Reference:** `src/actions/admin/fixtures.ts` — `editFixture` uses the same `admin_override` FormData pattern.

```typescript
// Inside submitPreSeasonPicks (member)
const { data: season } = await adminClient
  .from('seasons')
  .select('gw1_kickoff')
  .eq('id', seasonId)
  .single()

if (season && new Date(season.gw1_kickoff).getTime() <= Date.now()) {
  return { error: 'Pre-season predictions are locked — GW1 has begun' }
}

// Inside setPreSeasonPicksForMember (admin) — no lockout check (admin override by design)
```

### Pattern 3: Member / admin RLS split
**What:** Session client for members (RLS enforces self-only), admin client for George (bypasses RLS).
**Reference:** Phase 7 (`importMembers` uses admin client because session client is blocked by RLS for `user_id=null` inserts). Phase 8 admin LOS actions.

```typescript
// Member action — session client, RLS filters to own row
const supabase = await createServerSupabaseClient()
await supabase.from('pre_season_picks').upsert({ member_id, season, top4, ... })

// Admin action — admin client, bypasses RLS
const adminClient = createAdminClient()
await adminClient.from('pre_season_picks').upsert({ member_id: targetMemberId, ... })
```

### Pattern 4: Two-phase confirmation (member proposes → George confirms)
**What:** Member submission never directly affects totals; George confirms awards via admin UI; on confirm, `pre_season_awards` row written with `confirmed=true`, `confirmed_by`, `confirmed_at`.
**Reference:** Phase 6 `confirmBonusAward` in `src/actions/admin/bonuses.ts` (bonus_awards tri-state pattern). Phase 5 `prize_awards` confirm flow.

Use tri-state on confirmation status OR simpler: row only exists after George applies. Cleaner to mirror `bonus_awards` pattern — `awarded boolean DEFAULT null` where null=pending, true=confirmed, false=rejected.

### Pattern 5: Admin notifications via CHECK-constraint extension
**What:** Each migration drops and re-adds `admin_notifications_type_check` with all prior types + new types.
**Reference:** Migration 008 lines 121–154. Migration 005 lines 155–180.
**New types to add in migration 009:**
- `'pre_season_all_correct'` — member nailed all 12 picks
- `'pre_season_category_correct'` — member nailed an entire category (top4/relegated/promoted)
- `'pre_season_awards_ready'` — season-end calc ran, George needs to confirm
- `'pre_season_window_closing'` (optional, Claude discretion) — 48h before GW1

### Anti-Patterns to Avoid
- **Don't auto-apply pre-season points to season totals.** Mirror Phase 6 — nothing flows into totals until George confirms. Breaking this breaks the "George in full control" principle locked since PROJECT.md.
- **Don't re-query the `teams` table client-side inside the picker.** Fetch once server-side in the page's loader, pass to client component as prop. Same pattern as `SetBonusDialog existingPickCount` (Phase 5 lesson).
- **Don't build a wizard.** User explicitly locked single-page form — all 5 categories visible at once (mobile-first vertical scroll is fine).
- **Don't store team references as UUIDs in `pre_season_picks`.** Already stored as `text[]` per migration 007; that decision is locked because Championship teams aren't in the `teams` table. Keep the text convention. Use case-insensitive matching (`lower(trim())`) when evaluating against actuals.
- **Don't compute the "N/M submitted" count client-side.** Compute in the RSC loader, pass as prop — matches Phase 5 dashboard action cards pattern.
- **Don't invent a new admin sidebar/nav pattern.** `src/components/admin/sidebar.tsx` is already the list of links; add one entry. Same for member layout.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Searchable team picker | Custom combobox with keyboard nav | Radix Select (already in deps, used by `SetBonusDialog`) | Accessibility + mobile-friendly out of the box |
| Admin auth guard on server actions | New auth helper | Copy `requireAdmin()` inlined in `src/actions/admin/bonuses.ts` and `los.ts` | Drift-free — every Phase 5-8 action uses this exact block |
| Zod validation for pre-season rows | Fresh schema from scratch | Extend `importPreSeasonPicksRowSchema` from `src/lib/validators/import.ts` | Schema shape already covers all 12 fields; just swap the `member_name` text for `member_id` UUID |
| Two-phase confirm UI component | New React component | Mirror `src/components/admin/confirm-bonus-awards.tsx` — it does exactly per-member review + editable amount + bulk apply | User locked "mirror Phase 6 pattern"; zero drift |
| Team name comparison | Case-sensitive `===` | `(a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()` — project convention | Matches `handle_new_user` trigger, `importPreSeasonPicks` action, upstream `importMembers` |
| Admin notification emission | Direct `insert` | Wrap in same `try/catch` used in Phase 8 sync-h2h — if notification insert fails, don't fail the calc | Pattern established in closeGameweek H2H integration (Phase 8 P03) |
| Idempotent upsert | Client-generated keys | `upsert({...}, { onConflict: 'member_id,season' })` on `pre_season_picks` | Matches `importPreSeasonPicks` upsert shape exactly |

## Common Pitfalls

### Pitfall 1: Timezone drift on GW1 kickoff
**What goes wrong:** Member submits at 14:59 UK time, server compares UTC string against local `Date.now()`, offset wrong.
**Why it happens:** Project stores kick-offs as UTC (STATE.md Phase 1 decision) but display uses `date-fns-tz` for Europe/London.
**How to avoid:** Always compare as UTC: `new Date(season.gw1_kickoff).getTime() <= Date.now()`. Never format then parse. Store `seasons.gw1_kickoff` as `timestamptz`. Unit-test with a DST boundary date (late March, late October).
**Warning sign:** Members report form was open when it shouldn't have been — or closed early.

### Pitfall 2: `pre_season_picks` row overwrite on resubmit
**What goes wrong:** Member edits picks → action creates new row → UNIQUE (member_id, season) constraint explodes.
**Why it happens:** Migration 007 already has the UNIQUE constraint; plain INSERT would fail.
**How to avoid:** Use `upsert({...}, { onConflict: 'member_id,season' })` — matches the `importPreSeasonPicks` shape already in the codebase (`src/actions/admin/import.ts` line ~220).

### Pitfall 3: Case-sensitive team name mismatches in calc
**What goes wrong:** User typed "man utd" during submission, season-end actuals say "Manchester United", calc scores 0/12 for everyone.
**Why it happens:** Picks are stored as free text (migration 007 decision) — they're not FKs.
**How to avoid:** (a) Validate submissions against the allowed team lists (20 PL teams + 24 Championship) and store the canonical name, not the user's typed string. Radix Select returns the option value — use canonical names as option values. (b) Calc still uses `lower(trim())` comparison as belt-and-braces (matches `handle_new_user`). Add tests for "Manchester United" vs "manchester united" vs "  Man Utd  ".

### Pitfall 4: `auth.jwt()` role check returning null on fresh RLS policy
**What goes wrong:** Admin policies on new tables (`seasons`, `pre_season_awards`) use `(auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'` but the seed project's config affects this path.
**Why it happens:** Phase 1 note in STATE.md: "RLS admin JWT path may need adjustment per Supabase project settings."
**How to avoid:** Copy the exact policy text from migration 007 line 65 (`pre_season_picks_admin_all`). It already works in production for this project. Don't improvise.

### Pitfall 5: Set-equality vs ordered comparison for top4
**What goes wrong:** Scoring logic compares `picks.top4[0] === actuals.final_top4[0]` position-by-position — member picked right 4 teams in the wrong order and gets 0 pts.
**Why it happens:** Migration 007 comment says "Order matters for tiebreaker scoring" but user locked 30 pts flat per correct team with NO tiered/tiebreaker scoring.
**How to avoid:** For correctness count, use set intersection: `picks.top4.filter(t => actualsSet.has(t)).length`. The comment in the migration was aspirational; the locked scoring rule is flat. Test explicitly with reversed-order picks.
**Note for planner:** Document this as an explicit calc-lib contract in the TDD test. Leave the `top4` array ordered (don't reorder on store) — a future v2 tiered bonus could re-enable order-based scoring.

### Pitfall 6: Seeding all 12 Radix Select options with only 20 PL teams
**What goes wrong:** Promoted picker shows PL teams — member picks "Arsenal" to be promoted.
**Why it happens:** Sharing one team list across all 5 categories.
**How to avoid:** Two sources:
- Top-4, 10th, relegated pickers → `teams` table (PL teams only)
- Promoted + playoff winner pickers → `CHAMPIONSHIP_TEAMS_2025_26` constant
Server-side validation in `submitPreSeasonPicks` also enforces this — don't rely on UI alone.

### Pitfall 7: `admin_notifications` CHECK constraint collision
**What goes wrong:** Migration 009 adds `pre_season_all_correct` type, but Phase 8 types aren't included → CHECK fails on any existing row.
**Why it happens:** The DROP + re-ADD constraint must include every prior type.
**How to avoid:** Copy the full list from migration 008 lines 131–154, append Phase 9 types at the bottom. This is a per-migration ritual — STATE.md notes it for Phase 5 and Phase 8. Don't skip.

### Pitfall 8: `force-dynamic` needed on both routes
**What goes wrong:** `/pre-season` page cached stale submission status after member submits.
**Why it happens:** Next.js 16 App Router defaults may static-render auth'd pages.
**How to avoid:** `export const dynamic = 'force-dynamic'` at top of both `/pre-season` page and `/admin/pre-season` page — project convention established in every admin page (confirmed: bonuses/page.tsx line 13, admin/los/page.tsx line 6, member/los/page.tsx line 8). Call `revalidatePath('/pre-season')` and `revalidatePath('/admin/pre-season')` after mutations.

### Pitfall 9: Submitting while `seasons` table has no row for current season
**What goes wrong:** Member tries to submit → lockout check fails because there's no `seasons` row → action rejects with confusing error.
**Why it happens:** First-deploy edge case — migration creates the table but doesn't seed rows.
**How to avoid:** Migration 009 should `INSERT` the current and next season rows (2025-26, 2026-27) as part of the migration. `seasons` is admin-only data; seeding in migration is safe and matches how `bonus_types` were seeded in migration 005.

### Pitfall 10: Race condition — two admins confirming same award concurrently
**What goes wrong:** George clicks "Apply all" at the same moment Dave clicks "Apply for member X" → double-credit.
**Why it happens:** Both admins have full admin access (AUTH-06).
**How to avoid:** Make `pre_season_awards` keyed `UNIQUE (member_id, season)` + use upsert with `onConflict`. The confirmation action should be idempotent: "set this award to confirmed with these points" — running it twice yields the same final state, not double points. Matches the `bonus_awards` idempotency pattern.

## Code Examples

### Extending the Zod validator
```typescript
// src/lib/validators/pre-season.ts
// Source: src/lib/validators/import.ts (importPreSeasonPicksRowSchema) — extend for member action
import { z } from 'zod'

export const submitPreSeasonPicksSchema = z.object({
  season: z.coerce.number().int().min(2020).max(2030),
  top4: z.array(z.string().min(1)).length(4),
  tenth_place: z.string().min(1),
  relegated: z.array(z.string().min(1)).length(3),
  promoted: z.array(z.string().min(1)).length(3),
  promoted_playoff_winner: z.string().min(1),
})

export const setPreSeasonPicksForMemberSchema = submitPreSeasonPicksSchema.extend({
  member_id: z.string().uuid(),
})

export const confirmPreSeasonAwardSchema = z.object({
  member_id: z.string().uuid(),
  season: z.coerce.number().int(),
  override_points: z.coerce.number().int().min(0).optional(),
})
```

### Admin action pattern (mirrors Phase 8 exactly)
```typescript
// src/actions/admin/pre-season.ts
// Source: src/actions/admin/los.ts (lines 1–37) + src/actions/admin/bonuses.ts (lines 14–28)
'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { setPreSeasonPicksForMemberSchema } from '@/lib/validators/pre-season'

async function requireAdmin(): Promise<{ userId: string } | { error: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user || user.app_metadata?.role !== 'admin') {
    return { error: 'Unauthorized — admin access required' }
  }
  return { userId: user.id }
}

export async function setPreSeasonPicksForMember(formData: FormData) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const parsed = setPreSeasonPicksForMemberSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const adminClient = createAdminClient()
  const { error } = await adminClient.from('pre_season_picks').upsert(
    { ...parsed.data, imported_by: auth.userId, imported_at: new Date().toISOString() },
    { onConflict: 'member_id,season' },
  )
  if (error) return { error: error.message }

  revalidatePath('/admin/pre-season')
  return { success: true as const }
}
```

### Migration 009 skeleton
```sql
-- supabase/migrations/009_pre_season.sql
-- Source: patterns from migrations 005, 007, 008

-- 1. seasons table (single source of truth for GW1 kickoff + season-end actuals)
CREATE TABLE IF NOT EXISTS public.seasons (
  id                         serial PRIMARY KEY,
  season                     int NOT NULL UNIQUE,            -- e.g., 2025 for 2025-26
  label                      text NOT NULL,                  -- "2025-26"
  gw1_kickoff                timestamptz NOT NULL,
  -- Season-end actuals (nullable until George populates at season end)
  final_top4                 text[] DEFAULT '{}',
  final_tenth                text,
  final_relegated            text[] DEFAULT '{}',
  final_promoted             text[] DEFAULT '{}',
  final_playoff_winner       text,
  actuals_locked_at          timestamptz,
  created_at                 timestamptz NOT NULL DEFAULT now()
);

-- 2. pre_season_awards (one row per (member_id, season) after George confirms)
CREATE TABLE IF NOT EXISTS public.pre_season_awards (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id                  uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  season                     int NOT NULL,
  calculated_points          int NOT NULL,                   -- system calc (30 × correct)
  awarded_points             int NOT NULL,                   -- George's final number (may override)
  flags                      jsonb NOT NULL DEFAULT '{}'::jsonb,  -- { all_top4_correct, all_relegated_correct, ... }
  confirmed                  boolean NOT NULL DEFAULT false,
  confirmed_by               uuid REFERENCES auth.users(id),
  confirmed_at               timestamptz,
  UNIQUE (member_id, season)
);

-- 3. Admin override tracking on pre_season_picks (optional — tracks who entered which rows)
ALTER TABLE public.pre_season_picks
  ADD COLUMN IF NOT EXISTS submitted_by_admin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz;

-- 4. RLS (admin-all; members read own for picks, awards visible to own after confirmed)
ALTER TABLE public.seasons             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pre_season_awards   ENABLE ROW LEVEL SECURITY;

CREATE POLICY seasons_admin_all ON public.seasons FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY seasons_member_select ON public.seasons FOR SELECT
  USING (true);  -- everyone can see GW1 kickoff (needed for client-side lockout banner)

CREATE POLICY pre_season_awards_admin_all ON public.pre_season_awards FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY pre_season_awards_member_select_own ON public.pre_season_awards FOR SELECT
  USING (
    confirmed = true AND
    member_id = (SELECT id FROM public.members WHERE user_id = auth.uid() LIMIT 1)
  );

-- 5. admin_notifications CHECK — drop + re-add with Phase 9 types
ALTER TABLE public.admin_notifications DROP CONSTRAINT IF EXISTS admin_notifications_type_check;
ALTER TABLE public.admin_notifications
  ADD CONSTRAINT admin_notifications_type_check
  CHECK (type IN (
    'new_signup','approval_needed','system',
    'sync_failure','fixture_rescheduled','fixture_moved',
    'result_override','scoring_complete',
    'bonus_reminder','gw_complete','prize_triggered','bonus_award_needed',
    'import_complete',
    'los_winner_found','los_competition_started','h2h_steal_detected','h2h_steal_resolved',
    -- Phase 9 additions
    'pre_season_all_correct',
    'pre_season_category_correct',
    'pre_season_awards_ready'
  ));

-- 6. Seed current + next season rows (edit timestamps before deploy)
INSERT INTO public.seasons (season, label, gw1_kickoff)
VALUES
  (2025, '2025-26', '2025-08-15 19:00:00+00'),   -- already passed; current season
  (2026, '2026-27', '2026-08-14 19:00:00+00')    -- TBC; developer updates before next pre-season window
ON CONFLICT (season) DO NOTHING;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client-only form validation | Server action + Zod + RLS | Phase 1 | All submissions re-validated server-side |
| Auto-apply bonuses/prizes | Two-phase (member proposes → George confirms) | Phase 5/6 | Pre-season awards must follow this |
| Single "scoring" function for everything | Pure per-domain libs (`scoring/`, `los/`, `h2h/`) | Phase 4/8 | Pre-season gets its own `src/lib/pre-season/` |
| Hard-coded team lists scattered | Single source of truth (`teams` table or versioned constant) | Phase 2/7 | Championship constant follows same doctrine |
| Auth server actions with `auth.getSession()` | `auth.getUser()` + `app_metadata.role` check | Phase 5 hardening | Use `requireAdmin` pattern verbatim |

**Deprecated/outdated:**
- `auth.getSession()` in server actions — use `auth.getUser()` (project convention since Phase 5)
- Plain `<select>` for team picking — use Radix Select (consistent with SetBonusDialog)

## Open Questions

1. **Should `pre_season_awards.awarded_points` be reconciled into `members` totals via a dedicated column or a computed sum?**
   - What we know: Phase 1 `members.starting_points` exists. Phase 6 `bonus_awards` and Phase 5 `prize_awards` both live in their own tables and are summed at display time.
   - What's unclear: Whether Phase 9 should add a `pre_season_points_total` column on `members` for speed or rely on a SUM query.
   - Recommendation: Stay consistent — SUM at read time from `pre_season_awards WHERE confirmed=true`. Matches how bonuses/prizes already work. Revisit if performance issues appear (unlikely at 100-member scale).

2. **How does George trigger end-of-season calc — button or cron?**
   - What we know: The user locked "George populates actuals on the `seasons` table" but didn't specify the calc trigger.
   - What's unclear: Whether calc runs automatically when `seasons.actuals_locked_at` is set, or requires an explicit `calculatePreSeasonAwards` admin action.
   - Recommendation: Explicit admin action — "Calculate pre-season awards" button on `/admin/pre-season`, only enabled once `seasons.actuals_locked_at IS NOT NULL`. Mirrors Phase 5 "Close gameweek" manual action. Less magic, full George control. Calc is idempotent (upserts `pre_season_awards`), safe to re-run.

3. **What season is "active" for the submission form?**
   - What we know: Current season (2025-26) is already locked; next season's pre-season window will open ~July 2026.
   - What's unclear: Logic for determining "which season is the submission form for?" — is it the season row with earliest `gw1_kickoff > now()`, or an explicit `is_active`/`is_upcoming` flag?
   - Recommendation: Computed — "upcoming season" = MIN(season) WHERE gw1_kickoff > now(). "Current season" = MAX(season) WHERE gw1_kickoff <= now(). No state flag needed; timestamp is authoritative. Add a helper `getUpcomingSeason()` / `getCurrentSeason()` in `src/lib/pre-season/seasons.ts`.

4. **Where do season-end actuals come from?**
   - What we know: George manually enters them (zero-cost constraint rules out paid final-standings API).
   - What's unclear: Does the admin UI for this live in this phase or Phase 11 (season archive)?
   - Recommendation: Ship the actuals edit form in this phase — it's a blocker for the confirmation flow. Simple form on `/admin/pre-season` with 12 team pickers (same Radix Selects as the member form). Only usable when all PL fixtures complete (display gating on `gameweeks` status).

## Validation Architecture

*(workflow.nyquist_validation is enabled in .planning/config.json)*

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 |
| Config file | `vitest.config.ts` (jsdom env, globals, `tests/setup.ts`) |
| Quick run command | `npm run test:run -- tests/lib/pre-season-calculate.test.ts` |
| Full suite command | `npm run test:run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PRE-01 | Member submission upserts `pre_season_picks` with valid picks | integration | `npm run test:run -- tests/actions/pre-season.test.ts` | Wave 0 |
| PRE-01 | Zod validator rejects missing/wrong-count picks | unit | `npm run test:run -- tests/lib/pre-season-validators.test.ts` | Wave 0 |
| PRE-01 | Promoted picks must come from Championship list; PL picks must come from teams table | unit/integration | `npm run test:run -- tests/actions/pre-season.test.ts` | Wave 0 |
| PRE-02 | Submission rejected when `gw1_kickoff < now()` | integration | `npm run test:run -- tests/actions/pre-season.test.ts` | Wave 0 |
| PRE-02 | Admin `setPreSeasonPicksForMember` bypasses lockout | integration | `npm run test:run -- tests/actions/admin/pre-season.test.ts` | Wave 0 |
| PRE-03 | `calculatePreSeasonPoints` scores 30 pts per correct team, flat, across all 5 categories | unit | `npm run test:run -- tests/lib/pre-season-calculate.test.ts` | Wave 0 |
| PRE-03 | Set-equality semantics — reversed-order top4 still scores 4/4 | unit | `npm run test:run -- tests/lib/pre-season-calculate.test.ts` | Wave 0 |
| PRE-03 | Case-insensitive + whitespace-trim matching ("Man Utd" == "man utd  ") | unit | `npm run test:run -- tests/lib/pre-season-calculate.test.ts` | Wave 0 |
| PRE-03 | Flags emitted correctly per-category + all-correct-overall | unit | `npm run test:run -- tests/lib/pre-season-calculate.test.ts` | Wave 0 |
| PRE-04 | `confirmPreSeasonAwards` writes with `confirmed=true`, `confirmed_by`, `confirmed_at` | integration | `npm run test:run -- tests/actions/admin/pre-season.test.ts` | Wave 0 |
| PRE-04 | Idempotent — confirming twice yields same award, not double | integration | `npm run test:run -- tests/actions/admin/pre-season.test.ts` | Wave 0 |
| PRE-04 | Non-admin call is rejected by `requireAdmin` | integration | `npm run test:run -- tests/actions/admin/pre-season.test.ts` | Wave 0 |
| PRE-05 | `getPreSeasonExportRows` returns flat shape for export | unit | `npm run test:run -- tests/lib/pre-season-export.test.ts` | Wave 0 |
| PRE-05 (manual) | Member `/pre-season` read-only view matches imported data | manual-only | visual QA against imported 2025-26 picks | N/A — UI QA only |
| PRE-05 (manual) | Admin `/admin/pre-season` table shows all members, submission counts, filters | manual-only | visual QA | N/A — UI QA only |

### Sampling Rate
- **Per task commit:** `npm run test:run -- tests/lib/pre-season-calculate.test.ts tests/lib/pre-season-validators.test.ts` (fast unit feedback)
- **Per wave merge:** `npm run test:run -- tests/lib/ tests/actions/pre-season.test.ts tests/actions/admin/pre-season.test.ts`
- **Phase gate:** `npm run test:run` (full suite must be green before `/gsd:verify-work`)

### Wave 0 Gaps
- [ ] `tests/lib/pre-season-calculate.test.ts` — pure-fn scoring tests (TDD-first) covering REQ-PRE-03
- [ ] `tests/lib/pre-season-validators.test.ts` — Zod schema tests for submission + admin set + confirm
- [ ] `tests/lib/pre-season-export.test.ts` — export shape for REQ-PRE-05
- [ ] `tests/actions/pre-season.test.ts` — member submission action (lockout, RLS, upsert) — REQ-PRE-01/02
- [ ] `tests/actions/admin/pre-season.test.ts` — admin actions (late joiner, calc, confirm, bulk, guard) — REQ-PRE-02/04
- [ ] Mirror existing mock pattern (see `tests/actions/admin/los.test.ts` + `tests/actions/admin/bonuses.test.ts`) — vi.mock on `@/lib/supabase/server` + `@/lib/supabase/admin` using the `vi.mocked(import)` hoisting pattern noted in STATE.md Phase 4.
- No framework install needed; Vitest is active and passing (323/323 tests green per STATE.md).

## Sources

### Primary (HIGH confidence — verified from repo)
- `supabase/migrations/007_mid_season_import.sql` (lines 27–77) — `pre_season_picks` schema + RLS, already deployed
- `supabase/migrations/008_los_h2h.sql` (lines 121–154) — admin_notifications CHECK extension idiom
- `supabase/migrations/005_admin_panel.sql` — bonus_awards tri-state + admin notification extension pattern
- `src/lib/scoring/calculate.ts` + `calculate-bonus.ts` — pure-function idiom + DisplayTotal pattern
- `src/actions/admin/bonuses.ts` (lines 14–28) — `requireAdmin` + Zod + adminClient + revalidatePath canonical shape
- `src/actions/admin/los.ts` — exact admin-action idiom (Phase 8 P03 reference)
- `src/actions/admin/import.ts` (lines 155–230) — `importPreSeasonPicks` action + case-insensitive matching + upsert onConflict
- `src/lib/validators/import.ts` (lines 27–55) — `importPreSeasonPicksRowSchema` (already Zod-shaped for these 12 fields)
- `src/app/(admin)/admin/bonuses/page.tsx` — admin page shape + ConfirmBonusAwards component pattern (mirror for pre-season)
- `src/app/(admin)/admin/los/page.tsx` + `src/app/(member)/los/page.tsx` — member/admin route pair pattern
- `.planning/STATE.md` — 50+ locked decisions, including RLS JWT path, Zod v4 `.issues[]`, xlsx pinning, timezone rules
- `.planning/REQUIREMENTS.md` — PRE-01 through PRE-05 definitions + Out of Scope table
- `.planning/phases/09-pre-season-predictions/09-CONTEXT.md` — user-locked decisions (the source of truth for this phase)

### Secondary (MEDIUM confidence)
- Phase 6/8 plan documents (not re-read but referenced via STATE.md decision log)

### Tertiary (LOW confidence)
- None — all findings are grounded in the repo.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library + version confirmed from package.json
- Architecture: HIGH — exact code patterns exist for every mechanism this phase needs
- Pitfalls: HIGH — each pitfall derived from a concrete STATE.md decision or migration artifact
- Scoring calc shape: HIGH — mirrors existing pure libs (`calculate.ts`, `calculate-bonus.ts`)
- End-of-season actuals UX: MEDIUM — Open Question #2 + #4 flagged for planner decision

**Research date:** 2026-04-12
**Valid until:** 2026-05-12 (stable infrastructure; no externals in this phase)
