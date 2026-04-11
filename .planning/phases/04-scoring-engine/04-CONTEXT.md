# Phase 4: Scoring Engine - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Points are calculated automatically and accurately as match results come in. The existing fixture sync is enhanced to trigger point calculation when results arrive. Full calculation breakdowns are stored per prediction. Members see their points inline on fixture cards with a sticky gameweek total. George can manually enter or correct results from the admin gameweek page, triggering instant recalculation with an audit trail. No bonus points, no league table, no reports — those are Phases 5-6 and 10.

</domain>

<decisions>
## Implementation Decisions

### Result Fetching & Triggers
- Use the existing fixture sync process — enhance it to also trigger point calculation when a fixture status changes to FINISHED (no separate result-fetching job)
- Auto-sync runs on a schedule during match windows, plus George can hit Sync Now for immediate results
- Points calculated instantly and automatically when a FINISHED result comes in — no manual confirmation step
- George can review scores after the fact and correct if the API got it wrong
- When George corrects a score, all affected predictions are recalculated instantly

### Points Display for Members
- Points shown inline on each fixture card — next to the prediction, members see: predicted score, actual score, and points awarded (e.g., "Predicted 2-1 → Actual 2-1 → Correct Score = 30pts")
- "Live" means refresh to see latest — page shows current points when loaded, member refreshes to check again. No auto-refresh, no websockets. Zero infrastructure cost.
- Sticky footer total at the bottom of the gameweek page — always visible as you scroll through fixtures, updates as more results come in across the gameweek

### George's Manual Override Flow
- George enters/corrects results on the admin gameweek page — navigates to the gameweek, sees fixtures with current scores, clicks a fixture to edit
- Confirmation dialog shows impact preview: "Changing Arsenal 2-1 Chelsea to 2-2. This affects 43 predictions. Recalculate?" — George sees exactly what will happen before confirming
- Each result shows a source badge ("API" or "Manual") so George knows which came from the system vs his overrides — supports the paper trail requirement
- Admin audit log records every override: "George changed Arsenal 2-1 → 2-2 on [date]. 43 predictions recalculated." Visible in admin only — members just see updated points.

### Calculation Breakdown Storage
- Full breakdown stored per prediction: predicted score, actual score, whether result direction was correct (W/D/L match), whether exact score matched, points awarded (0, 10, or 30)
- Members see the full breakdown inline on each fixture card — clear, no ambiguity about how points were calculated
- Breakdown is a permanent record — not derived on the fly — satisfying the paper-trail and accuracy requirements

### Claude's Discretion
- Auto-sync frequency during match windows (balance freshness vs football-data.org free tier API limits)
- Recalculation approach (synchronous vs queued — likely synchronous given ~50 members)
- Database schema for the scores/breakdown table
- Fixture card layout for showing prediction + result + points breakdown
- Admin gameweek page result-editing UI design
- Audit log storage and display format
- How to handle in-progress matches (IN_PLAY status) — show partial results or wait for FINISHED
- Error handling for API failures during auto-sync

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `football-data-client.ts`: Already parses `score.fullTime.home/away` from API — result data is available in the sync pipeline
- `sync.ts`: Full sync engine (fetch → upsert teams → upsert gameweeks → upsert fixtures → detect reschedules → write sync_log) — enhance to trigger scoring after fixture updates
- `src/app/api/sync-fixtures/route.ts`: API route for manual sync — already wired to George's Sync Now button
- `FixtureRow`: Already has `home_score` and `away_score` columns — results storage partially exists
- `predictions.ts` server action: Established pattern for Supabase mutations with auth + validation
- `fixture-card.tsx`: Has prediction display area — extend to show results and points
- `prediction-form.tsx`: Client wrapper managing prediction state — extend to show calculated points
- `src/lib/supabase/admin.ts`: Admin (service role) client — use for admin override operations
- `lockout.ts` → `canSubmitPrediction()`: Lockout logic — similar pattern for "can edit result" checks

### Established Patterns
- Server actions for mutations (`src/actions/predictions.ts`, `src/actions/admin/fixtures.ts`)
- Zod validators in `src/lib/validators/` — extend for result entry validation
- Admin notification system (`admin_notifications` table with type/title/message) — extend for result-related notifications
- `createAdminClient()` for bypassing RLS in admin operations
- Migration pattern: numbered SQL files in `supabase/migrations/`
- Test pattern: `tests/` directory with Vitest, mocking Supabase client

### Integration Points
- `sync.ts`: Add scoring trigger after fixture upsert when status changes to FINISHED
- `fixture-card.tsx`: Add result display + points breakdown to existing prediction area
- `gameweek-view.tsx`: Add sticky footer total for gameweek points
- Admin gameweek page (`/admin/gameweeks`): Add result editing capability to existing fixture management
- `admin_notifications`: Add types for result-related events (sync with results, override logged)
- New migration: `004_scoring.sql` — scores table, audit log, RLS policies

</code_context>

<specifics>
## Specific Ideas

- Points calculation is the core value of the entire application — accuracy is critical because real money is involved
- The inline breakdown on fixture cards ("Predicted 2-1 → Actual 2-1 → Correct Score = 30pts") replaces George's manual WhatsApp messages explaining how points were calculated
- Source badge (API/Manual) on results gives George confidence in the paper trail — he can see at a glance which results he verified vs which the system pulled
- Impact preview on override ("This affects 43 predictions") prevents George from accidentally changing a result without understanding the consequences

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-scoring-engine*
*Context gathered: 2026-04-12*
