---
phase: 09-pre-season-predictions
plan: 02
subsystem: pre-season-member-flow

tags: [nextjs, react, server-action, radix, supabase, vitest, typescript]

# Dependency graph
requires:
  - phase: 09-pre-season-predictions
    provides: submitPreSeasonPicksSchema, setPreSeasonPicksForMemberSchema, getUpcomingSeason, getCurrentSeason, isChampionshipTeam, CHAMPIONSHIP_TEAMS_2025_26
provides:
  - submitPreSeasonPicks server action (member self-submission with GW1 lockout)
  - setPreSeasonPicksForMember server action (admin late-joiner entry, lockout bypassed)
  - /pre-season member route (form / read-only / empty tri-state)
  - PreSeasonPicker shared client component (5 categories, 12 slots, Radix Select)
  - PreSeasonForm + PreSeasonReadOnly member components
  - LateJoinerPicksDialog admin component (ready for Plan 03 to wire from admin page)
  - Member nav entry "Pre-Season" alongside "Last One Standing"
affects: [09-03 admin confirmation UI can consume LateJoinerPicksDialog directly]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - JSON payload in FormData for complex nested pick objects — single field `payload` with JSON.stringify, avoids FormData array-encoding pitfalls
    - Shared controlled picker component between two surfaces (member form + admin dialog) — state owned by parent, single source of validation truth
    - RSC tri-state routing (upcoming / current / none) based on season window position relative to now()
    - Sticky-bottom submit bar with per-section progress counters (12-slot gate)

key-files:
  created:
    - src/actions/pre-season.ts
    - src/actions/admin/pre-season.ts
    - src/app/(member)/pre-season/page.tsx
    - src/app/(member)/pre-season/_components/pre-season-picker.tsx
    - src/app/(member)/pre-season/_components/pre-season-form.tsx
    - src/app/(member)/pre-season/_components/pre-season-read-only.tsx
    - src/components/admin/late-joiner-picks-dialog.tsx
    - tests/actions/pre-season.test.ts
    - tests/actions/admin/pre-season.test.ts
  modified:
    - src/app/(member)/layout.tsx

key-decisions:
  - "JSON payload in FormData (`payload` field) for both actions — avoids FormData's flat-string-array encoding of top4/relegated/promoted; client does `JSON.stringify`, server does `JSON.parse` then Zod safeParse"
  - "Shared PreSeasonPicker component lives under src/app/(member)/pre-season/_components/ and is imported by the admin dialog — justified by 5-section form being non-trivial; avoids two divergent copies"
  - "Lockout check uses `upcoming.gw1_kickoff` not the season param alone — rejects submissions when the param-declared season is not the upcoming season (prevents cross-season submissions)"
  - "Admin dialog resets picker state on close — prevents stale data appearing on next open; re-hydrates from existingPicks prop when provided"
  - "Read-only view falls back to a plain coloured badge for Championship names (no crest_url in teams table) — matches TeamBadge's null-crest fallback aesthetic"
  - "Member nav link placed between Last One Standing and League Table for logical grouping — pre-season picks are season-long like LOS"

patterns-established:
  - "Server action source-list validation: fetch teams.name once → Set<lower+trim> → isPL helper; same function in member + admin action (duplication accepted, shared helper not extracted — bodies differ on lockout + audit fields)"
  - "Controlled-picker pattern: `PickerState` type + `EMPTY_PICKER_STATE` + `isPickerComplete` + `toSubmitPayload` helpers all co-located in the picker file — consumers only handle state + submit"
  - "Zod schema in admin pre-season extends member schema via `.extend({ member_id })` — Plan 03 confirmation/actuals actions follow the same pattern"

requirements-completed: [PRE-01, PRE-02]

# Metrics
duration: 4min
completed: 2026-04-12
---

# Phase 9 Plan 2: Member Submission + Admin Late-Joiner Summary

**Member `/pre-season` route ships with form (future season), read-only view (current season), and admin override dialog for late joiners — GW1 lockout enforced server-side, admin bypasses by design.**

## Performance

- **Duration:** 4 min (resumed executor — Tasks 1 & 2 already committed from prior session)
- **Started (this session):** 2026-04-12T17:15:45Z
- **Completed:** 2026-04-12T17:19:11Z
- **Tasks:** 3
- **Files created:** 9
- **Files modified:** 1

## Accomplishments

- **`submitPreSeasonPicks` member action** enforces GW1 lockout (`gw1_kickoff <= now()` → rejected), validates source lists (Top 4 / 10th / Relegated must be PL; Promoted / Playoff Winner must be Championship), rejects duplicates within a category, rejects cross-category impossibilities (team in both Top 4 and Relegated), resolves `member_id` from `auth.uid()` server-side.
- **`setPreSeasonPicksForMember` admin action** — `requireAdmin()` guard, bypasses GW1 lockout, same source-list + duplicate validation, records `submitted_by_admin=true` + `imported_by=admin.userId`.
- **`/pre-season` page** routes to `PreSeasonForm` (upcoming season + future kickoff), `PreSeasonReadOnly` (current season, picks imported or empty), or a "no season" fallback.
- **Shared `PreSeasonPicker` client component** — 5 Radix Select sections (Top 4×4, 10th×1, Relegated×3, Promoted×3, Playoff×1) with per-section progress counters. Sorted options alphabetically.
- **`PreSeasonForm`** wraps picker with lockout banner (formatted in Europe/London), sticky submit bar, counter-gated submit button, JSON payload submission via `FormData`.
- **`PreSeasonReadOnly`** displays picks with `TeamBadge` crests for PL teams, coloured-letter fallback for Championship teams; handles null picks with empty-state message directing to George.
- **`LateJoinerPicksDialog`** wraps `PreSeasonPicker` in Radix Dialog for admin override entry — resets state on close, shows an "admin override" banner, submits to `setPreSeasonPicksForMember`. Plan 03 wires the trigger from admin page.
- **Member nav** gains `/pre-season` link between Last One Standing and League Table.
- 25 action tests green; full suite 398/398; production build clean (new `/pre-season` route visible in route manifest).

## Task Commits

1. **Task 1 RED** (`3102882`) — 12 failing tests for `submitPreSeasonPicks`
2. **Task 1 GREEN** (`f2620d0`) — `submitPreSeasonPicks` implementation
3. **Task 2 RED** (`5cef69a`) — 13 failing tests for `setPreSeasonPicksForMember`
4. **Task 2 GREEN** (`49b73cf`) — `setPreSeasonPicksForMember` implementation
5. **Task 3** (`40295e3`) — `/pre-season` page, form, read-only view, picker, admin dialog, nav link

**Plan metadata commit:** pending (final step).

## Server Action Signatures

```typescript
// src/actions/pre-season.ts
export async function submitPreSeasonPicks(
  formData: FormData
): Promise<{ success: true } | { error: string }>
// formData: payload = JSON.stringify({ season, top4, tenth_place, relegated, promoted, promoted_playoff_winner })
// Rejects: not-authed | invalid JSON | Zod fail | season mismatch upcoming | GW1 passed | no member row | non-PL in PL slots | non-Championship in Championship slots | duplicates within category | team in both top4 + relegated

// src/actions/admin/pre-season.ts
export async function setPreSeasonPicksForMember(
  formData: FormData
): Promise<{ success: true } | { error: string }>
// formData: payload = JSON.stringify({ member_id, season, top4, ..., promoted_playoff_winner })
// Rejects: not-admin | invalid JSON | Zod fail | non-PL / non-Championship / duplicates / cross-category
// NO lockout check — admin override
```

## Member Page Routing Logic

```
┌─ upcoming season exists AND gw1_kickoff > now()  ─→ <PreSeasonForm>
├─ current season exists (no upcoming open)        ─→ <PreSeasonReadOnly>
└─ neither                                         ─→ "No active pre-season window"
```

- Member approval status checked first (redirects to awaiting-approval state if not `approved`).
- PL teams + prior picks fetched in parallel via `Promise.all` (no waterfall).

## LateJoinerPicksDialog Props (for Plan 03 consumption)

```typescript
interface LateJoinerPicksDialogProps {
  memberId: string
  memberName: string                   // shown in dialog title
  season: number                       // upcoming.season
  plTeams: Array<{ name: string }>
  championship: readonly string[]      // pass CHAMPIONSHIP_TEAMS_2025_26
  existingPicks?: PreSeasonPickRow | null
  trigger?: React.ReactNode            // e.g. <button>Enter picks</button>
}
```

Plan 03 pattern:

```tsx
import { LateJoinerPicksDialog } from '@/components/admin/late-joiner-picks-dialog'
import { CHAMPIONSHIP_TEAMS_2025_26 } from '@/lib/teams/championship-2025-26'

<LateJoinerPicksDialog
  memberId={row.member_id}
  memberName={row.display_name}
  season={upcoming.season}
  plTeams={plTeamNames}
  championship={CHAMPIONSHIP_TEAMS_2025_26}
  existingPicks={row.picks}
/>
```

## Shared Helper Extracted

**`PreSeasonPicker`** (`src/app/(member)/pre-season/_components/pre-season-picker.tsx`) — used by both `PreSeasonForm` and `LateJoinerPicksDialog`.

Exports:
- `PreSeasonPicker` component (controlled, parent owns state)
- `PickerState` type
- `EMPTY_PICKER_STATE` constant
- `isPickerComplete(state)` — true when all 12 slots filled
- `toSubmitPayload(state, season)` — flattens to the shape both server actions expect

This avoided a ~200-line duplication between the member form and the admin dialog.

## Decisions Made

- **Upcoming architecture (Plan 09-03 heads-up acknowledged):** Current code uses `CHAMPIONSHIP_TEAMS_2025_26` hardcoded constant + `isChampionshipTeam()` helper as specified. When Plan 09-03 converts the list to a DB-backed table, `isChampionshipTeam` will be swapped to a DB lookup and both server actions will continue working unchanged — no callers need to be modified.
- **JSON payload in FormData over native field encoding** — see key-decisions frontmatter.
- **Member nav link position** — between LOS and League Table, matching the season-long lifecycle grouping.

## Deviations from Plan

### Auto-fixed Issues

None. All three tasks executed exactly as specified. Tasks 1 and 2 used straightforward TDD RED-GREEN cycles (prior session). Task 3 followed the plan's `<action>` block with the optional shared-picker extraction (which the plan explicitly left to executor discretion).

---

**Total deviations:** 0
**Impact on plan:** None — plan executed exactly as written.

## Issues Encountered

None. The previously-completed Tasks 1 and 2 (committed in `3102882`/`f2620d0`/`5cef69a`/`49b73cf`) verified green on re-run. Task 3's UI build compiled cleanly on first try.

## User Setup Required

- None for this plan. The `/pre-season` route will render the "no active window" state until migration 009 is deployed (seed inserts a 2025-26 and a 2026-27 season). Currently the route is safe to visit in any environment.
- Plan 03 will wire `LateJoinerPicksDialog` from an admin page — no setup dependencies introduced here.

## Next Phase Readiness

**Ready for Plan 03 (admin end-of-season actuals + confirmation + export):**
- `setPreSeasonPicksForMember` already in place for late-joiner admin entry
- `LateJoinerPicksDialog` component ready to drop into the admin page
- `confirmPreSeasonAwardSchema` + `seasonActualsSchema` already exist from Plan 01
- `calculatePreSeasonPoints` + `getPreSeasonExportRows` ready for calculate + export actions

**Deployment note:** Migration 009 still not pushed (Plan 01 decision — deferred to Plan 03 / end-of-phase). Routes will render gracefully until then because `getUpcomingSeason()` / `getCurrentSeason()` return null on empty tables and the page shows a "no active window" fallback.

## Verification Summary

- `npm run test:run -- tests/actions/pre-season.test.ts tests/actions/admin/pre-season.test.ts` → 25/25 pass
- `npm run test:run` (full suite) → 398/398 pass
- `npm run build` → clean; `/pre-season` route in manifest
- Member nav inspected in source: `/pre-season` link present between `/los` and the League Table placeholder

---
*Phase: 09-pre-season-predictions*
*Completed: 2026-04-12*

## Self-Check: PASSED

Files verified present:
- src/actions/pre-season.ts (committed `f2620d0`)
- src/actions/admin/pre-season.ts (committed `49b73cf`)
- src/app/(member)/pre-season/page.tsx (committed `40295e3`)
- src/app/(member)/pre-season/_components/pre-season-picker.tsx (committed `40295e3`)
- src/app/(member)/pre-season/_components/pre-season-form.tsx (committed `40295e3`)
- src/app/(member)/pre-season/_components/pre-season-read-only.tsx (committed `40295e3`)
- src/components/admin/late-joiner-picks-dialog.tsx (committed `40295e3`)
- src/app/(member)/layout.tsx (modified, committed `40295e3`)
- tests/actions/pre-season.test.ts (committed `3102882`)
- tests/actions/admin/pre-season.test.ts (committed `5cef69a`)

All 5 task commits present in git history.
Full suite 398/398 green; production build clean.
