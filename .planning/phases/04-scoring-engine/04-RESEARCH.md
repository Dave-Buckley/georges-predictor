# Phase 4: Scoring Engine - Research

**Researched:** 2026-04-12
**Domain:** Score calculation, sync pipeline extension, Supabase RLS, Next.js server actions
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Result Fetching & Triggers**
- Use the existing fixture sync process — enhance it to also trigger point calculation when a fixture status changes to FINISHED (no separate result-fetching job)
- Auto-sync runs on a schedule during match windows, plus George can hit Sync Now for immediate results
- Points calculated instantly and automatically when a FINISHED result comes in — no manual confirmation step
- George can review scores after the fact and correct if the API got it wrong
- When George corrects a score, all affected predictions are recalculated instantly

**Points Display for Members**
- Points shown inline on each fixture card — next to the prediction, members see: predicted score, actual score, and points awarded (e.g., "Predicted 2-1 → Actual 2-1 → Correct Score = 30pts")
- "Live" means refresh to see latest — page shows current points when loaded, member refreshes to check again. No auto-refresh, no websockets.
- Sticky footer total at the bottom of the gameweek page — always visible as you scroll through fixtures, updates as more results come in across the gameweek

**George's Manual Override Flow**
- George enters/corrects results on the admin gameweek page — navigates to the gameweek, sees fixtures with current scores, clicks a fixture to edit
- Confirmation dialog shows impact preview: "Changing Arsenal 2-1 Chelsea to 2-2. This affects 43 predictions. Recalculate?" — George sees exactly what will happen before confirming
- Each result shows a source badge ("API" or "Manual") so George knows which came from the system vs his overrides
- Admin audit log records every override: "George changed Arsenal 2-1 → 2-2 on [date]. 43 predictions recalculated." Visible in admin only — members just see updated points.

**Calculation Breakdown Storage**
- Full breakdown stored per prediction: predicted score, actual score, whether result direction was correct (W/D/L match), whether exact score matched, points awarded (0, 10, or 30)
- Members see the full breakdown inline on each fixture card — clear, no ambiguity
- Breakdown is a permanent record — not derived on the fly

### Claude's Discretion
- Auto-sync frequency during match windows (balance freshness vs football-data.org free tier API limits)
- Recalculation approach (synchronous vs queued — likely synchronous given ~50 members)
- Database schema for the scores/breakdown table
- Fixture card layout for showing prediction + result + points breakdown
- Admin gameweek page result-editing UI design
- Audit log storage and display format
- How to handle in-progress matches (IN_PLAY status) — show partial results or wait for FINISHED
- Error handling for API failures during auto-sync

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SCORE-01 | Match results auto-pulled from football-data.org API | Existing `sync.ts` already fetches `score.fullTime.home/away`; enhancement adds FINISHED-status trigger to `calculateScores()` |
| SCORE-02 | George can manually enter or override match results | `editFixture` server action already edits scores; Phase 4 adds override-specific path with impact count preview and audit log entry |
| SCORE-03 | Automatic point calculation — 10pts correct result, 30pts correct score | Pure function `calculatePoints()` with deterministic logic; called from sync trigger and from override action |
| SCORE-04 | Live points display per prediction as results come in, with gameweek total at bottom | `fixture-card.tsx` prediction area extended with result + points row; `gameweek-view.tsx` gets sticky footer via `position: sticky` on a div |
| SCORE-05 | Full calculation breakdown stored per prediction (not just final totals) | New `prediction_scores` table (one row per prediction, permanent record); queried server-side and passed to `FixtureCard` |
| SCORE-06 | Members see calculated points for each score as predictions are entered (once results are in) | Same as SCORE-04 — points surface when `prediction_scores` row exists for that fixture |
</phase_requirements>

---

## Summary

Phase 4 builds the core value engine of the entire application. All the technical infrastructure exists — the sync pipeline already fetches full-time scores, the predictions table is in place, and the fixture card has a dedicated prediction area ready to extend. The work is: (1) wire up a `calculateScores()` function into `sync.ts` after fixture upserts, (2) create a `prediction_scores` table to permanently store per-prediction breakdowns, (3) extend the fixture card to show the breakdown, and (4) add a result-override flow with audit trail to the admin gameweek page.

The scoring logic is deterministic and isolated: compare predicted outcome direction (H/D/A) against actual outcome direction — 10pts if match, 0 if not; then compare predicted exact score — bonus 20pts if exact match (total 30pts). This pure function has no side effects and is trivially unit-testable. It runs synchronously because at ~50 members per fixture, a single gameweek recalculation involves at most 500 rows — well within synchronous budget.

The only meaningful technical design decision is the `prediction_scores` table schema. It needs to be self-contained (full breakdown, not derived) and support the audit requirement. The admin audit log for overrides should be a separate `result_overrides` table rather than using the existing `admin_notifications` table — notifications are ephemeral read/dismiss flows, while audit records must be permanent and queryable.

**Primary recommendation:** Extend `sync.ts` to call `calculateScores(fixtureId)` when a fixture transitions to FINISHED; store permanent breakdowns in `prediction_scores`; display inline on fixture cards; wire admin override with confirmation dialog and audit log.

---

## Standard Stack

### Core (already in the project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.3 | Server actions, page rendering | Already in use — all mutations via server actions |
| Supabase | @supabase/supabase-js ^2.103.0 | Database, RLS | Already in use — admin client bypasses RLS for scoring writes |
| Zod | ^4.3.6 | Input validation | Already in use — all validator schemas in `src/lib/validators/` |
| Vitest | ^4.1.4 | Unit testing | Already configured — pure scoring function is ideal test target |

### No New Libraries Required
The scoring engine requires zero new dependencies. All operations are:
- Pure TypeScript arithmetic (no math library needed)
- Supabase queries (already available)
- Next.js server actions + revalidatePath (already used throughout)
- Zod validation (already in use)

The only new file types are: a new lib module (`src/lib/scoring/`), a new server action (`src/actions/admin/scoring.ts`), a new migration (`supabase/migrations/004_scoring.sql`), and UI extensions to existing components.

---

## Architecture Patterns

### Recommended Project Structure (additions only)
```
src/
├── lib/
│   └── scoring/
│       ├── calculate.ts     # Pure function: calculatePoints(predicted, actual) -> PointsResult
│       └── recalculate.ts   # DB orchestration: recalculateFixture(fixtureId) -> RecalcResult
├── actions/
│   └── admin/
│       └── scoring.ts       # Server action: overrideResult(formData) with auth + audit
├── components/
│   ├── fixtures/
│   │   └── fixture-card.tsx # EXTEND: add result + points breakdown row
│   └── predictions/
│       └── prediction-form.tsx # EXTEND: pass scores down; sticky total footer
supabase/
└── migrations/
    └── 004_scoring.sql      # prediction_scores table + result_overrides audit table
tests/
└── lib/
    └── scoring.test.ts      # Unit tests for calculatePoints() pure function
```

### Pattern 1: Pure Scoring Function (Isolated, Testable)
**What:** The point calculation lives in a pure function with no DB access — takes predicted scores and actual scores, returns a breakdown object.
**When to use:** Called from sync trigger, admin override action, and future bonus system (Phase 6 extends it).

```typescript
// src/lib/scoring/calculate.ts
export interface PointsResult {
  predicted_home: number
  predicted_away: number
  actual_home: number
  actual_away: number
  result_correct: boolean    // W/D/L direction matched
  score_correct: boolean     // exact scoreline matched
  points_awarded: number     // 0, 10, or 30
}

function getOutcome(home: number, away: number): 'H' | 'D' | 'A' {
  if (home > away) return 'H'
  if (home < away) return 'A'
  return 'D'
}

export function calculatePoints(
  predicted: { home: number; away: number },
  actual: { home: number; away: number }
): PointsResult {
  const resultCorrect = getOutcome(predicted.home, predicted.away) === getOutcome(actual.home, actual.away)
  const scoreCorrect = predicted.home === actual.home && predicted.away === actual.away

  let points = 0
  if (scoreCorrect) points = 30        // exact score: 30pts total (includes result)
  else if (resultCorrect) points = 10  // correct result only: 10pts

  return {
    predicted_home: predicted.home,
    predicted_away: predicted.away,
    actual_home: actual.home,
    actual_away: actual.away,
    result_correct: resultCorrect,
    score_correct: scoreCorrect,
    points_awarded: points,
  }
}
```

### Pattern 2: Recalculation Orchestrator (DB-Aware)
**What:** Separate module that queries all predictions for a fixture, calls calculatePoints for each, and upserts results into prediction_scores. Returns a summary.
**When to use:** Called from sync.ts after FINISHED detection, and from the admin override action.

```typescript
// src/lib/scoring/recalculate.ts
export interface RecalcResult {
  fixture_id: string
  predictions_scored: number
  errors: string[]
}

export async function recalculateFixture(
  fixtureId: string,
  homeScore: number,
  awayScore: number
): Promise<RecalcResult>
```

### Pattern 3: Sync Integration (Extend, Not Replace)
**What:** After the fixture upsert loop in `sync.ts`, detect which fixtures transitioned to FINISHED status in this sync and trigger recalculation for each.
**When to use:** This is the primary auto-scoring trigger.

Key insight: the sync already writes `home_score` and `away_score` to the `fixtures` table. The enhancement queries previous status before upsert and compares — if a fixture just became FINISHED, call `recalculateFixture()`.

Implementation approach:
1. Before the upsert batch, query current statuses of all external_ids being updated
2. Build a `previousStatusMap: Map<number, string>` (external_id → old status)
3. After the upsert, compare incoming status vs previous — collect fixtures that are now FINISHED
4. For each newly FINISHED fixture, resolve its UUID and call `recalculateFixture()`
5. Add scoring summary to SyncResult: `scored_fixtures: number`

### Pattern 4: Admin Override with Impact Preview + Audit
**What:** Two-step server action: first call returns impact count (how many predictions will be recalculated), second call applies the change and writes audit log.
**When to use:** Admin gameweek page result override flow.

```typescript
// Two separate server actions:
// 1. getOverrideImpact(fixtureId) -> { prediction_count: number, current_score: string }
// 2. applyResultOverride(fixtureId, homeScore, awayScore) -> { success, recalculated: number }
//    - updates fixture home_score/away_score + source = 'manual'
//    - calls recalculateFixture()
//    - writes to result_overrides audit table
```

### Pattern 5: Fixture Card Points Display
**What:** Extend the existing `FixtureCard` component to show a breakdown row below the prediction inputs area when a `scoreBreakdown` prop is provided.
**When to use:** When fixture is FINISHED and member has a prediction with a stored breakdown.

The fixture card currently renders a `<div className="mt-3 prediction-area">` which shows `PredictionInputs` when `onScoreChange` is provided. The extension adds a second conditional render inside this area: when `scoreBreakdown` prop is present, show the result + points row. When `onScoreChange` is absent (read-only mode), show just the breakdown without inputs.

### Anti-Patterns to Avoid
- **Deriving points on the fly:** Never calculate points at render time from raw prediction + fixture data. Points must be read from `prediction_scores` table — this is the permanent record requirement (SCORE-05).
- **Single points column on predictions table:** Do not add a `points` column to the `predictions` table. The breakdown belongs in a separate `prediction_scores` table — adding columns to `predictions` would make the breakdown non-atomic and harder to audit.
- **Recalculating all gameweek predictions on every sync:** Only recalculate fixtures that transitioned to FINISHED in this sync run. Recalculating all FINISHED fixtures every sync would be wasteful and could overwrite manual overrides.
- **Using admin_notifications for audit log:** The admin_notifications table is designed for ephemeral read/dismiss events. Override audit records need to be permanent and queryable. Use a separate `result_overrides` table.
- **Trusting IN_PLAY scores:** football-data.org returns partial scores for IN_PLAY matches. Never calculate points for an IN_PLAY fixture — only trigger on FINISHED status transition.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| W/D/L outcome comparison | Custom result comparison | Simple 3-branch `getOutcome()` helper | Trivial with helper; don't over-engineer |
| Async queue for recalculation | BullMQ, pg_cron, Redis queue | Synchronous await loop | ~50 members × 10 fixtures = 500 rows max; sync is fine on Vercel Hobby |
| Real-time updates | WebSockets, SSE, Supabase Realtime | Page refresh (force-dynamic) | Locked decision; Supabase Realtime is not needed |
| Sticky footer | Custom IntersectionObserver | CSS `position: sticky` + `bottom-0` | Already used for the submit button; same pattern |

**Key insight:** The scoring logic is simple arithmetic. The risk is in database correctness (upsert idempotency, not double-scoring) and UI accuracy (always reading from stored breakdown, never recomputing). Keep calculation logic in a pure function and orchestration in a single recalculate module.

---

## Common Pitfalls

### Pitfall 1: Double-Scoring on Re-sync
**What goes wrong:** Sync runs every N minutes. A fixture is FINISHED. Each sync run triggers recalculation again, potentially overwriting manual override points.
**Why it happens:** Naive "recalculate all FINISHED" approach without checking whether this is a new transition.
**How to avoid:** Track previous status before upsert. Only call `recalculateFixture()` when a fixture transitions FROM a non-FINISHED status TO FINISHED in the current sync run. Use `ON CONFLICT DO UPDATE` on `prediction_scores` — upsert is idempotent, but only call it when appropriate.
**Warning signs:** `prediction_scores` rows updated more frequently than expected; manual override values being reset.

### Pitfall 2: Recalculating When Scores Are Null
**What goes wrong:** A fixture has status FINISHED but `home_score` or `away_score` is null (API returns status before scores).
**Why it happens:** football-data.org can set status=FINISHED before populating the score fields in rare edge cases.
**How to avoid:** Guard in `recalculateFixture()` — return early if either score is null. Only calculate when both scores are non-null integers.
**Warning signs:** `points_awarded` of 0 for all predictions on a fixture that should have results.

### Pitfall 3: RLS Blocking Admin Scoring Writes
**What goes wrong:** `recalculateFixture()` called with a user session client instead of admin client — RLS blocks the `prediction_scores` insert/upsert.
**Why it happens:** Confusing which client to use; sync.ts already uses admin client but scoring code added separately might use server client.
**How to avoid:** `recalculateFixture()` must always use `createAdminClient()` — members don't write to prediction_scores, only the system does. Document this at the function level.
**Warning signs:** Silent failures — RLS returns an empty error result without clear message.

### Pitfall 4: Impact Count Race Condition on Override
**What goes wrong:** George requests impact count ("43 predictions"), waits, then confirms. Between the two requests, more predictions come in or are voided, making the count stale.
**Why it happens:** Two-step preview flow with time gap between steps.
**How to avoid:** The impact count is informational — it doesn't need to be exact. Re-query at confirmation time and show actual count in the success toast. This is acceptable UX given George's non-technical audience.
**Warning signs:** Not a bug — the confirmation should say "Recalculated X predictions" (actual count), not "Recalculated 43 predictions" (stale count).

### Pitfall 5: football-data.org API Rate Limits During Match Window
**What goes wrong:** Multiple sync triggers during a match window hit the free tier limit (10 req/min), causing 429 errors.
**Why it happens:** If the Vercel cron runs every 5 minutes and each sync call is one API request, it's well within limits. But if sync fails and is retried, it can spike.
**How to avoid:** `sync.ts` already uses a single `/v4/competitions/PL/matches` endpoint (one API call for all 380 fixtures). One call per sync = safe on free tier. The existing error handling already logs failures to sync_log — no retry loop needed.
**Warning signs:** `sync_log` rows with 429 error messages; `admin_notifications` of type `sync_failure`.

### Pitfall 6: Supabase Free Tier pg_cron Availability
**What goes wrong:** Planning to use pg_cron for scheduled syncs, then discovering it's not available on the Supabase free tier.
**Why it happens:** pg_cron is a Supabase paid feature. STATE.md lists this as an unresolved concern.
**How to avoid:** Use Vercel Cron Jobs (defined in `vercel.json`) to call the `/api/sync-fixtures` route on a schedule. This is the correct free-tier approach — no pg_cron needed. The route already exists and is protected.
**Warning signs:** STATE.md blocker: "Confirm Supabase pg_cron is available on free tier" — this research confirms use Vercel Cron instead.

---

## Code Examples

### Database Schema: 004_scoring.sql

```sql
-- prediction_scores: permanent breakdown per prediction
CREATE TABLE public.prediction_scores (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id   uuid        NOT NULL REFERENCES public.predictions(id) ON DELETE CASCADE,
  fixture_id      uuid        NOT NULL REFERENCES public.fixtures(id)   ON DELETE CASCADE,
  member_id       uuid        NOT NULL REFERENCES public.members(id)    ON DELETE CASCADE,
  predicted_home  int         NOT NULL,
  predicted_away  int         NOT NULL,
  actual_home     int         NOT NULL,
  actual_away     int         NOT NULL,
  result_correct  boolean     NOT NULL,
  score_correct   boolean     NOT NULL,
  points_awarded  int         NOT NULL CHECK (points_awarded IN (0, 10, 30)),
  calculated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prediction_id)  -- one score row per prediction
);

-- result_overrides: permanent audit log for admin manual overrides
CREATE TABLE public.result_overrides (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id    uuid        NOT NULL REFERENCES public.fixtures(id) ON DELETE CASCADE,
  changed_by    uuid        NOT NULL REFERENCES auth.users(id),
  old_home      int,
  old_away      int,
  new_home      int         NOT NULL,
  new_away      int         NOT NULL,
  predictions_recalculated int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Add result_source column to fixtures table (tracks API vs Manual)
ALTER TABLE public.fixtures
  ADD COLUMN result_source text CHECK (result_source IN ('api', 'manual'));
```

### Vercel Cron Configuration (vercel.json extension)
```json
{
  "crons": [
    {
      "path": "/api/sync-fixtures",
      "schedule": "*/15 * * * *"
    }
  ]
}
```
Every 15 minutes covers all match windows. The free tier of football-data.org allows 10 req/min — one call per sync is well within limits. During dead periods (no live matches) this is wasteful but harmless.

### Sync.ts Extension: FINISHED Transition Detection
```typescript
// Before the upsert batch, query previous statuses
const { data: previousStatuses } = await adminClient
  .from('fixtures')
  .select('external_id, status')
  .in('external_id', fixtureRows.map(r => r.external_id))

const prevStatusMap = new Map<number, string>()
for (const row of (previousStatuses ?? [])) {
  prevStatusMap.set(row.external_id, row.status)
}

// After the upsert succeeds, find newly FINISHED fixtures
const newlyFinished = fixtureRows.filter(row => {
  const prevStatus = prevStatusMap.get(row.external_id)
  return row.status === 'FINISHED'
    && prevStatus !== 'FINISHED'
    && row.home_score !== null
    && row.away_score !== null
})
```

### RLS Policies for prediction_scores
```sql
-- Members can read their own scores
CREATE POLICY scores_select_own
  ON public.prediction_scores FOR SELECT
  USING (
    member_id = (
      SELECT m.id FROM public.members m WHERE m.user_id = auth.uid() LIMIT 1
    )
  );

-- Members can read scores for fixtures that have kicked off (all members)
CREATE POLICY scores_select_post_kickoff
  ON public.prediction_scores FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.fixtures f
      WHERE f.id = fixture_id AND f.kickoff_time <= now()
    )
  );

-- Admin reads all scores
CREATE POLICY scores_select_admin
  ON public.prediction_scores FOR SELECT
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- No member writes — system only (service role bypasses RLS)
-- result_overrides: admin read only
CREATE POLICY overrides_select_admin
  ON public.result_overrides FOR SELECT
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
```

### Sticky Gameweek Total Footer
```typescript
// In GameweekView or wrapping div in gameweek page
// Total is server-computed: sum of points_awarded for member × this gameweek's fixtures

// Server page queries:
const { data: scoresData } = await supabase
  .from('prediction_scores')
  .select('points_awarded, fixture_id')
  .eq('member_id', memberData.id)
  .in('fixture_id', fixtureIds)

const totalPoints = (scoresData ?? []).reduce((sum, s) => sum + s.points_awarded, 0)
const scoredFixtures = (scoresData ?? []).length

// Rendered as a sticky div at bottom of gameweek page (not inside GameweekView)
// <div className="sticky bottom-0 ...">
//   <span>Gameweek {gwNum} total: {totalPoints} pts</span>
//   <span>({scoredFixtures} of {fixtures.length} results in)</span>
// </div>
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| Vercel Serverless Cron (paid) | Vercel Hobby Cron Jobs (free) | Vercel Hobby now includes cron jobs in `vercel.json` — confirmed free tier feature |
| pg_cron (Supabase) | Vercel Cron | Supabase pg_cron requires Pro plan; Vercel cron is the correct free alternative |
| Supabase Realtime subscriptions | force-dynamic + page refresh | Locked decision — no websockets; `export const dynamic = 'force-dynamic'` already used on gameweek page |

**Deprecated/outdated:**
- pg_cron for scheduling: Not available on Supabase free tier — use Vercel Cron + `/api/sync-fixtures` route

---

## Open Questions

1. **Vercel Hobby Cron Schedule Limits**
   - What we know: Vercel Hobby plan supports cron jobs in vercel.json
   - What's unclear: Whether Hobby is limited to daily crons (some sources suggest minimum 1-day interval on Hobby)
   - Recommendation: Verify at deployment time. If Hobby is limited to daily crons, the fallback is George's manual "Sync Now" button (which already exists and works) plus a reminder to tap it after matches. This is acceptable for the use case — George watches matches and knows when they end.

2. **football-data.org FINISHED Status Lag**
   - What we know: The API uses status=FINISHED for completed matches; score fields are populated at the same time based on existing client code
   - What's unclear: Whether there is a delay between match end and API updating to FINISHED
   - Recommendation: This is not a code problem — the sync trigger fires when the API says FINISHED. If there's a lag, the next sync cycle will catch it. Document expected lag in admin UI ("Results may take up to 15 minutes to appear after match ends").

3. **IN_PLAY Score Display**
   - What we know: The fixture card already shows live scores for IN_PLAY fixtures (from `fixture.home_score`/`away_score`)
   - What's unclear: Whether members should see a partial "in progress" state for their prediction during IN_PLAY (e.g., greyed out score preview vs nothing)
   - Recommendation (Claude's discretion): Show nothing for points when IN_PLAY — only show the final breakdown when FINISHED. Avoid confusing members with provisional points. The existing LIVE badge and live score already communicate "in progress."

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.4 |
| Config file | `vitest.config.ts` (exists) |
| Quick run command | `npx vitest run tests/lib/scoring.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCORE-03 | `calculatePoints()` awards 30pts for exact score | unit | `npx vitest run tests/lib/scoring.test.ts` | ❌ Wave 0 |
| SCORE-03 | `calculatePoints()` awards 10pts for correct result only | unit | `npx vitest run tests/lib/scoring.test.ts` | ❌ Wave 0 |
| SCORE-03 | `calculatePoints()` awards 0pts for wrong result | unit | `npx vitest run tests/lib/scoring.test.ts` | ❌ Wave 0 |
| SCORE-03 | `calculatePoints()` handles 0-0 draw prediction correctly | unit | `npx vitest run tests/lib/scoring.test.ts` | ❌ Wave 0 |
| SCORE-02 | `applyResultOverride()` rejects non-admin callers | unit | `npx vitest run tests/actions/admin/scoring.test.ts` | ❌ Wave 0 |
| SCORE-02 | `applyResultOverride()` writes to result_overrides audit table | unit | `npx vitest run tests/actions/admin/scoring.test.ts` | ❌ Wave 0 |
| SCORE-01 | Sync pipeline calls recalculation after FINISHED transition | unit | `npx vitest run tests/lib/fixtures.test.ts` | ✅ (extend) |
| SCORE-05 | `recalculateFixture()` upserts to prediction_scores with full breakdown | unit | `npx vitest run tests/lib/scoring.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/lib/scoring.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/lib/scoring.test.ts` — covers SCORE-03, SCORE-05 (pure function + recalculate)
- [ ] `tests/actions/admin/scoring.test.ts` — covers SCORE-02 (override action auth + audit)
- [ ] Extend `tests/lib/fixtures.test.ts` — add test for FINISHED-transition scoring trigger in sync

*(Existing test infrastructure covers all other requirements — no new framework config needed)*

---

## Sources

### Primary (HIGH confidence)
- Codebase: `src/lib/fixtures/sync.ts` — sync pipeline structure, upsert pattern, notification pattern
- Codebase: `src/lib/fixtures/football-data-client.ts` — score field paths (`score.fullTime.home/away`)
- Codebase: `supabase/migrations/002_fixture_layer.sql` — fixtures table schema, RLS patterns, existing constraints
- Codebase: `supabase/migrations/003_predictions.sql` — predictions table, RLS policy patterns, upsert target
- Codebase: `src/actions/admin/fixtures.ts` — admin action pattern (requireAdmin, createAdminClient, FormData, revalidatePath)
- Codebase: `src/components/fixtures/fixture-card.tsx` — prediction area extension point, component props pattern
- Codebase: `src/components/fixtures/gameweek-view.tsx` — sticky footer addition point
- Codebase: `tests/setup.ts` + `vitest.config.ts` — test infrastructure (Vitest, mocking pattern, jsdom environment)
- Codebase: `.planning/STATE.md` — locked decisions (synchronous recalculation, pure function library)

### Secondary (MEDIUM confidence)
- STATE.md decision: "Scoring: Pure function library (no side effects) — runs in web app, admin recalc, and offline fallback"
- STATE.md blocker: "Confirm Supabase pg_cron is available on free tier" — resolved: use Vercel Cron

### Tertiary (LOW confidence — flag for validation)
- Vercel Hobby Cron minimum interval: Needs verification at deployment. If restricted to daily, the manual Sync Now button is the fallback for match-day results.

---

## Metadata

**Confidence breakdown:**
- Scoring logic (pure function): HIGH — trivial arithmetic, no external dependencies
- Sync pipeline extension: HIGH — existing sync.ts code is well-structured; integration point is clear
- Database schema: HIGH — migration patterns well established in migrations 001-003; schema design follows existing conventions
- Admin override flow: HIGH — server action pattern established; audit table design is straightforward
- UI extension (fixture card, sticky footer): HIGH — existing component structure makes extension points clear
- Vercel Cron scheduling: MEDIUM — free tier capabilities need validation at deploy time

**Research date:** 2026-04-12
**Valid until:** 2026-05-12 (stable stack; football-data.org and Vercel APIs unlikely to change)
