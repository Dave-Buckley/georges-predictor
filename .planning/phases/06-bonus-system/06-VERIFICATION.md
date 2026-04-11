---
phase: 06-bonus-system
verified: 2026-04-12T00:00:00Z
status: passed
score: 19/19 must-haves verified
re_verification: false
---

# Phase 6: Bonus System Verification Report

**Phase Goal:** The weekly bonus system is fully operational — members pick which fixture their bonus applies to, George confirms before points are awarded, Golden Glory uses its separate formula, and Double Bubble doubles correctly.
**Verified:** 2026-04-12
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Members can query confirmed bonus_schedule rows to see the active bonus for a gameweek | VERIFIED | RLS policy `bonus_schedule_select_confirmed` in `006_bonus_member_rls.sql`; gameweek page fetches with `.eq('confirmed', true)` and passes `activeBonusType` to PredictionForm |
| 2 | calculateBonusPoints returns 20pts for Golden Glory correct result | VERIFIED | `evaluateGoldenGlory` in `calculate-bonus.ts` returns 20pts when `result_correct=true, score_correct=false`; test at line 32 |
| 3 | calculateBonusPoints returns 60pts for Golden Glory exact score | VERIFIED | Returns 60pts when `score_correct=true`; test at line 21 |
| 4 | calculateBonusPoints returns 20pts for Jose Park The Bus when condition met | VERIFIED | `evaluateJoseParkTheBus` returns 20pts for 0-0/1-0/0-1 scores with `score_correct=true`; tests lines 58–89 |
| 5 | calculateBonusPoints returns requires_manual_review=true for event-dependent bonus types | VERIFIED | Set membership check: anything not in `SCORE_EVALUABLE_BONUSES` returns `requires_manual_review: true`; tests cover Brace Yourself, Fergie Time, unknown types |
| 6 | calculateBonusPoints returns 0pts when condition is not met | VERIFIED | All evaluator functions return `points_awarded: 0` when condition fails |
| 7 | Members see the active bonus type name and description on the gameweek page | VERIFIED | `activeBonusType` prop populated server-side in page.tsx and rendered as bonus banner in prediction-form.tsx |
| 8 | Members can tap a star icon on a fixture card to select it as their bonus fixture | VERIFIED | `Star` icon button in `fixture-card.tsx` with 44px min tap target; `onBonusToggle` callback wired through GameweekView → PredictionForm |
| 9 | Only one fixture can be selected as bonus at a time — tapping another deselects the previous | VERIFIED | `handleBonusToggle` in prediction-form.tsx: `setBonusFixtureId((prev) => prev === fixtureId ? null : fixtureId)` |
| 10 | Submission is blocked with clear error when bonus active but no fixture selected | VERIFIED | Explicit guard in `handleSubmit`: `if (activeBonusType && !bonusFixtureId)` sets error message 'Pick your bonus fixture before submitting — tap the star icon on a fixture card.' |
| 11 | Bonus pick is saved alongside predictions via the same Submit Predictions button | VERIFIED | `submitPredictions(currentGw, validEntries, bonusFixtureId)` call in prediction-form.tsx; server action upserts `bonus_awards` row in Step 6 |
| 12 | Bonus pick is skipped entirely when no confirmed bonus exists for the gameweek | VERIFIED | `activeBonusType` is null when no confirmed schedule row; no stars shown, no validation, `bonusFixtureId` passed as null |
| 13 | Golden Glory gameweeks show distinct gold visual treatment on the bonus banner | VERIFIED | `isGoldenGlory` flag in prediction-form.tsx, fixture-card.tsx; gold gradient border + yellow-400 filled star + "GOLDEN GLORY Bonus" badge |
| 14 | When a fixture finishes, bonus points are auto-calculated for members who picked that fixture | VERIFIED | Step 4 in `recalculateFixture` queries `bonus_awards`, calls `calculateBonusPoints`, updates `points_awarded` |
| 15 | Bonus points only appear in member totals after George explicitly confirms (awarded=true) | VERIFIED | `computeDisplayTotal` only adds bonusPoints when `bonusConfirmed=true`; pending bonus shown in UI but excluded from displayTotal |
| 16 | Double Bubble doubles all points (base + confirmed bonus) at display time | VERIFIED | `computeDisplayTotal(basePoints, bonusPoints, bonusConfirmed, isDoubleBubble)` returns `rawTotal * 2` when `isDoubleBubble=true`; never stores doubled values |
| 17 | Sticky footer shows before/after bonus breakdown: base pts, bonus pts (pending/confirmed), and Double Bubble multiplied total | VERIFIED | Multi-line footer in prediction-form.tsx: Line 1 base pts, Line 2 bonus pts with green/amber/red status, Line 3 awaiting result, divider + GW total with "x 2" indicator and formula |
| 18 | Bonus recalculation is idempotent — safe to re-run for same fixture | VERIFIED | `recalculateFixture` uses UPDATE on `points_awarded` only; prediction_scores upsert is idempotent; confirmed/rejected awards are skipped |
| 19 | Bonus pick lockout: member cannot change bonus pick after chosen fixture kicks off | VERIFIED | Server: `canSubmitPrediction(bonusFixtureId)` check before upsert; client: kickoff guard in handleSubmit |

**Score:** 19/19 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/006_bonus_member_rls.sql` | Member RLS policies + points_awarded column | VERIFIED | Contains `ALTER TABLE bonus_awards ADD COLUMN IF NOT EXISTS points_awarded`, policies: `bonus_schedule_select_confirmed`, `bonus_awards_insert_own`, `bonus_awards_update_own`, `bonus_awards_select_own` |
| `src/lib/scoring/calculate-bonus.ts` | Pure bonus calculation, zero imports | VERIFIED | 157 lines, zero imports, exports `calculateBonusPoints` and `computeDisplayTotal` |
| `tests/lib/scoring-bonus.test.ts` | Unit tests for all branches | VERIFIED | 207 lines, 18 tests covering Golden Glory (3), Jose Park The Bus (6), event-dependent (3), computeDisplayTotal (6) |
| `src/lib/supabase/types.ts` | BonusAwardRow with points_awarded; BonusAwardWithType | VERIFIED | `points_awarded: number` on BonusAwardRow (line 219); `BonusAwardWithType extends BonusAwardRow { bonus_type: BonusTypeRow }` (line 269) |
| `src/lib/validators/bonuses.ts` | submitBonusPickSchema | VERIFIED | Exported at line 76 with `gameweek_id` and `fixture_id` UUID fields; `SubmitBonusPickInput` type also exported |
| `src/actions/predictions.ts` | Extended submitPredictions with bonusFixtureId | VERIFIED | Third param `bonusFixtureId: string | null = null`; UUID guard; lockout check; bonus_awards upsert using session client (RLS enforced); returns `bonusSaved: boolean` |
| `src/components/predictions/prediction-form.tsx` | Bonus state, banner, mandatory validation | VERIFIED | 420 lines; `activeBonusType`, `existingBonusPick`, `bonusAwardDisplay` props; `bonusFixtureId` state; `handleBonusToggle`; Double Bubble banner; bonus banner; mandatory validation guard; `computeDisplayTotal` used for footer |
| `src/components/fixtures/fixture-card.tsx` | Star icon bonus pick tap target | VERIFIED | 310 lines; `isBonusPick`, `onBonusToggle`, `bonusActive`, `isGoldenGlory` props; star button with 44px min tap target; `isTerminal` gate |
| `src/components/fixtures/gameweek-view.tsx` | Bonus props threaded to FixtureCard | VERIFIED | All four bonus props in interface; threaded to each FixtureCard in midweek and weekend loops |
| `src/app/(member)/gameweeks/[gwNumber]/page.tsx` | Server-side bonus_schedule + bonus_awards fetch | VERIFIED | Fetches `bonus_schedule` with joined `bonus_types`; fetches `bonus_awards.fixture_id, awarded, points_awarded`; passes `activeBonusType`, `existingBonusPick`, `bonusAwardDisplay` to PredictionForm |
| `src/lib/scoring/recalculate.ts` | Extended recalculation with bonus calculation | VERIFIED | Imports `calculateBonusPoints`; Step 4 queries `bonus_awards` for finished fixture; calls `calculateBonusPoints`; updates `points_awarded`; never touches `awarded` field; `bonus_calculated` counter in RecalcResult |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `src/lib/scoring/calculate-bonus.ts` | `src/lib/scoring/calculate.ts` | Same pure function pattern — zero imports, zero side effects | VERIFIED | calculate-bonus.ts has zero imports, pure exports only |
| `supabase/migrations/006_bonus_member_rls.sql` | `supabase/migrations/005_admin_panel.sql` | `ALTER TABLE bonus_awards ADD COLUMN points_awarded` | VERIFIED | Line 16-17: `ALTER TABLE public.bonus_awards ADD COLUMN IF NOT EXISTS points_awarded int NOT NULL DEFAULT 0` |
| `src/components/predictions/prediction-form.tsx` | `src/actions/predictions.ts` | `submitPredictions(currentGw, validEntries, bonusFixtureId)` | VERIFIED | Line 161 in prediction-form.tsx: `await submitPredictions(currentGw, validEntries, bonusFixtureId)` |
| `src/components/predictions/prediction-form.tsx` | `src/components/fixtures/fixture-card.tsx` | `isBonusPick` and `onBonusToggle` props | VERIFIED | Props passed through GameweekView; onBonusToggle={handleBonusToggle} in GameweekView call |
| `src/app/(member)/gameweeks/[gwNumber]/page.tsx` | `src/components/predictions/prediction-form.tsx` | `activeBonusType` and `existingBonusPick` props | VERIFIED | Lines 246-248 in page.tsx pass all three bonus props |
| `src/lib/scoring/recalculate.ts` | `src/lib/scoring/calculate-bonus.ts` | `import { calculateBonusPoints } from './calculate-bonus'` | VERIFIED | Line 12 in recalculate.ts; function called at line 125 |
| `src/lib/scoring/recalculate.ts` | `bonus_awards` table | `UPDATE bonus_awards SET points_awarded WHERE fixture_id = fixtureId` | VERIFIED | Lines 132-138: `.update({ points_awarded: bonusResult.points_awarded }).eq('id', award.id)` |
| `src/components/predictions/prediction-form.tsx` | `src/lib/scoring/calculate-bonus.ts` | `import { computeDisplayTotal }` | VERIFIED | Line 7 import; called at line 210 with all four parameters |

---

## Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| BONUS-01 | 06-01, 06-02 | George sets the active bonus type before each gameweek commences | SATISFIED | RLS policy exposes confirmed bonus to members; page fetches and displays `activeBonusType` (Phase 5 admin-side setting retained) |
| BONUS-02 | 06-02 | Members make their bonus pick during prediction submission | SATISFIED | Star icon on fixture cards, single-fixture selection state, pick submitted with predictions |
| BONUS-03 | 06-01, 06-03 | Standard bonuses award 20pts if chosen condition is met | SATISFIED | Jose Park The Bus evaluator returns 20pts; triggered by `recalculateFixture` on fixture completion |
| BONUS-04 | 06-01, 06-03 | Golden Glory uses separate formula — 20pts correct result, 60pts correct score | SATISFIED | `evaluateGoldenGlory` implements exact formula; triggered by `recalculateFixture` |
| BONUS-05 | 06-03 | Double Bubble — George toggles double points for designated gameweeks | SATISFIED | `computeDisplayTotal` applies `* 2` multiplier at display time; `gameweek.double_bubble` prop drives banner and footer formula |
| BONUS-06 | 06-02, 06-03 | Two-phase confirmation — member picks bonus, George confirms before points applied | SATISFIED | Bonus saved with `awarded: null`; `bonusConfirmed` only true when `awarded === true`; `computeDisplayTotal` excludes pending bonuses from total |
| BONUS-07 | 06-03 | Points shown before and after bonus application | SATISFIED | Sticky footer: Line 1 base pts, Line 2 bonus pts with status colour, divider + total with "x 2" and formula |

All 7 BONUS-* requirements for Phase 6 are SATISFIED. No orphaned requirements found.

---

## Anti-Patterns Found

No blocker anti-patterns found in Phase 6 files.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/lib/supabase/types.ts` | 283 | `export type Database = any` | Info | Pre-existing placeholder comment noting it should be replaced by generated Supabase types — not introduced by Phase 6 and does not affect bonus functionality |

---

## Human Verification Required

The following items require manual testing since they cannot be verified programmatically:

### 1. Star Icon Visual Rendering

**Test:** Open a gameweek page with an active confirmed bonus. Verify star icons appear on each unlocked fixture card. Tap one — confirm it fills gold/amber. Tap a different one — confirm previous deselects. Tap the same one — confirm it deselects.
**Expected:** Single-selection toggle behaviour with filled/outline visual feedback
**Why human:** DOM rendering and touch interaction cannot be verified from source code alone

### 2. Golden Glory Visual Differentiation

**Test:** Set up a gameweek with Golden Glory as the confirmed bonus. Open the gameweek page. Verify the bonus banner is gold gradient (not purple), the star is yellow-400, the selected fixture card has a yellow-400 left border, and the badge reads "Golden Glory Bonus" with "20pts correct result · 60pts exact score!" hint.
**Expected:** Distinct gold visual treatment throughout — banner, star, card border, badge
**Why human:** CSS gradient and colour rendering requires visual inspection

### 3. Double Bubble Banner Visibility

**Test:** Open a gameweek where `double_bubble = true`. Verify the amber/orange "DOUBLE BUBBLE WEEK" banner appears above the bonus banner, and the sticky footer shows the "x 2" multiplier label and the `(base + bonus) x 2` formula.
**Expected:** Banner visible; footer shows multiplied total and formula
**Why human:** Conditional rendering requires a live gameweek with `double_bubble=true`

### 4. Bonus Confirmation Two-Phase Flow (George's side)

**Test:** As a member, submit predictions with a bonus pick. As George (admin), open the bonus awards panel. Verify the pending award is visible. Confirm it. Reload the member's gameweek page. Verify bonus points now appear as confirmed (green) and are included in the displayed total.
**Expected:** Points excluded from total when pending; included when George confirms
**Why human:** Multi-user flow across member and admin sessions requires live environment

### 5. Submission Blocked When Bonus Not Selected

**Test:** Open a gameweek with an active bonus, enter prediction scores, tap Submit without selecting a bonus fixture. Verify the error toast "Pick your bonus fixture before submitting — tap the star icon on a fixture card." appears and submission is blocked.
**Expected:** Clear error, no submission
**Why human:** Form interaction and toast display requires browser testing

---

## Gaps Summary

No gaps found. All must-haves are verified at all three levels (exists, substantive, wired). All 7 BONUS-* requirements are satisfied. The phase goal is fully achieved.

---

_Verified: 2026-04-12_
_Verifier: Claude (gsd-verifier)_
