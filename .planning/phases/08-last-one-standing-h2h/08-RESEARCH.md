# Phase 8: Last One Standing & H2H - Research

**Researched:** 2026-04-12
**Domain:** Eliminative sub-competition state machine + tie-break detection, integrated into existing Next.js 16 + Supabase + Vitest stack
**Confidence:** HIGH (codebase patterns well-established through Phases 1-7; LOS/H2H are pure DB schema + state-machine work on top of existing scoring pipeline)

## Summary

Phase 8 introduces two orthogonal sub-competitions that piggyback on the existing prediction + scoring pipeline built in Phases 3, 4, and 6:

1. **Last One Standing (LOS)** — a per-member elimination tournament tracked across gameweeks. Member picks one team per gameweek; win = progress, draw/loss/missed submission = eliminated. Teams can't be reused until all 20 PL teams have been used. When only one member remains, a competition cycle ends and a new one auto-starts.
2. **H2H Steal Detection** — automated detection of tied weekly-point leaders, flagged for resolution in the following gameweek. The tied members compete next gameweek for the jackpot. If runner-up (£10) position is tied, same logic applies.

Both features are admin-infrastructure work — no reports or emails in this phase (Phase 10). The critical integration points are: (1) extending the prediction submission form/action with an LOS picker, (2) extending `sync.ts` / `recalculateFixture` to trigger LOS elimination evaluation when results finalize, and (3) adding a weekly-total aggregation query that runs on gameweek close to detect ties.

**Primary recommendation:** Build LOS as a competition state machine backed by four new tables (`los_competitions`, `los_picks`, `los_team_usage` — or derive usage from picks, `h2h_steals`). Hook elimination evaluation into `syncFixtures` after `detectNewlyFinished` when ALL fixtures in the LOS round are FINISHED (not per-fixture). Pure evaluator function `evaluateLosRound()` mirrors the `calculatePoints` / `calculateBonusPoints` pattern — fully testable with no DB side effects.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**LOS Team Pick**
- LOS pick is part of the weekly prediction submission flow — member selects a team alongside their score predictions and bonus pick (extends Phase 3/6 pattern)
- Member picks from a dropdown/list of the 20 PL teams, filtered to only show teams they haven't used yet in the current cycle
- Pick is mandatory when an LOS competition is active and the member is still in — submission blocked without it (same pattern as bonus pick)
- If a member is eliminated, LOS pick section is hidden/disabled with a message ("You've been eliminated — next competition starts when a winner is found")
- Pick is editable until the first fixture of the gameweek kicks off (consistent with prediction lockout rules)

**LOS Elimination Logic**
- Win = progress (team won their match)
- Draw or Loss = eliminated
- Miss a round without submitting = eliminated (no exceptions, per competition rules)
- Elimination checked automatically when match results come in (extends scoring/sync pipeline)
- If a member's chosen team hasn't played yet (fixture postponed), they remain "pending" until the fixture is resolved

**LOS Team Usage Tracking**
- Each member's team usage tracked per competition cycle
- Once a team is picked, it's unavailable until ALL 20 PL teams have been used (then full reset within the same competition)
- The 20-team cycle resets independently of competition resets — competition reset (winner found) makes all teams available again regardless of usage

**LOS Competition Lifecycle**
- Multiple LOS competitions per season (~4-7 expected with ~50 members)
- When only one member remains = winner (£50 prize)
- Competition auto-resets: all teams available, all members back in, new competition starts
- George gets a notification when a winner is found
- George can view and manage LOS status for all members (LOS-07)

**LOS Admin View**
- George needs to see: who's still in, who's eliminated, each member's current pick, full team usage history
- Should be accessible from the admin sidebar (new "LOS" link or under existing section)
- George can manually eliminate or reinstate a member if needed (override capability)

**LOS Member View**
- Members should see: their status (in/eliminated), current pick, teams used, teams remaining, who's still in the competition

**H2H Steal Detection**
- System automatically detects when two or more members tie for highest weekly points
- Tied members are flagged as "H2H Steal" for the FOLLOWING gameweek
- The steal is resolved in the following gameweek: highest scorer between the tied members wins the jackpot
- If still tied after the steal gameweek, jackpot is split equally
- H2H steal status is tracked and visible to George in the admin panel
- Members should see H2H steal status on the gameweek page (who's in a steal, what's at stake)

**H2H Steal Resolution**
- The weekly jackpot (£30 1st, £10 2nd) applies to the steal resolution
- If the runner-up (£10) position also has a tie, the same H2H steal logic applies

### Claude's Discretion

- LOS pick UI (dropdown, card grid, or list — most user-friendly for mobile)
- LOS status page layout for members
- LOS admin page layout
- H2H steal visual treatment (how ties and steals are shown to members)
- Whether LOS competition reset is automatic or George-triggered
- How postponed fixtures affect LOS (pending status handling)
- H2H steal resolution flow (auto-detect + George confirm, or fully manual)
- Whether LOS and H2H get their own sidebar links or are grouped
- LOS standings ordering (alphabetical, or by number of teams remaining)

### Deferred Ideas (OUT OF SCOPE)

- LOS jackpot payment tracking — George handles fees outside the tool
- Pre-season predictions evaluation — Phase 9
- Weekly reports including LOS status and H2H steals — Phase 10
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LOS-01 | Members pick one team to win each week alongside their predictions | Extend `prediction-form.tsx` + `submitPredictions` action (proven pattern from Phase 6 bonus pick). Add `los_picks` table, UPsert on `(competition_id, member_id, gameweek_id)` |
| LOS-02 | If the team wins, member progresses; draw or loss = eliminated | Pure function `evaluateLosPick(homeScore, awayScore, pickedTeamId, homeTeamId, awayTeamId): 'win' \| 'lose' \| 'draw'`. Hook into `syncFixtures` after `detectNewlyFinished` |
| LOS-03 | Once a team is picked, it cannot be picked again until all 20 PL teams have been used | Query `los_picks` for member's current competition cycle; filter teams dropdown. Reset usage tracking when all 20 used (DB-level check before gating) |
| LOS-04 | Tool tracks each member's elimination status and team usage history | `los_picks` table is the source of truth — derive status and history via queries. `eliminated_at_gw` column on `los_picks` (or member-level status in `los_competition_members`) |
| LOS-05 | If member misses a round without submitting, they are eliminated | Evaluated on gameweek close (all fixtures FINISHED) — if no `los_picks` row for that member in that gameweek, mark eliminated. Runs in same pass as pick evaluation |
| LOS-06 | When a winner is found, competition resets and all teams become available again | Auto-close current competition when `SELECT count(*) WHERE status='active' = 1`, set `winner_id`, `ended_at`. Insert new row in `los_competitions` with `starts_at_gw=<next gw>`. Team usage scoped by `competition_id` so reset is free |
| LOS-07 | George can view and manage LOS status for all members | New admin page `/admin/los` — sidebar link. Table: member, status, current pick, teams used (chips), teams remaining count. Admin actions: override eliminate / reinstate, manual reset competition |
| H2H-01 | Tool automatically detects tied weekly winners | Aggregation query on gameweek close: `SELECT member_id, SUM(points_awarded) FROM prediction_scores + bonus_awards WHERE gameweek_id=X GROUP BY ... ORDER BY DESC`. Compare top-N ties |
| H2H-02 | H2H steals flagged in the gameweek report for the following week | Insert `h2h_steals` row with `detected_in_gw`, `resolves_in_gw`, `tied_member_ids[]`, `position` (1=jackpot, 2=runner-up). Displayed on gameweek page in following week |
| H2H-03 | H2H steal resolved in following gameweek — highest scorer between tied players wins | On close of `resolves_in_gw`, compute weekly totals for tied members only; update `h2h_steals.winner_id` (or `winner_ids[]` if still tied → split) |
</phase_requirements>

## Standard Stack

### Core (already installed — see `package.json`)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.3 | App Router, server actions, server components | Established stack — do not change |
| React | 19.2.4 | UI | Established stack |
| @supabase/ssr | 0.10.2 | Session-scoped Supabase client (RLS enforced) | Established pattern (`createServerSupabaseClient`) |
| @supabase/supabase-js | 2.103.0 | Admin client (service role, bypasses RLS) | Used by `recalculate.ts`, `sync.ts` — reuse for LOS evaluation |
| zod | 4.3.6 | Input validation on server actions | Established — `submitPredictions` uses Zod |
| react-hook-form | 7.72.1 | Client form state | Established for auth + admin forms |
| @radix-ui/react-select | 2.2.6 | Accessible dropdown | **Already installed** — perfect for LOS team picker |
| @radix-ui/react-dialog | 1.1.15 | Modal (admin override actions) | Already used by admin dialogs |
| lucide-react | 1.8.0 | Icons | Established — use for LOS status indicators |
| vitest | 4.1.4 | Tests | Established — TDD pattern |

### Supporting (reuse — no new deps)
| Asset | Purpose | Where |
|-------|---------|-------|
| `teams` table (20 PL teams + badges) | LOS team selection source | Phase 2 |
| `team-badge.tsx` | Display team crests in picker + status | Phase 2 |
| `prediction-form.tsx` / `submitPredictions` action | Extend with LOS pick (same as bonus pick extension in Phase 6) | Phase 3 + Phase 6 |
| `recalculateFixture` / `syncFixtures` pipeline | Trigger LOS elimination + H2H tie detection | Phase 4 |
| `prediction_scores` table + `bonus_awards.points_awarded` | Source for weekly totals (H2H tie detection) | Phase 4 + 6 |
| `admin_notifications` table | LOS winner + H2H steal detected notifications | Phase 1 + 5 (type CHECK will need extending) |
| `gameweeks.closed_at` | Signal to run "end of gameweek" evaluation | Phase 5 |
| Sidebar (`sidebar.tsx`) | Add LOS + H2H links | Phase 5 |

### Alternatives Considered (and rejected)
| Instead of | Could Use | Why rejected |
|------------|-----------|--------------|
| Native `<select>` dropdown for team picker | @radix-ui/react-select (already installed) | Radix gives keyboard nav + mobile sheet behavior + consistent styling with other admin dropdowns |
| Triggering elimination check per-fixture in `recalculateFixture` | Check only when ALL fixtures in the GW are FINISHED | A member's LOS team may play earlier, but a missed-submission check needs full-GW completion. Avoids premature eliminations and race conditions with postponed fixtures |
| Separate `los_team_usage` table | Derive usage from `los_picks` via GROUP BY `(competition_id, member_id, team_id)` | One less table to keep in sync; picks table already has all needed info. Only add `los_team_usage` if query performance degrades (50 members × 20 teams = 1000 rows per competition, trivial) |
| Server-computed "teams remaining" list sent to client | Client-side filter from full teams + picks history | Server filtering is required for security (RLS + authoritative truth), and avoids exposing other members' picks |
| Storing LOS status as column on `members` | Derive from `los_picks` + `los_competitions` | Members join/leave multiple competitions across season — per-competition membership avoids stale flags |

## Architecture Patterns

### Recommended Project Structure

```
src/
├── lib/
│   └── los/
│       ├── evaluate.ts           # Pure functions: evaluateLosPick, evaluateLosRound
│       ├── team-usage.ts         # Pure function: availableTeams(memberId, competitionId, allPicks)
│       └── competition.ts        # Pure functions: shouldResetCompetition, findWinner
│   └── h2h/
│       ├── detect-ties.ts        # Pure function: detectWeeklyTies(scores[])
│       └── resolve-steal.ts      # Pure function: resolveSteal(tiedMembers, nextWeekScores)
├── actions/
│   ├── los.ts                    # submitLosPick (member) — called from prediction-form
│   └── admin/
│       └── los.ts                # overrideEliminate, reinstate, resetCompetition
├── app/
│   ├── (admin)/admin/los/        # Admin LOS management page
│   │   └── page.tsx
│   └── (member)/los/             # Member LOS status page
│       └── page.tsx
├── components/
│   ├── los/
│   │   ├── los-team-picker.tsx   # Radix Select with badges, filtered teams
│   │   ├── los-status-card.tsx   # Member's own status display
│   │   ├── los-standings.tsx     # Who's still in (member view)
│   │   └── admin-los-table.tsx   # Admin view
│   └── h2h/
│       └── h2h-steal-banner.tsx  # Shown on gameweek page when steal active
supabase/
└── migrations/
    └── 008_los_h2h.sql           # All new tables, RLS, admin_notifications CHECK extension
tests/
├── lib/
│   ├── los-evaluate.test.ts
│   ├── los-team-usage.test.ts
│   └── h2h-detect-ties.test.ts
└── actions/
    └── admin/los.test.ts
```

### Pattern 1: Pure Evaluator Function (mirror of `calculatePoints`)

**What:** All domain logic lives in pure, side-effect-free functions under `src/lib/los/` and `src/lib/h2h/`. The orchestration layer (server actions, sync pipeline) is the only code that touches Supabase.

**When to use:** Every decision rule — elimination, tie detection, competition reset, teams-remaining calculation.

**Example:**
```typescript
// src/lib/los/evaluate.ts
// Source: mirrors established pattern from src/lib/scoring/calculate.ts

export type LosOutcome = 'win' | 'lose' | 'draw' | 'pending'

export interface LosPickEvaluation {
  pick_id: string
  outcome: LosOutcome
  eliminated: boolean
}

/**
 * Evaluates a single LOS pick against the fixture result.
 * 'pending' returned when fixture has no result yet (postponed / not finished).
 * 'draw' and 'lose' eliminate; 'win' progresses.
 */
export function evaluateLosPick(params: {
  pick_id: string
  picked_team_id: string
  home_team_id: string
  away_team_id: string
  home_score: number | null
  away_score: number | null
  fixture_status: string
}): LosPickEvaluation {
  const { pick_id, picked_team_id, home_team_id, away_team_id, home_score, away_score, fixture_status } = params

  if (fixture_status !== 'FINISHED' || home_score === null || away_score === null) {
    return { pick_id, outcome: 'pending', eliminated: false }
  }

  if (home_score === away_score) {
    return { pick_id, outcome: 'draw', eliminated: true }
  }

  const homeWon = home_score > away_score
  const pickedHome = picked_team_id === home_team_id
  const pickedAway = picked_team_id === away_team_id

  if (!pickedHome && !pickedAway) {
    // Should never happen — team not in this fixture. Guard anyway.
    return { pick_id, outcome: 'pending', eliminated: false }
  }

  if ((homeWon && pickedHome) || (!homeWon && pickedAway)) {
    return { pick_id, outcome: 'win', eliminated: false }
  }
  return { pick_id, outcome: 'lose', eliminated: true }
}
```

### Pattern 2: Extend Sync Pipeline Hook (mirror of `detectNewlyFinished`)

**What:** After `detectNewlyFinished` returns, a follow-up function `detectFullyFinishedGameweeks` identifies gameweeks where ALL fixtures are now FINISHED. For each such gameweek, `evaluateLosRound()` and `detectH2HTies()` run.

**When to use:** Hooking time-based state transitions (gameweek close) into the sync pipeline. Matches proven idiom from `sync.ts`.

**Example:**
```typescript
// src/lib/fixtures/sync.ts — extension
// After step 9 (scoring)

const completedGameweeks = await detectFullyFinishedGameweeks(adminClient, newlyFinished)
for (const gwId of completedGameweeks) {
  await evaluateLosRound(adminClient, gwId)
  await detectH2HTiesForGameweek(adminClient, gwId)
}
```

### Pattern 3: RLS-First Tables (mirror of `predictions` / `bonus_awards`)

**What:** All new tables get RLS enabled with policies that mirror the existing model: (a) member reads own data, (b) admin reads all, (c) writes only via admin client (service role) or tightly-scoped member policies.

**Specifically for LOS:**
- `los_picks`: member SELECT own; admin SELECT all; member INSERT/UPDATE own (with `member_id = auth.uid() member row` + fixture-not-kicked-off subquery — EXACT mirror of `predictions_insert_before_kickoff`)
- `los_competitions`: authenticated SELECT all; admin ALL
- `h2h_steals`: authenticated SELECT all (public info for member view); admin ALL

### Pattern 4: Extend `submitPredictions` (mirror of how bonus pick was added in Phase 6)

**What:** Add optional `losTeamId: string | null` parameter to `submitPredictions`. Server action validates, checks team not already used in current competition, upserts `los_picks` row atomically with predictions.

**Example signature:**
```typescript
export async function submitPredictions(
  gameweekNumber: number,
  entries: Array<{ fixture_id: string; home_score: number; away_score: number }>,
  bonusFixtureId: string | null = null,
  losTeamId: string | null = null,  // NEW
): Promise<{
  success?: boolean
  saved: number
  skipped: number
  bonusSaved: boolean
  losSaved: boolean  // NEW
  error?: string
}>
```

### Anti-Patterns to Avoid

- **Computing LOS status in the client:** Security hole (other members' picks leaked) + consistency risk (stale data). Server is source of truth.
- **Per-fixture elimination evaluation:** Creates race conditions when a member's pick plays on Saturday but the GW isn't complete until Monday. Use full-GW-complete gate instead.
- **Storing `teams_remaining` as a computed column:** Will drift. Always derive from `los_picks` rows in current competition.
- **One big "los_state" JSONB blob on members table:** Breaks RLS granularity, doesn't query efficiently, loses history across competitions.
- **Auto-resetting competitions via DB trigger:** Hard to test, hidden side effects. Do it in the sync pipeline's orchestrator in application code.
- **Detecting H2H ties on every sync:** Only detect once a gameweek is fully FINISHED — otherwise "ties" shift as more results come in. Flag once, don't re-flag.
- **Assuming one fixture per team per gameweek:** Double-headers do occur (postponed fixtures rescheduled into normal GWs). The LOS pick's `fixture_id` must be stored explicitly — don't derive from team_id + gameweek_id.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accessible dropdown | Custom `<div>` with click handlers | `@radix-ui/react-select` (already installed) | Keyboard nav, ARIA, mobile sheet, scroll management — non-trivial to get right |
| Team usage state machine | Bespoke table with insert/delete on pick/reset | `los_picks` + GROUP BY query (`availableTeams()` pure function reading from picks) | Single source of truth = no sync bugs |
| Weekly total aggregation | Custom loop in JS fetching each member | Postgres RPC or single SELECT with SUM/GROUP BY over `prediction_scores` + confirmed `bonus_awards` | Performance + correctness; bonus confirmation state matters |
| Tie detection | Sorting and comparing in app code | SQL `SELECT ... WHERE total = (SELECT MAX(total) FROM ...)` — returns all tied members in one query | Atomic, correct, efficient |
| Competition reset | Manual SQL run or admin cron | Application-level orchestrator called after `evaluateLosRound` detects 1 survivor | Testable, logged, notification-emits |
| Input validation on server action | Ad-hoc `if` checks | `zod` schema (same as `submitPredictionsSchema`) | Consistency with established validator pattern |
| Permission check on admin routes | Bespoke middleware | Existing `requireAdmin()` helper (established in Phase 1) | DRY + consistent error messages |

**Key insight:** Everything for LOS/H2H can be expressed in pure functions + SQL queries. There are no new "categories" of code — this phase is almost entirely new tables + new pure evaluators + wire-up into existing orchestrators.

## Common Pitfalls

### Pitfall 1: Postponed / voided fixtures break LOS logic
**What goes wrong:** A member picks Arsenal vs Liverpool. The fixture gets postponed to next gameweek. If elimination runs before rescheduling, the member is eliminated for "missing a round" (or worse, evaluated against an empty fixture).
**Why it happens:** LOS assumes "picked team plays this gameweek." Postponements break that invariant.
**How to avoid:**
- Store `fixture_id` on `los_picks` (not just team_id) — anchor to the specific match
- `evaluateLosPick` returns `pending` when fixture.status is not FINISHED
- `evaluateLosRound` only triggers when ALL fixtures in the gameweek are FINISHED (or explicitly POSTPONED/CANCELLED, in which case pending picks roll forward or require admin decision)
- George should be able to manually mark a pick "void — re-pick required" from the admin UI (matches FIX-04 pattern from Phase 2)

**Warning signs:** Members reporting "I was eliminated but my team didn't play"; `los_picks` with outcome=null after GW closed.

### Pitfall 2: Double-eliminating on sync re-runs
**What goes wrong:** Sync runs every 15 min. Each run re-evaluates eliminations. Member gets "eliminated" notification 12 times.
**Why it happens:** Evaluation isn't idempotent on state.
**How to avoid:**
- `los_picks.outcome` column — only update rows where `outcome IS NULL` (mirror of `detectNewlyFinished` pattern)
- Idempotency check: already-evaluated picks are skipped
- Notifications only fire on transition (pending→eliminated or pending→winner-found)

**Warning signs:** Duplicate notifications; `admin_notifications` table growing faster than expected.

### Pitfall 3: H2H ties include unconfirmed bonuses
**What goes wrong:** Two members tied on base points. One has a pending Golden Glory bonus (+60). Tie detection runs before George confirms the bonus. Wrong tie flagged.
**Why it happens:** Weekly total depends on confirmed bonuses only (established rule from Phase 6 — `computeDisplayTotal` excludes pending bonuses).
**How to avoid:**
- Tie detection SUMs `prediction_scores.points_awarded + bonus_awards.points_awarded WHERE bonus_awards.awarded = true` — exclude NULL/pending/rejected
- Only run H2H detection after gameweek is `closed_at IS NOT NULL` (George has reviewed + confirmed bonuses)
- Re-run detection if George confirms a late bonus — the tie detection should be idempotent on `(gameweek_id, position)` unique key

**Warning signs:** H2H steal flagged then removed; member weekly totals change after steal detected.

### Pitfall 4: LOS pick deselection / unpicking
**What goes wrong:** Member picked Arsenal, then wants to change to Chelsea. If the action INSERTs instead of UPSERTs, you get two active picks.
**Why it happens:** Naive INSERT logic.
**How to avoid:** UPSERT on `(competition_id, member_id, gameweek_id)` UNIQUE constraint — mirror of `predictions.onConflict='member_id,fixture_id'` and `bonus_awards.onConflict='gameweek_id,member_id'`.

**Warning signs:** Multiple active picks per member per GW; "teams remaining" count off by one.

### Pitfall 5: Competition auto-start race condition
**What goes wrong:** Winner found on Monday. Auto-start of new competition. But one fixture was marked FINISHED on Monday and another still in-progress (rare, but double-headers). Second fixture resolution still references old competition.
**Why it happens:** Transition between competitions isn't atomic.
**How to avoid:**
- Competition reset in a transaction: update old (set `ended_at`, `winner_id`, `status='complete'`), insert new (`starts_at_gw = currentGw + 1`).
- New picks only accepted for GWs where `gameweek.number >= competition.starts_at_gw`
- Never start new competition mid-GW; always scope to "next unstarted gameweek"

**Warning signs:** Picks logged against a `competition_id` that's already `complete`.

### Pitfall 6: RLS leak — members seeing other members' LOS picks before fixture kicks off
**What goes wrong:** Member queries `los_picks` and sees everyone's picks, making the game trivial to game (copy the leader).
**Why it happens:** Naive RLS policy (`SELECT FOR all authenticated`).
**How to avoid:**
- RLS policy mirrors `predictions_select_member`: see own picks always; see others' picks only for gameweeks where ALL fixtures have kicked off
- OR: simpler — only show others' picks for **past** gameweeks (where outcome is already resolved). Keep current-GW picks private until kickoff.

**Warning signs:** LOS standings page shows everyone's current pick before the GW starts.

### Pitfall 7: Missed submission ≠ submitted prediction without LOS pick
**What goes wrong:** Member submits score predictions but forgets LOS pick. If system says "mandatory LOS pick blocks submission," that's enforced. But if the form bug allows bypass, member skates by.
**Why it happens:** Client-side validation bypass.
**How to avoid:**
- Server action `submitPredictions` rejects if LOS competition active, member not eliminated, and `losTeamId === null` — return error, don't save ANY predictions (match bonus pick mandatory pattern)
- OR: allow predictions to save but don't auto-register a LOS pick; then "missed submission" elimination correctly fires on GW close
- The locked decision says "Pick is mandatory when an LOS competition is active and the member is still in — submission blocked without it" → choose option 1 (block submission)

**Warning signs:** Members with predictions in a GW but no LOS pick (when they should still be in).

### Pitfall 8: RLS and service-role clients mix-up
**What goes wrong:** LOS pick submitted via `createAdminClient()` bypassing RLS — lockout not enforced.
**Why it happens:** Copy-paste from `recalculate.ts` (which legitimately uses admin client).
**How to avoid:**
- Member-initiated writes (LOS pick submission) MUST use `createServerSupabaseClient()` so RLS fires (mirror `submitPredictions` exactly)
- System-initiated writes (elimination updates, competition reset, H2H detection) use admin client
- Established rule in CLAUDE state: "session client (not admin client) for prediction upserts so RLS enforces two-layer lockout at DB level"

**Warning signs:** Members can submit picks after kick-off.

## Code Examples

Verified patterns from existing codebase:

### Pattern A: Extending `submitPredictions` with a third optional arg (LOS pick)
```typescript
// src/actions/predictions.ts — extension
// Source: existing pattern in submitPredictions (shown in project context above)

export async function submitPredictions(
  gameweekNumber: number,
  entries: Array<{ fixture_id: string; home_score: number; away_score: number }>,
  bonusFixtureId: string | null = null,
  losTeamId: string | null = null,
): Promise<{ success?: boolean; saved: number; skipped: number; bonusSaved: boolean; losSaved: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()
  // ... existing auth + member lookup + validation ...

  // ── NEW: LOS pick validation and upsert ──
  let losSaved = false

  // Look up active LOS competition + member's status in it
  const { data: activeCompetition } = await supabase
    .from('los_competitions')
    .select('id, status, starts_at_gw')
    .eq('status', 'active')
    .single()

  const memberIsEligible = activeCompetition
    ? await isMemberStillIn(supabase, activeCompetition.id, member.id)
    : false

  // Mandatory enforcement
  if (activeCompetition && memberIsEligible && !losTeamId) {
    return { error: 'LOS team pick required — you are still in the competition', saved: 0, skipped: 0, bonusSaved: false, losSaved: false }
  }

  if (activeCompetition && memberIsEligible && losTeamId) {
    // Validate team hasn't been used in current competition cycle
    const { data: priorPick } = await supabase
      .from('los_picks')
      .select('id')
      .eq('competition_id', activeCompetition.id)
      .eq('member_id', member.id)
      .eq('team_id', losTeamId)
      .neq('gameweek_id', gwRow.id)  // exclude current GW (allow updating same GW pick)
      .maybeSingle()

    if (priorPick) {
      return { error: 'You have already used that team in this competition cycle', saved: 0, skipped: 0, bonusSaved: false, losSaved: false }
    }

    // Resolve fixture_id for the team in this gameweek
    const { data: teamFixture } = await supabase
      .from('fixtures')
      .select('id, kickoff_time')
      .eq('gameweek_id', gwRow.id)
      .or(`home_team_id.eq.${losTeamId},away_team_id.eq.${losTeamId}`)
      .single()

    if (!teamFixture) {
      return { error: 'That team has no fixture in this gameweek', saved: 0, skipped: 0, bonusSaved: false, losSaved: false }
    }

    // Kickoff lockout
    const losLockout = await canSubmitPrediction(teamFixture.id)
    if (losLockout.canSubmit) {
      const { error: losError } = await supabase
        .from('los_picks')
        .upsert({
          competition_id: activeCompetition.id,
          member_id: member.id,
          gameweek_id: gwRow.id,
          team_id: losTeamId,
          fixture_id: teamFixture.id,
        }, { onConflict: 'competition_id,member_id,gameweek_id' })

      if (!losError) losSaved = true
    }
  }

  // ... existing bonus pick handling + revalidate ...

  return { success: true, saved, skipped, bonusSaved, losSaved }
}
```

### Pattern B: Pure LOS round evaluator
```typescript
// src/lib/los/evaluate.ts
// Source: mirrors calculatePoints pattern in src/lib/scoring/calculate.ts

export interface LosRoundPickInput {
  pick_id: string
  member_id: string
  team_id: string
  fixture_id: string
  home_team_id: string
  away_team_id: string
  home_score: number | null
  away_score: number | null
  fixture_status: string
}

export interface LosRoundEvaluation {
  evaluations: LosPickEvaluation[]
  missed_submission_member_ids: string[]  // eliminate these
  survivors: string[]                      // member_ids remaining after this round
  winner_id: string | null                 // set when survivors.length === 1
}

/**
 * Evaluates all picks for a round + identifies missing submissions.
 * Pure function — no DB writes. Caller persists outcomes + eliminations.
 */
export function evaluateLosRound(params: {
  active_member_ids: string[]
  picks: LosRoundPickInput[]
}): LosRoundEvaluation {
  const evaluations = params.picks.map(p => evaluateLosPick(p))
  const submittedMemberIds = new Set(params.picks.map(p => p.member_id))

  const missed = params.active_member_ids.filter(id => !submittedMemberIds.has(id))

  const eliminatedFromPicks = new Set(
    evaluations.filter(e => e.eliminated).map(e => {
      const p = params.picks.find(pp => pp.pick_id === e.pick_id)!
      return p.member_id
    }),
  )

  const survivors = params.active_member_ids.filter(id =>
    !missed.includes(id) && !eliminatedFromPicks.has(id)
  )

  return {
    evaluations,
    missed_submission_member_ids: missed,
    survivors,
    winner_id: survivors.length === 1 ? survivors[0] : null,
  }
}
```

### Pattern C: H2H tie detection via SQL
```sql
-- src/lib/h2h/detect-ties.ts — embedded in admin client call
-- Computes weekly totals including confirmed bonuses, returns members tied for 1st and 2nd.

WITH weekly_totals AS (
  SELECT
    m.id AS member_id,
    COALESCE(SUM(ps.points_awarded), 0)
    + COALESCE(SUM(CASE WHEN ba.awarded = true THEN ba.points_awarded ELSE 0 END), 0)
    AS total_points
  FROM public.members m
  LEFT JOIN public.prediction_scores ps
    ON ps.member_id = m.id
   AND ps.fixture_id IN (SELECT id FROM public.fixtures WHERE gameweek_id = $1)
  LEFT JOIN public.bonus_awards ba
    ON ba.member_id = m.id
   AND ba.gameweek_id = $1
  WHERE m.approval_status = 'approved'
  GROUP BY m.id
),
ranked AS (
  SELECT
    member_id,
    total_points,
    DENSE_RANK() OVER (ORDER BY total_points DESC) AS rank
  FROM weekly_totals
  WHERE total_points > 0
)
SELECT member_id, total_points, rank
FROM ranked
WHERE rank IN (1, 2)
ORDER BY rank, member_id;
-- Post-processing in TS: group by rank; if count(members at rank=1) > 1 → H2H steal at position 1
```

### Pattern D: Admin sidebar extension (mirror of existing `navItems`)
```typescript
// src/components/admin/sidebar.tsx — add entries to navItems
import { Swords, Crown } from 'lucide-react'

// Insert after 'Prizes' item:
{ href: '/admin/los', label: 'Last One Standing', icon: Crown },
{ href: '/admin/h2h', label: 'H2H Steals', icon: Swords },  // OR merge into LOS page as a tab
```

### Pattern E: RLS policies for `los_picks` (mirror of `predictions`)
```sql
-- supabase/migrations/008_los_h2h.sql
ALTER TABLE public.los_picks ENABLE ROW LEVEL SECURITY;

-- Member INSERT own pick, only before fixture kickoff
CREATE POLICY los_picks_insert_own_before_kickoff
  ON public.los_picks FOR INSERT
  WITH CHECK (
    member_id = (
      SELECT m.id FROM public.members m
      WHERE m.user_id = auth.uid() AND m.approval_status = 'approved'
      LIMIT 1
    )
    AND EXISTS (
      SELECT 1 FROM public.fixtures f
      WHERE f.id = fixture_id AND f.kickoff_time > now()
    )
  );

-- Member UPDATE own pick, only before fixture kickoff
CREATE POLICY los_picks_update_own_before_kickoff
  ON public.los_picks FOR UPDATE
  USING (
    member_id = (SELECT id FROM public.members WHERE user_id = auth.uid() LIMIT 1)
    AND EXISTS (SELECT 1 FROM public.fixtures f WHERE f.id = fixture_id AND f.kickoff_time > now())
  );

-- Member SELECT own picks always; others' picks only for GWs where all fixtures kicked off
CREATE POLICY los_picks_select_member
  ON public.los_picks FOR SELECT
  USING (
    member_id = (SELECT id FROM public.members WHERE user_id = auth.uid() LIMIT 1)
    OR NOT EXISTS (
      SELECT 1 FROM public.fixtures f
      WHERE f.gameweek_id = los_picks.gameweek_id AND f.kickoff_time > now()
    )
  );

-- Admin full read
CREATE POLICY los_picks_select_admin
  ON public.los_picks FOR SELECT
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
```

### Pattern F: DB schema sketch for new tables
```sql
-- supabase/migrations/008_los_h2h.sql

BEGIN;

-- ─── los_competitions ─────────────────────────────────────────────
-- One row per LOS competition cycle. ~4-7 per season expected.
CREATE TABLE public.los_competitions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  season          int         NOT NULL,
  competition_num int         NOT NULL,                    -- 1, 2, 3... within season
  status          text        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'complete')),
  starts_at_gw    int         NOT NULL,                    -- gameweek.number
  ended_at_gw     int,                                     -- NULL until winner found
  winner_id       uuid        REFERENCES public.members(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  ended_at        timestamptz,
  UNIQUE (season, competition_num)
);

-- Only ONE active competition at a time (partial unique index)
CREATE UNIQUE INDEX los_competitions_one_active
  ON public.los_competitions (status)
  WHERE status = 'active';

-- ─── los_competition_members ──────────────────────────────────────
-- Tracks membership + elimination per competition cycle.
-- Eliminated members rejoin only when a new competition starts.
CREATE TABLE public.los_competition_members (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id    uuid        NOT NULL REFERENCES public.los_competitions(id) ON DELETE CASCADE,
  member_id         uuid        NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  status            text        NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active', 'eliminated')),
  eliminated_at_gw  int,                                -- gameweek.number when eliminated
  eliminated_reason text        CHECK (eliminated_reason IN ('draw', 'lose', 'missed', 'admin_override')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competition_id, member_id)
);

-- ─── los_picks ────────────────────────────────────────────────────
-- One pick per member per gameweek per competition.
-- fixture_id anchors to the specific match (handles postponements).
CREATE TABLE public.los_picks (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id  uuid        NOT NULL REFERENCES public.los_competitions(id) ON DELETE CASCADE,
  member_id       uuid        NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  gameweek_id     uuid        NOT NULL REFERENCES public.gameweeks(id) ON DELETE CASCADE,
  team_id         uuid        NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  fixture_id      uuid        NOT NULL REFERENCES public.fixtures(id) ON DELETE RESTRICT,
  outcome         text        CHECK (outcome IN ('win', 'lose', 'draw', 'pending') OR outcome IS NULL),
  evaluated_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competition_id, member_id, gameweek_id)
);
CREATE INDEX los_picks_competition_member_idx ON public.los_picks(competition_id, member_id);
CREATE INDEX los_picks_fixture_idx ON public.los_picks(fixture_id);

-- ─── h2h_steals ───────────────────────────────────────────────────
-- One row per detected tie. Resolves in subsequent gameweek.
CREATE TABLE public.h2h_steals (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  detected_in_gw_id uuid        NOT NULL REFERENCES public.gameweeks(id) ON DELETE CASCADE,
  resolves_in_gw_id uuid        NOT NULL REFERENCES public.gameweeks(id) ON DELETE CASCADE,
  position          int         NOT NULL CHECK (position IN (1, 2)),  -- 1=jackpot, 2=runner-up
  tied_member_ids   uuid[]      NOT NULL,
  winner_ids        uuid[],                               -- NULL until resolved; multiple = split
  resolved_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (detected_in_gw_id, position)
);

-- Extend admin_notifications type CHECK
ALTER TABLE public.admin_notifications DROP CONSTRAINT admin_notifications_type_check;
ALTER TABLE public.admin_notifications ADD CONSTRAINT admin_notifications_type_check
  CHECK (type IN (
    'new_signup','approval_needed','system',
    'sync_failure','fixture_rescheduled','fixture_moved',
    'result_override','scoring_complete',
    'bonus_reminder','gw_complete','prize_triggered','bonus_award_needed',
    -- Phase 8:
    'los_winner_found','los_competition_started','h2h_steal_detected','h2h_steal_resolved'
  ));

-- RLS enable
ALTER TABLE public.los_competitions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.los_competition_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.los_picks                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.h2h_steals               ENABLE ROW LEVEL SECURITY;

-- (policies listed in Pattern E above + similar for other tables)

COMMIT;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Track LOS manually in WhatsApp | Automated per-GW eval via sync pipeline | This phase | Removes George's manual weekly message; members see status in-app |
| Single "active" flag on members | Per-competition membership rows | — | Supports multiple cycles per season correctly; preserves history |
| Client-side team filtering | Server-side `availableTeams()` | — | Security + authoritative truth |
| Next.js 15 Pages Router | Next.js 16 App Router + Server Actions | Phase 1 | All new pages use `app/` directory; server actions with `'use server'` |

**Deprecated/outdated nothing** in this project stack for Phase 8. All infra proven.

## Open Questions

1. **Should the LOS pick picker be a Radix Select dropdown or a card grid of team badges?**
   - What we know: `@radix-ui/react-select` is already installed. Locked decision says "dropdown/list." Mobile is primary. ~20 teams max, filtered to available.
   - What's unclear: Visual preference — compact select vs. tap-friendly badge grid.
   - Recommendation: Radix Select for first implementation (fastest to ship + accessible). Revisit if George wants more visual polish after testing.

2. **Auto-reset or George-triggered reset?** (CONTEXT explicitly leaves to Claude's discretion)
   - What we know: ~4-7 competitions per season; George gets notification on winner found.
   - What's unclear: Does George want a "confirm new competition" click for control, or instant auto-restart?
   - Recommendation: **Auto-reset** with a notification + 7-day edit window where George can "undo" in the admin panel if needed. Simpler UX, respects "idiot-proof" constraint, George still has override.

3. **Postponed-fixture-pick handling — force re-pick or carry forward?**
   - What we know: CONTEXT says "pending" until fixture resolved. Teams table doesn't track postponements.
   - What's unclear: If Arsenal-Liverpool is postponed to next GW, does the member's pick stay on Arsenal for next GW (carry forward, locked), or is it voided (re-pick allowed)?
   - Recommendation: **Pick stays pending on original `los_picks` row** — when fixture finally FINISHES, eval fires normally. If fixture is CANCELLED or moved out of the competition window, George manually voids via admin override. Don't make members re-pick (they may not know their fixture moved).

4. **H2H steal resolution — full auto or George-confirm?**
   - What we know: Weekly jackpot confirmation is George-in-the-loop (bonuses, prizes patterns). The steal itself is automatic.
   - What's unclear: Should winner of a steal require George's confirmation (matching prize-award pattern), or is it a pure calc?
   - Recommendation: **Auto-detect + auto-resolve + notify George** (no manual confirmation needed). The math is objective — highest next-week scorer between tied members. If ties persist, split — also objective. Matches "remove manual load" core value. George can still see + override from admin.

5. **LOS standings ordering (discretionary)**
   - Recommendation: Order by (1) status (active first, eliminated after), (2) teams used count ascending (fewer used = more teams available). Alphabetical as tiebreaker.

6. **Should H2H get its own page or live as a banner on the gameweek page only?**
   - Recommendation: Admin sidebar: single "H2H & LOS" or two links — go with **two links** ("Last One Standing" + "H2H Steals") for clarity given competition importance. Members see H2H as a banner on the current gameweek page (not a separate page).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 + jsdom 29 + @testing-library/react 16 |
| Config file | `vitest.config.ts` (via `@vitejs/plugin-react`) |
| Quick run command | `npm run test -- <pattern>` |
| Full suite command | `npm run test:run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| LOS-01 | Member can include LOS team pick with prediction submission | integration (server action) | `npm run test -- tests/actions/predictions-los.test.ts` | ❌ Wave 0 |
| LOS-02 | Win progresses, draw/loss eliminates | unit (pure fn) | `npm run test -- tests/lib/los-evaluate.test.ts` | ❌ Wave 0 |
| LOS-03 | Team can't be reused until all 20 used | unit (pure fn) | `npm run test -- tests/lib/los-team-usage.test.ts` | ❌ Wave 0 |
| LOS-04 | Elimination + history tracked | integration (server action + DB RLS) | `npm run test -- tests/actions/admin/los.test.ts` | ❌ Wave 0 |
| LOS-05 | Missed round = elimination | unit (evaluateLosRound with missing submissions) | `npm run test -- tests/lib/los-evaluate.test.ts` | ❌ Wave 0 |
| LOS-06 | Winner → reset, teams available again | unit + integration | `npm run test -- tests/lib/los-competition.test.ts` | ❌ Wave 0 |
| LOS-07 | George admin view + override | integration (admin server action auth) | `npm run test -- tests/actions/admin/los.test.ts` | ❌ Wave 0 |
| H2H-01 | Ties detected on weekly totals | unit (pure fn detectWeeklyTies) | `npm run test -- tests/lib/h2h-detect-ties.test.ts` | ❌ Wave 0 |
| H2H-02 | Steal flagged for following GW | integration (sync pipeline call) | `npm run test -- tests/lib/sync-h2h.test.ts` | ❌ Wave 0 |
| H2H-03 | Resolution picks highest scorer or splits | unit (resolveSteal) | `npm run test -- tests/lib/h2h-resolve.test.ts` | ❌ Wave 0 |

Manual QA items (not automated — justification):
- **Visual LOS pick picker on mobile** (Radix Select behavior) — manual test on iOS Safari + Android Chrome. Radix maintains its own visual regression tests, not ours to replicate.
- **Notification visual on admin dashboard** — trivial and Phase 5 pattern is already tested.

### Sampling Rate
- **Per task commit:** `npm run test -- <file-being-modified>` — fast feedback
- **Per wave merge:** `npm run test:run` (full suite) — regression check
- **Phase gate:** Full suite green + manual mobile picker QA before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/lib/los-evaluate.test.ts` — covers LOS-02, LOS-05
- [ ] `tests/lib/los-team-usage.test.ts` — covers LOS-03
- [ ] `tests/lib/los-competition.test.ts` — covers LOS-06 (competition lifecycle / winner detection / reset)
- [ ] `tests/lib/h2h-detect-ties.test.ts` — covers H2H-01
- [ ] `tests/lib/h2h-resolve.test.ts` — covers H2H-03
- [ ] `tests/lib/sync-h2h.test.ts` — covers H2H-02 (pipeline integration mock)
- [ ] `tests/actions/predictions-los.test.ts` OR extend `tests/actions/predictions.test.ts` — covers LOS-01 (submission + mandatory enforcement + team-already-used rejection)
- [ ] `tests/actions/admin/los.test.ts` — covers LOS-04 + LOS-07 (admin override + reinstate + manual reset)
- [ ] Migration `supabase/migrations/008_los_h2h.sql` — new tables + RLS + admin_notifications CHECK extension
- [ ] No framework install needed — Vitest already configured and in use throughout project

## Sources

### Primary (HIGH confidence)
- `C:\Users\David\AI Projects\GSD Sessions\Georges Predictor\.planning\REQUIREMENTS.md` — phase requirements (LOS-01..07, H2H-01..03)
- `C:\Users\David\AI Projects\GSD Sessions\Georges Predictor\.planning\STATE.md` — established decisions, patterns, cumulative context
- `C:\Users\David\AI Projects\GSD Sessions\Georges Predictor\.planning\phases\08-last-one-standing-h2h\08-CONTEXT.md` — user decisions for this phase
- `C:\Users\David\AI Projects\GSD Sessions\Georges Predictor\.planning\config.json` — workflow config (nyquist_validation: true)
- `C:\Users\David\AI Projects\GSD Sessions\Georges Predictor\package.json` — confirmed stack versions
- `src/actions/predictions.ts` — submission action pattern (to extend)
- `src/lib/fixtures/sync.ts` — sync pipeline pattern (`detectNewlyFinished` exact idiom to mirror)
- `src/lib/scoring/recalculate.ts` — pure-function-plus-orchestrator pattern
- `src/components/predictions/prediction-form.tsx` — client form state pattern (bonus pick integration exact mirror)
- `src/components/admin/sidebar.tsx` — nav extension pattern
- `supabase/migrations/001_initial_schema.sql` through `007_mid_season_import.sql` — RLS + schema conventions
- `tests/lib/sync-scoring.test.ts` — test style for sync-pipeline pure helpers

### Secondary (MEDIUM confidence)
- @radix-ui/react-select — already installed, known-good accessible select pattern
- Next.js 16 App Router + Server Actions — established across all 7 previous phases

### Tertiary (LOW confidence)
- None — this phase is entirely on well-trodden codebase patterns; no new external libraries needed

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — reuse of existing libraries; no new deps needed
- Architecture: HIGH — mirrors established Phase 3/4/6 patterns exactly
- Pitfalls: HIGH — derived from real codebase constraints (RLS rules, sync idempotency, bonus confirmation flow, FIX-04 postponement handling)
- DB schema: HIGH — follows conventions of migrations 001–007 (UUID PKs, RLS, onConflict upserts, check constraints)
- UI recommendations: MEDIUM — functional path clear; visual polish discretionary (locked decisions explicitly allow this)

**Research date:** 2026-04-12
**Valid until:** 2026-05-12 (~30 days — stable codebase, no fast-moving external dependencies)
