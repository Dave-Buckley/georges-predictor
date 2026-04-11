---
phase: 03-predictions
verified: 2026-04-12T00:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 3: Predictions Verification Report

**Phase Goal:** Members can submit and edit their score predictions for open fixtures, and predictions become visible to all members at kick-off time. George can view all predictions at any time from the admin panel.
**Verified:** 2026-04-12
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A member can submit home/away score predictions for all unlocked fixtures in a gameweek | VERIFIED | `PredictionForm` + `PredictionInputs` render stepper inputs on each unlocked `FixtureCard`; `submitPredictions` server action upserts to DB via session client |
| 2 | A member can change their prediction for any fixture up until that fixture's kick-off | VERIFIED | Server action uses `canSubmitPrediction()` per-fixture lockout; button shows "Update Predictions" after first save; upsert-on-conflict handles edits |
| 3 | A member cannot see any other member's predictions until that fixture has kicked off | VERIFIED | `predictions_select_member` RLS policy: member reads own anytime OR any fixture where `kickoff_time <= now()` — pre-kickoff cross-member reads blocked at DB level |
| 4 | George can view all members' predictions for any fixture at any time | VERIFIED | `/admin/predictions/page.tsx` uses `createAdminClient()` (service role); `predictions_select_admin` RLS policy grants admin full read; grid table shows all members x all fixtures |
| 5 | A member who submits late can still predict remaining fixtures that have not yet kicked off | VERIFIED | `handleSubmit` in `PredictionForm` pre-filters for unfired kickoffs client-side; server action loops per fixture and skips locked ones silently; partial saves return `{ saved, skipped }` |

**Score: 5/5 truths verified**

---

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `supabase/migrations/003_predictions.sql` | VERIFIED | Exists; `predictions` table with UNIQUE(member_id,fixture_id), 4 RLS policies (insert/update/select-member/select-admin), two indexes, `predictions_set_updated_at` trigger, `get_gameweek_submission_count` RPC |
| `src/lib/validators/predictions.ts` | VERIFIED | Exports `predictionEntrySchema` (uuid fixture_id, coerce int 0-20 home/away), `submitPredictionsSchema` (gameweek 1-38 + min 1 entries), `PredictionEntry`, `SubmitPredictionsInput` types |
| `src/actions/predictions.ts` | VERIFIED | Exports `submitPredictions`; auth via `getUser()`, member approval check, Zod validation, per-fixture `canSubmitPrediction()` lockout, upsert with `onConflict: 'member_id,fixture_id'`, `revalidatePath` |
| `src/lib/supabase/types.ts` | VERIFIED | `PredictionRow` and `PredictionWithMember` interfaces present (lines 123–134+) |
| `tests/actions/predictions.test.ts` | VERIFIED | 262 lines; mocks Supabase client, lockout, and revalidatePath; covers all 8 behavior cases |
| `tests/lib/predictions.test.ts` | VERIFIED | 133 lines; covers predictionEntrySchema and submitPredictionsSchema validation cases |
| `src/components/predictions/prediction-inputs.tsx` | VERIFIED | 151 lines; stepper +/− buttons with `type="number" inputMode="numeric"` for phone keypad; null = empty input; `disabled` renders read-only; `hasSubmitted` adds green left border |
| `src/components/predictions/prediction-form.tsx` | VERIFIED | 236 lines; client-side state management, `handleSubmit` calls `submitPredictions`, auto-dismiss feedback banner, submission counter bar, sticky bottom button, "Submit" vs "Update" text |
| `src/components/fixtures/fixture-card.tsx` | VERIFIED | Accepts `prediction`, `onScoreChange`, `isLocked`, `hasSubmitted` props; renders `<PredictionInputs>` in prediction-area div when `onScoreChange` provided; backwards compatible |
| `src/components/fixtures/gameweek-view.tsx` | VERIFIED | Accepts `predictions`, `onScoreChange`, `submittedFixtureIds`; derives `isLocked` per fixture; passes prediction data + callbacks to each `FixtureCard` |
| `src/app/(member)/gameweeks/[gwNumber]/page.tsx` | VERIFIED | 167 lines; auth + member approval check, fetches existing predictions via `.eq('member_id').in('fixture_id')`, RPC for submission count, renders `<PredictionForm>` |
| `src/components/predictions/predictions-table.tsx` | VERIFIED | 158 lines; grid with sticky member name column, fixture columns with TLA headers, prediction cells "H-A" or "—", green cell highlight for correct scores, Submitted/Pending status pills |
| `src/app/(admin)/admin/predictions/page.tsx` | VERIFIED | Server component; `createAdminClient()` for all fetches; gameweek selector via URL `?gw=N`; summary stats (submitted/total/fixtures); full empty-state coverage |
| `src/app/(admin)/admin/predictions/gameweek-selector.tsx` | VERIFIED | Separate `'use client'` component; calls `router.push('/admin/predictions?gw=N')` on change |
| `src/components/admin/sidebar.tsx` | VERIFIED | Line 48: `label: 'All Predictions'` — renamed from "My Predictions" |

---

### Key Link Verification

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `src/actions/predictions.ts` | `src/lib/fixtures/lockout.ts` | `canSubmitPrediction()` call per fixture | WIRED | Import line 5 + call at line 76 |
| `src/actions/predictions.ts` | `src/lib/validators/predictions.ts` | Zod validation before DB write | WIRED | Import line 6 + `safeParse` at line 58 |
| `supabase/migrations/003_predictions.sql` | `public.fixtures` | RLS subquery on `kickoff_time` | WIRED | Lines 59, 78, 102 — `kickoff_time > now()` and `<= now()` in all relevant policies |
| `src/components/predictions/prediction-form.tsx` | `src/actions/predictions.ts` | `submitPredictions` server action call | WIRED | Import line 6 + `await submitPredictions(currentGw, validEntries)` at line 114 |
| `src/app/(member)/gameweeks/[gwNumber]/page.tsx` | `src/components/predictions/prediction-form.tsx` | `<PredictionForm>` rendered with fixtures, predictions, count | WIRED | Import line 5 + JSX at line 157 |
| `src/components/predictions/prediction-form.tsx` | `src/components/fixtures/fixture-card.tsx` | `onScoreChange` callback via GameweekView | WIRED | `GameweekView` receives `onScoreChange={handleScoreChange}` at line 171; passes to `FixtureCard` |
| `src/app/(admin)/admin/predictions/page.tsx` | `src/lib/supabase/admin.ts` | `createAdminClient()` for unrestricted reads | WIRED | Import line 2 + `createAdminClient()` at line 37 |
| `src/app/(admin)/admin/predictions/page.tsx` | `src/components/predictions/predictions-table.tsx` | `<PredictionsTable>` with all predictions data | WIRED | Import line 3 + JSX at line 195 |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PRED-01 | 03-01, 03-02 | Member can submit score predictions (home/away goals) for all fixtures in a gameweek | SATISFIED | `submitPredictions` action + `PredictionForm` + stepper inputs on each unlocked fixture card |
| PRED-02 | 03-01, 03-02 | Member can edit predictions any time before that fixture's kick-off | SATISFIED | Server upsert on `member_id,fixture_id`; `canSubmitPrediction()` enforces time gate; "Update Predictions" button text |
| PRED-03 | 03-01, 03-03 | Predictions hidden from all other members until all fixtures in the gameweek are complete | SATISFIED (with documented override) | `predictions_select_member` RLS: hides cross-member reads pre-kickoff. CONTEXT.md override: reveals at kick-off per fixture, not full gameweek completion — this is intentional and documented |
| PRED-04 | 03-03 | George can view all members' predictions at any time | SATISFIED | `createAdminClient()` service role on admin predictions page bypasses RLS; `predictions_select_admin` policy for JWT-authenticated admin reads |
| PRED-05 | 03-01, 03-02 | Late submissions accepted for remaining un-kicked-off fixtures only | SATISFIED | Per-fixture `canSubmitPrediction()` in server action; client-side pre-filter in `handleSubmit`; partial saves with `{ saved, skipped }` return |

**All 5 required requirements satisfied. No orphaned requirements for Phase 3.**

---

### Anti-Patterns Found

No stub patterns, empty implementations, or placeholder returns found in any phase 3 files. The two "placeholder" string hits in `prediction-inputs.tsx` are a JSDoc comment and a valid HTML input `placeholder="—"` attribute.

---

### Human Verification Required

#### 1. Prediction submission end-to-end flow

**Test:** Log in as an approved member, navigate to an active gameweek, enter scores for 2–3 fixtures using +/− steppers and direct typing, tap "Submit Predictions"
**Expected:** Button shows spinner, then success banner "Saved N predictions"; button text changes to "Update Predictions"; green left borders appear on saved fixture cards
**Why human:** Client state transitions, auto-dismiss timing, and visual indicator changes cannot be verified programmatically

#### 2. Locked fixture read-only display

**Test:** On a gameweek where some fixtures have already kicked off, navigate to that gameweek as a member
**Expected:** Past-kickoff fixtures show read-only score or "No prediction" text; no stepper buttons visible; amber warning banner visible if some (not all) are locked
**Why human:** Client-side `isLocked` derivation using `new Date()` comparison requires runtime state

#### 3. Submission counter accuracy

**Test:** With 2 members having submitted and 10 total approved members, check the "X of Y members have submitted" bar
**Expected:** Shows "2 of 10 members have submitted" — sourced from `get_gameweek_submission_count` RPC
**Why human:** Requires a populated Supabase instance; RPC behavior with real data cannot be tested statically

#### 4. Admin predictions grid with pre-kickoff data

**Test:** Log in as admin, go to /admin/predictions, select a gameweek where fixtures have NOT kicked off
**Expected:** George sees all members' submitted predictions (not blocked by RLS) — the grid shows scores for pre-kickoff fixtures
**Why human:** Requires a Supabase instance to confirm service-role bypass of RLS works correctly

#### 5. PRED-03 visibility reveal timing

**Test:** Submit a prediction for a fixture, wait for (or simulate) kick-off time, then log in as a different member
**Expected:** After kick-off, the other member can see your prediction score in the fixture card
**Why human:** Requires live Supabase instance + time-dependent RLS condition (`kickoff_time <= now()`)

---

### Notes on PRED-03 Implementation

The REQUIREMENTS.md states PRED-03 as "Predictions hidden from all other members until all fixtures in the gameweek are complete." The CONTEXT.md contains a deliberate documented override: visibility triggers at each fixture's individual kick-off, not when the full gameweek is complete. This decision is:

- Documented in `03-CONTEXT.md` ("OVERRIDES PRED-03")
- Noted in the `03-01-SUMMARY.md` decisions section
- Implemented correctly per the override in `predictions_select_member` RLS policy

The codebase correctly implements the intended behaviour as confirmed by George. This is a requirements refinement, not a gap.

---

## Summary

All 5 observable truths are verified. All 15 artifacts exist with substantive implementations (no stubs, no placeholders). All 8 key links are wired end-to-end. All 5 requirements (PRED-01 through PRED-05) are satisfied. Tests total 395 lines across two test files (262 + 133) covering validator and server action behaviour.

The phase goal is achieved: members can submit score predictions for fixtures via a polished stepper form, edit before kick-off, and George can view all predictions at any time from the admin panel via a scrollable grid table.

---

_Verified: 2026-04-12_
_Verifier: Claude (gsd-verifier)_
