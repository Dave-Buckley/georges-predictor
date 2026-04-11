# Phase 6: Bonus System - Research

**Researched:** 2026-04-12
**Domain:** Bonus pick UI, bonus calculation engine, Double Bubble multiplier, Supabase RLS extensions
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Bonus pick is mandatory — submission blocked with clear error if no fixture selected ("Pick your bonus fixture before submitting")
- Bonus pick submitted together with predictions — one "Submit Predictions" button (extends Phase 3 pattern)
- Member can change their bonus pick after submitting, same rules as predictions — editable until the selected fixture kicks off
- Show the pre-populated bonus type even before George confirms it — members pick based on that. If George changes it, picks are cleared and members are notified (Phase 5 decision)
- Standard bonuses: 20pts if the chosen fixture meets the bonus condition
- Golden Glory: 20pts correct result, 60pts correct score on chosen fixture (NOT the standard 10/30 formula)
- Bonus points calculated automatically when fixture results come in (extends Phase 4 sync-trigger pattern)
- Bonus points stored in bonus_awards.points_awarded — NOT added to prediction_scores
- No bonus points appear in member's total until George explicitly confirms the award (BONUS-06)
- Double Bubble doubles ALL points for the gameweek (base + bonus) — applied at display time, not stored as doubled values
- GW10, GW20, GW30 Double Bubble pre-set; George can toggle any GW

### Claude's Discretion
- Bonus pick interaction pattern (star icon, radio button, or highlight — most user-friendly for mobile casual users)
- Points before/after bonus layout
- Golden Glory visual distinction (different colour, icon, card treatment)
- Double Bubble visual treatment (badge, banner, or colour on gameweek page)
- Bonus condition evaluation logic per bonus type — what's feasible with football-data.org free tier vs manual confirmation by George
- How to handle bonus picks on fixtures that get postponed/rescheduled
- Empty state when bonus type doesn't apply to a gameweek

### Deferred Ideas (OUT OF SCOPE)
- H2H Steal detection and resolution — Phase 8
- Last One Standing tracking — Phase 8
- Pre-season predictions — Phase 9
- Weekly PDF/XLSX reports with bonus breakdown — Phase 10
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BONUS-01 | George sets the active bonus type before each gameweek commences | Already built in Phase 5 (setBonusForGameweek action, bonus_schedule table, confirmed flag). Phase 6 extends the member-facing read side — add RLS SELECT policy on bonus_schedule for confirmed rows. |
| BONUS-02 | Members make their bonus pick during prediction submission (which game the bonus applies to) | Extend submitPredictions action to accept bonus_fixture_id. Extend prediction-form.tsx client state. Add bonus pick UI to GameweekView/fixture cards. Extend bonus_awards for member INSERT. |
| BONUS-03 | Standard bonuses award 20pts if the chosen condition is met | New calculateBonusPoints pure function. Most bonus conditions require George's manual confirmation due to free-tier API limitations (see Critical Finding below). |
| BONUS-04 | Golden Glory bonus uses separate scoring formula — 20pts correct result, 60pts correct score on chosen game | Handled in calculateBonusPoints with bonus_type name check. Uses existing prediction_scores result_correct / score_correct flags. |
| BONUS-05 | Double Bubble — George toggles double points for designated gameweeks | gameweeks.double_bubble already exists. Phase 6 applies the multiplier at display/total calculation time. Extend sticky footer and totals query. |
| BONUS-06 | Two-phase confirmation — member picks bonus, George confirms before points are applied | bonus_awards.awarded tri-state (NULL/true/false) already built. Phase 6: bonus points only included in totals when awarded=true. Member sees "pending" state. |
| BONUS-07 | Points shown before and after bonus application | Extend sticky footer total to show base pts, bonus pts (pending/confirmed), and Double Bubble multiplied total. All computed from existing data. |
</phase_requirements>

---

## Summary

Phase 6 has strong foundations from Phase 5. The `bonus_awards`, `bonus_schedule`, and `bonus_types` tables are already built and seeded. The admin confirmation actions are complete. What remains is the member-facing half: the bonus pick UI integrated into prediction submission, the bonus point calculation engine, Double Bubble display logic, and the before/after points breakdown.

**Critical finding:** football-data.org free tier provides NO match event data (no goal scorers, no substitutes, no bookings, no in-play events). This means bonus conditions that require player-level data (Brace Yourself, Fergie Time, Shane Long, Pop Up Trent, Pay The Penalty, Captain Fantastic, Super Sub, Roy Keane, Klopp Trumps) cannot be evaluated automatically. Only score-derived conditions (Golden Glory, Jose Park The Bus, Alan Shearer, London Derby) can be auto-evaluated when results come in. All other bonuses require George to evaluate and manually confirm via the existing admin confirmation flow.

**Primary recommendation:** Implement a two-tier bonus evaluation model — auto-evaluate score-derivable bonuses when fixture results sync, flag all event-dependent bonuses as requiring George's manual review. The member-facing experience is identical regardless of evaluation method (they pick a fixture, see pending status, then confirmed points appear). The planner should implement this as separate calculation paths in the bonus calculation engine.

---

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| Next.js | 16.2.3 | App Router, server actions | Extend existing submitPredictions action |
| Supabase | @supabase/supabase-js ^2.103 | DB queries, RLS | Add member RLS policies on bonus tables |
| Zod | ^4.3.6 | Input validation | Extend bonuses validator with member pick schema |
| Vitest | ^4.1.4 | Tests | Tests alongside implementation (TDD pattern) |
| Tailwind CSS | ^4 | UI styling | Mobile-first, extend fixture card patterns |
| lucide-react | ^1.8.0 | Icons | Star icon available for bonus pick indicator |
| @radix-ui/react-dialog | ^1.1.15 | Modals | Available if bonus type info tooltip/modal needed |

### No new dependencies needed
All required libraries are already installed. Phase 6 is purely extension work.

---

## Architecture Patterns

### Recommended File Structure
```
src/
├── lib/
│   └── scoring/
│       ├── calculate.ts          # EXISTING — pure base scoring
│       ├── calculate-bonus.ts    # NEW — pure bonus scoring (same pattern as calculate.ts)
│       └── recalculate.ts        # EXISTING — extend to trigger bonus calc
├── actions/
│   ├── predictions.ts            # EXISTING — extend to accept bonus_fixture_id
│   └── member/
│       └── bonuses.ts            # NEW — submitBonusPick server action (or merge into predictions.ts)
├── components/
│   └── predictions/
│       ├── prediction-form.tsx   # EXISTING — add bonusFixtureId state + validation
│       ├── bonus-pick-bar.tsx    # NEW — shows active bonus, fixture selector
│       └── bonus-points-row.tsx  # NEW — shows bonus pts before/after confirmation
├── app/
│   └── (member)/gameweeks/[gwNumber]/
│       └── page.tsx              # EXISTING — fetch bonus_schedule + bonus_awards, pass down
└── supabase/migrations/
    └── 006_bonus_member_rls.sql  # NEW — member RLS policies + points_awarded column
```

### Pattern 1: Pure Bonus Calculation Function (mirrors calculate.ts)
**What:** Zero-import, zero-side-effect function computing bonus points from a bonus type name and a prediction score row.
**When to use:** Called from recalculate trigger when fixture result arrives, for auto-evaluable bonus types.

```typescript
// src/lib/scoring/calculate-bonus.ts
// Source: models Phase 4's calculatePoints pattern exactly

export type BonusResult = {
  bonus_type: string
  fixture_id: string
  condition_met: boolean
  points_awarded: 0 | 20 | 60
  requires_manual_review: boolean
}

/**
 * Calculates bonus points for a single member's bonus pick.
 * Returns requires_manual_review=true for event-dependent bonus types
 * that cannot be evaluated from score data alone.
 *
 * Auto-evaluable: Golden Glory, Jose Park The Bus, Alan Shearer (partial — see note),
 *                 London Derby (requires fixture metadata)
 * Manual review:  Brace Yourself, Fergie Time, Shane Long, Pop Up Trent,
 *                 Pay The Penalty, Captain Fantastic, Super Sub, Pep Talk,
 *                 Klopp Trumps, Roy Keane
 */
export function calculateBonusPoints(
  bonusTypeName: string,
  prediction: { result_correct: boolean; score_correct: boolean },
  actualScore: { home: number; away: number },
): BonusResult
```

### Pattern 2: Extend submitPredictions to Accept Bonus Pick
**What:** Add `bonus_fixture_id` to the action signature. Upsert `bonus_awards` row using member's session client after prediction upsert succeeds.
**When to use:** Member submits predictions — bonus pick saved atomically with predictions.

```typescript
// Extend submitPredictions signature
export async function submitPredictions(
  gameweekNumber: number,
  entries: Array<{ fixture_id: string; home_score: number; away_score: number }>,
  bonusFixtureId: string | null,  // NEW — null only if no bonus active this GW
): Promise<{ success?: boolean; saved: number; skipped: number; bonusSaved: boolean; error?: string }>
```

Key constraint: Bonus pick lockout mirrors prediction lockout — the chosen fixture's `kickoff_time` must be in the future. If the chosen fixture has already kicked off, block the pick change server-side (same `canSubmitPrediction` helper).

### Pattern 3: Bonus Pick UI — Fixture Highlight (Claude's Discretion recommendation)
**What:** Each fixture card gets a star-button tap target (top-right corner). Tapping selects that fixture as the bonus target. Selected fixture gets a coloured ring and "BONUS" badge. Only one fixture can be selected at a time.
**When to use:** Mobile-first design for casual non-technical members.

Design rationale:
- Star icon (lucide `Star`) is universally understood, single tap, large enough touch target
- Coloured ring on selection (amber/gold for standard bonuses, yellow shimmer for Golden Glory) provides clear visual feedback
- No separate step or dialog needed — pick inline with predictions
- Matches the "one button submit" locked decision

**Golden Glory variant:** When this bonus is active, the card treatment uses a gold gradient border + "60pts for exact score!" inline hint.

### Pattern 4: RLS Additions (migration 006)
**What:** New member-facing RLS policies on `bonus_schedule` and `bonus_awards`.
**New policies needed:**

```sql
-- Members can SELECT confirmed bonus schedule rows (to see active bonus)
CREATE POLICY bonus_schedule_select_confirmed
  ON public.bonus_schedule FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND confirmed = true
  );

-- Members can INSERT their own bonus_awards row
CREATE POLICY bonus_awards_insert_own
  ON public.bonus_awards FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND member_id = (
      SELECT id FROM public.members WHERE user_id = auth.uid() LIMIT 1
    )
  );

-- Members can UPDATE their own bonus_awards row (change pick before kickoff)
CREATE POLICY bonus_awards_update_own
  ON public.bonus_awards FOR UPDATE
  USING (
    auth.role() = 'authenticated'
    AND member_id = (
      SELECT id FROM public.members WHERE user_id = auth.uid() LIMIT 1
    )
    AND awarded IS NULL  -- cannot change after George has confirmed/rejected
  );

-- Members can SELECT their own bonus_awards row (to see pick + pending/confirmed status)
CREATE POLICY bonus_awards_select_own
  ON public.bonus_awards FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND member_id = (
      SELECT id FROM public.members WHERE user_id = auth.uid() LIMIT 1
    )
  );
```

Also add `points_awarded` column to `bonus_awards` (currently missing — needed to store calculated bonus points):

```sql
ALTER TABLE public.bonus_awards
  ADD COLUMN IF NOT EXISTS points_awarded int NOT NULL DEFAULT 0;
```

### Pattern 5: Double Bubble at Display Time
**What:** `gameweek.double_bubble` flag already exists. Apply multiplier when computing totals for display — never stored as doubled values.
**Implementation:** Extend the sticky footer total computation in `prediction-form.tsx` and the server-side `totalPoints` computation in the gameweek page.

```typescript
// Pattern: totalPoints with Double Bubble
const basePoints = Object.values(scoreBreakdowns).reduce((sum, s) => sum + s.points_awarded, 0)
const bonusPoints = bonusAward?.awarded === true ? (bonusAward.points_awarded ?? 0) : 0
const rawTotal = basePoints + bonusPoints
const displayTotal = gameweek.double_bubble ? rawTotal * 2 : rawTotal

// Breakdown for display
// "Base: 40 pts + Bonus: 20 pts = 60 pts × 2 (Double Bubble) = 120 pts"
```

### Anti-Patterns to Avoid
- **Storing doubled values in DB:** Double Bubble is display-only. Raw points are always stored. Recalculation after toggling Double Bubble on/off must not corrupt data.
- **Trusting client-passed member_id for bonus_awards:** Always resolve from `auth.uid()` server-side, same as predictions.
- **Using admin client for bonus pick INSERT:** Must use member's session client so RLS policies enforce self-ownership.
- **Blocking submission when no bonus is active for the GW:** If `bonus_schedule` has no confirmed row for the gameweek, the bonus pick requirement should be skipped entirely (the pick is only mandatory when a bonus IS active).
- **Auto-applying bonus points to totals:** bonus_awards.awarded must be `true` (not just calculated) before points appear in any total.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Bonus condition evaluation for event-dependent types | Custom scraper / third-party API | George's manual confirmation via existing admin confirmBonusAward action (already built) |
| Bonus pick UI from scratch | New form component | Extend existing prediction-form.tsx + GameweekView state (same client component pattern) |
| Bonus award storage | New table design | bonus_awards table already exists with correct schema — just needs points_awarded column and member RLS |
| Score-derived bonus evaluation | Complex new engine | calculateBonusPoints pure function that reads from existing prediction_scores (result_correct, score_correct flags already stored) |
| Double Bubble UI from scratch | New animation/indicator | Extend existing sticky footer + add gameweek-level banner using existing amber/orange Tailwind colour palette (already used in the existing Double Bubble info callout in bonuses page) |

---

## Common Pitfalls

### Pitfall 1: bonus_awards Missing points_awarded Column
**What goes wrong:** The existing `bonus_awards` table schema (migration 005) has no `points_awarded` column. Trying to store calculated bonus points will fail with a column-not-found error.
**Why it happens:** Phase 5 built the table for confirmation state only; the calculation engine is Phase 6's job.
**How to avoid:** Migration 006 MUST add `points_awarded int NOT NULL DEFAULT 0` to `bonus_awards` before any bonus calculation code runs.
**Warning signs:** TypeScript errors on `BonusAwardRow.points_awarded`, Supabase insert errors at runtime.

### Pitfall 2: Blocking Submission When No Active Bonus Exists
**What goes wrong:** If bonus pick is always required but the gameweek has no confirmed bonus_schedule row, every member's submission is blocked with a confusing error.
**Why it happens:** The mandatory pick rule assumes a bonus is always active, but early gameweeks or mid-season may have no confirmed bonus.
**How to avoid:** Server action checks for confirmed bonus_schedule row first. If none exists, bonusFixtureId validation is skipped. UI shows "No bonus active this gameweek" state.

### Pitfall 3: Bonus Pick Lockout Not Mirroring Prediction Lockout
**What goes wrong:** Member changes their bonus pick to a fixture after it has kicked off. The system accepts it.
**Why it happens:** Forgetting to apply the same `kickoff_time <= now()` server-side guard to bonus_awards UPDATE as is applied to predictions.
**How to avoid:** Reuse `canSubmitPrediction(fixture_id)` check in the bonus pick server action before upserting bonus_awards.

### Pitfall 4: Double-Awarding Bonus Points on Fixture Result Rescoring
**What goes wrong:** When `recalculateFixture` is called multiple times (e.g., after a result override), bonus points are recalculated and added repeatedly.
**Why it happens:** No idempotency guard on bonus calculation, unlike `prediction_scores` which uses upsert on `prediction_id`.
**How to avoid:** Bonus calculation uses UPDATE (not INSERT) on the existing `bonus_awards` row. The row already exists from the member's pick; calculation only updates `points_awarded`. Upsert with `onConflict: 'gameweek_id,member_id'` is safe.

### Pitfall 5: Using Admin Client for Member Bonus Pick Insert
**What goes wrong:** Bonus picks are inserted via admin client, bypassing RLS. Any member could theoretically modify another member's bonus pick if the action has a bug.
**Why it happens:** Developers copy the admin pattern from `recalculateFixture` or admin bonus actions.
**How to avoid:** The `submitPredictions` extension (or new `submitBonusPick` action) MUST use `createServerSupabaseClient()` (member session client), same as the current predictions action. RLS `bonus_awards_insert_own` policy provides the DB-level enforcement.

### Pitfall 6: Golden Glory Evaluated Against Standard Scoring Formula
**What goes wrong:** Golden Glory awards 10/30pts using the base formula instead of the 20/60pt formula.
**Why it happens:** Calculating bonus using `prediction_scores.points_awarded` directly rather than re-evaluating with the Golden Glory formula.
**How to avoid:** `calculateBonusPoints` receives `bonusTypeName` and branches explicitly for `'Golden Glory'`: `result_correct → 20`, `score_correct → 60` (overrides standard). Verified by test cases.

### Pitfall 7: Double Bubble Applied to Stored Data
**What goes wrong:** After George toggles Double Bubble on, a re-run of totals writes doubled values to prediction_scores, corrupting all future calculations.
**Why it happens:** Multiplier applied in the recalculation engine rather than at display/query time.
**How to avoid:** Double Bubble multiplier ONLY appears in the `displayTotal` computed variable in client components and server-side total queries. Never applied in `recalculateFixture` or `calculateBonusPoints`.

### Pitfall 8: Race Condition — Bonus Pick Submitted After Fixture Kicks Off
**What goes wrong:** Member submits predictions + bonus pick together; the chosen fixture kicks off between client validation and server processing; the pick is stored against a fixture that has already kicked off.
**Why it happens:** Network delay between the client-side lockout check and the server-side upsert.
**How to avoid:** Server-side `canSubmitPrediction` check on the bonus_fixture_id in the action (same guard already used for predictions). This is already the established two-layer pattern.

---

## Code Examples

### Auto-Evaluable Bonus Types — Decision Table

Score-only data available after fixture result syncs:

| Bonus Type | Auto-Evaluable? | Evaluation Logic |
|------------|-----------------|-----------------|
| Golden Glory | YES | result_correct → 20pts, score_correct → 60pts |
| Jose Park The Bus | YES | score is 0-0 or 1-0 or 0-1 → condition_met |
| Alan Shearer | PARTIAL | Highest scoring game in GW — needs all GW fixtures to finish first |
| London Derby | YES (if fixture tagged) | fixture metadata (home/away team city) — needs team metadata flag |
| Brace Yourself | NO | Requires goal scorer data (not in free tier) |
| Fergie Time | NO | Requires in-play time events (not in free tier) |
| Shane Long | NO | Requires first goal time (not in free tier) |
| Pop Up Trent | NO | Requires scorer position data (not in free tier) |
| Pay The Penalty | NO | Requires match events (not in free tier) |
| Captain Fantastic | NO | Requires lineup + scorer data (not in free tier) |
| Super Sub | NO | Requires substitution data (not in free tier) |
| Pep Talk | NO | Requires head coach of winning team (not in free tier) |
| Klopp Trumps | NO | Requires possession stats (not in free tier, not even in standard paid tier without add-on) |
| Roy Keane | NO | Requires booking data (not in free tier) |

**Recommendation for planner:** All 14 bonus types flow through George's manual confirmation. Auto-evaluation of Golden Glory and Jose Park The Bus is a nice-to-have but should be implemented as an opt-in enhancement, not a required feature, to keep Phase 6 scope manageable. The existing `confirmBonusAward` admin action handles all cases.

### calculateBonusPoints Pure Function Skeleton

```typescript
// Source: models calculate.ts from Phase 4
// src/lib/scoring/calculate-bonus.ts

export type BonusEvalResult = {
  condition_met: boolean
  points_awarded: 0 | 20 | 60
  requires_manual_review: boolean
}

// Bonus types that can be evaluated purely from score data
const SCORE_EVALUABLE = new Set([
  'Golden Glory',
  'Jose Park The Bus',
])

export function calculateBonusPoints(
  bonusTypeName: string,
  scoreResult: { result_correct: boolean; score_correct: boolean },
  actualScore: { home: number; away: number },
): BonusEvalResult {
  if (!SCORE_EVALUABLE.has(bonusTypeName)) {
    return { condition_met: false, points_awarded: 0, requires_manual_review: true }
  }

  if (bonusTypeName === 'Golden Glory') {
    if (scoreResult.score_correct) return { condition_met: true, points_awarded: 60, requires_manual_review: false }
    if (scoreResult.result_correct) return { condition_met: true, points_awarded: 20, requires_manual_review: false }
    return { condition_met: false, points_awarded: 0, requires_manual_review: false }
  }

  if (bonusTypeName === 'Jose Park The Bus') {
    const { home, away } = actualScore
    const isParkTheBus =
      (home === 0 && away === 0) ||
      (home === 1 && away === 0) ||
      (home === 0 && away === 1)
    return {
      condition_met: isParkTheBus && scoreResult.score_correct,
      points_awarded: isParkTheBus && scoreResult.score_correct ? 20 : 0,
      requires_manual_review: false,
    }
  }

  return { condition_met: false, points_awarded: 0, requires_manual_review: true }
}
```

### Extending submitPredictions for Bonus Pick

```typescript
// Extension pattern — add to existing submitPredictions action
// After successful prediction upserts, upsert bonus_awards row

if (bonusFixtureId) {
  // Verify fixture hasn't kicked off
  const lockout = await canSubmitPrediction(bonusFixtureId)
  if (lockout.canSubmit) {
    // Fetch active bonus for this gameweek
    const { data: bonusSchedule } = await supabase
      .from('bonus_schedule')
      .select('bonus_type_id')
      .eq('gameweek_id', gameweek.id)
      .eq('confirmed', true)
      .single()

    if (bonusSchedule) {
      await supabase
        .from('bonus_awards')
        .upsert(
          {
            gameweek_id: gameweek.id,
            member_id: member.id,
            bonus_type_id: bonusSchedule.bonus_type_id,
            fixture_id: bonusFixtureId,
            awarded: null,  // always pending until George confirms
          },
          { onConflict: 'gameweek_id,member_id' }
        )
    }
  }
}
```

### Double Bubble Total Calculation (display time only)

```typescript
// In prediction-form.tsx or gameweek page server component

const basePoints = Object.values(scoreBreakdowns)
  .reduce((sum, s) => sum + s.points_awarded, 0)

const bonusPoints = bonusAward?.awarded === true
  ? (bonusAward.points_awarded ?? 0)
  : 0

const rawTotal = basePoints + bonusPoints
const isDoubleBubble = gameweek.double_bubble

const displayTotal = isDoubleBubble ? rawTotal * 2 : rawTotal

// Sticky footer breakdown string:
// Standard: "GW12 Total: 40 pts"
// With pending bonus: "GW12 Total: 40 pts (+ bonus pending)"
// With confirmed bonus: "GW12 Total: 40 + 20 = 60 pts"
// With Double Bubble: "GW12 Total: (40 + 20) × 2 = 120 pts"
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Manual bonus administration with spreadsheets | Two-phase digital flow: member picks → George confirms | George's workload shifts from manual calculation to just clicking confirm |
| All bonus types custom-evaluated | Score-derivable types auto-calculated; event types flagged for George | Reduces George's review burden for Golden Glory and Jose Park The Bus weeks |

---

## Open Questions

1. **Alan Shearer bonus evaluation**
   - What we know: "Predict the highest scoring match of the gameweek" — evaluable from scores
   - What's unclear: When is "highest scoring match" deterministic? Only after ALL gameweek fixtures finish. Partial results could give false positives mid-GW.
   - Recommendation: Treat Alan Shearer as manual review for Phase 6. George can confirm once the GW is complete. Auto-evaluation can be added in a future phase.

2. **London Derby metadata**
   - What we know: Requires knowing which matches are London derbies (both teams from London)
   - What's unclear: No `is_london_derby` flag in current fixture/team schema
   - Recommendation: Treat as manual review for Phase 6. If needed later, add a `city` column to `teams` table or a fixture metadata flag.

3. **Postponed fixture handling for bonus pick**
   - What we know: FIX-04 built voiding/reassigning for postponed fixtures
   - What's unclear: If a member picks a fixture that gets postponed, what happens to their bonus pick? Does the pick become void? Can they re-pick?
   - Recommendation (Claude's discretion): If the chosen fixture is voided (`status = 'POSTPONED'`), the bonus_awards row should be flagged as pick_invalid. George is already notified about postponements. He can reject the bonus award via existing confirmBonusAward action. Display a "Your chosen fixture was postponed — bonus pick invalid this week" message to the member.

4. **bonus_awards row creation timing**
   - What we know: Current schema has UNIQUE(gameweek_id, member_id) on bonus_awards
   - What's unclear: Should the row be created when member submits predictions (with fixture_id), or should a placeholder row exist before that?
   - Recommendation: Create on member submission only (no placeholder). The upsert pattern handles both first-time pick and updates.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.4 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run tests/lib/scoring-bonus.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BONUS-01 | Confirmed bonus_schedule row readable by members | unit (RLS) | `npx vitest run tests/lib/bonus-rls.test.ts` | Wave 0 |
| BONUS-02 | submitPredictions accepts + saves bonus_fixture_id | unit | `npx vitest run tests/actions/predictions.test.ts` | Extend existing |
| BONUS-02 | Bonus pick blocked after chosen fixture kicks off | unit | `npx vitest run tests/actions/predictions.test.ts` | Wave 0 test case |
| BONUS-02 | Submission blocked when bonus active but no fixture selected | unit | `npx vitest run tests/actions/predictions.test.ts` | Wave 0 test case |
| BONUS-03 | calculateBonusPoints returns 20pts for standard bonus (Golden Glory result) | unit | `npx vitest run tests/lib/scoring-bonus.test.ts` | Wave 0 |
| BONUS-03 | calculateBonusPoints returns 0pts when condition not met | unit | `npx vitest run tests/lib/scoring-bonus.test.ts` | Wave 0 |
| BONUS-03 | calculateBonusPoints returns requires_manual_review=true for event-dependent types | unit | `npx vitest run tests/lib/scoring-bonus.test.ts` | Wave 0 |
| BONUS-04 | calculateBonusPoints returns 60pts for Golden Glory exact score | unit | `npx vitest run tests/lib/scoring-bonus.test.ts` | Wave 0 |
| BONUS-04 | calculateBonusPoints returns 20pts for Golden Glory correct result | unit | `npx vitest run tests/lib/scoring-bonus.test.ts` | Wave 0 |
| BONUS-04 | calculateBonusPoints returns 0pts for Golden Glory wrong result | unit | `npx vitest run tests/lib/scoring-bonus.test.ts` | Wave 0 |
| BONUS-05 | displayTotal doubles when gameweek.double_bubble=true | unit | `npx vitest run tests/lib/scoring-bonus.test.ts` | Wave 0 |
| BONUS-05 | displayTotal unchanged when gameweek.double_bubble=false | unit | `npx vitest run tests/lib/scoring-bonus.test.ts` | Wave 0 |
| BONUS-06 | Bonus points excluded from total when awarded=null (pending) | unit | `npx vitest run tests/lib/scoring-bonus.test.ts` | Wave 0 |
| BONUS-06 | Bonus points included in total when awarded=true | unit | `npx vitest run tests/lib/scoring-bonus.test.ts` | Wave 0 |
| BONUS-07 | Sticky footer shows correct before/after bonus breakdown | integration | manual visual check | N/A |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/lib/scoring-bonus.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/lib/scoring-bonus.test.ts` — covers BONUS-03, BONUS-04, BONUS-05, BONUS-06 (pure function tests for calculateBonusPoints and Double Bubble display logic)
- [ ] `tests/actions/predictions.test.ts` — extend existing file with bonus pick cases (BONUS-02)
- [ ] `tests/lib/bonus-rls.test.ts` — member RLS SELECT policy on bonus_schedule (BONUS-01) — if integration test infrastructure allows; otherwise manual Supabase RLS test

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection of `src/actions/admin/bonuses.ts` — all admin bonus actions verified
- Direct code inspection of `supabase/migrations/005_admin_panel.sql` — full schema for bonus tables
- Direct code inspection of `src/lib/scoring/calculate.ts` + `recalculate.ts` — pure function pattern
- Direct code inspection of `src/components/predictions/prediction-form.tsx` — existing form extension points
- Direct code inspection of `src/lib/supabase/types.ts` — BonusAwardRow, BonusScheduleRow shapes
- `package.json` — confirmed no new dependencies needed

### Secondary (MEDIUM confidence)
- football-data.org pricing page (fetched 2026-04-12) — confirmed free tier excludes match events, lineups, goal scorers, substitutions, bookings
- football-data.org API documentation (fetched 2026-04-12) — confirmed free tier restrictions on match sub-resources

### Tertiary (LOW confidence — plan accordingly)
- Bonus condition evaluation logic for Alan Shearer, London Derby — derived from score data analysis (not verified against George's specific rules)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — inspected package.json directly; no new installs needed
- Schema/existing infrastructure: HIGH — inspected all migration files and types
- Bonus calculation engine design: HIGH — derived directly from existing calculate.ts pattern
- football-data.org free tier limitations: HIGH — verified against official pricing page 2026-04-12
- UI/UX patterns: MEDIUM — Claude's discretion areas; recommendations based on existing component patterns
- Bonus condition auto-evaluation scope: HIGH — verified API limitations; all event-dependent types are manual

**Research date:** 2026-04-12
**Valid until:** 2026-07-12 (stable stack; football-data.org pricing changes would affect API findings)
