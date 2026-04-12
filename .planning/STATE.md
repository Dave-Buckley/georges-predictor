---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: completed
stopped_at: Phase 8 context gathered, ready to plan
last_updated: "2026-04-12T00:53:30.430Z"
last_activity: "2026-04-12 — Phase 7 Plan 2 complete: admin import page, server actions, DATA-05 regression tests"
progress:
  total_phases: 11
  completed_phases: 7
  total_plans: 23
  completed_plans: 23
  percent: 96
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-11)

**Core value:** Accurate, automated point calculation that removes all manual load from George while keeping him in full control of the competition.
**Current focus:** Phase 7 — Mid-Season Import (complete)

## Current Position

Phase: 7 of 11 (Mid-Season Import)
Plan: 2 of 2 in current phase — COMPLETE
Status: Phase 7 complete, ready for Phase 8
Last activity: 2026-04-12 — Phase 7 Plan 2 complete: admin import page, server actions, DATA-05 regression tests

Progress: [█████████░] 96%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: — min
- Total execution time: — hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 01-foundation P01 | 6 | 3 tasks | 19 files |
| Phase 01-foundation P02 | 8 | 2 tasks | 14 files |
| Phase 01-foundation P03 | 9 | 2 tasks | 18 files |
| Phase 01-foundation P04 | 13 | 2 tasks | 10 files |
| Phase 02-fixture-layer P01 | 7 | 2 tasks | 14 files |
| Phase 02-fixture-layer P03 | 5 | 2 tasks | 11 files |
| Phase 02-fixture-layer P02 | 8 | 2 tasks | 9 files |
| Phase 03-predictions P01 | 3 | 2 tasks | 6 files |
| Phase 03-predictions P03 | 4 | 2 tasks | 4 files |
| Phase 03-predictions P02 | 4 | 2 tasks | 5 files |
| Phase 04-scoring-engine P01 | 4 | 2 tasks | 6 files |
| Phase 04-scoring-engine P03 | 6 | 2 tasks | 4 files |
| Phase 04-scoring-engine P02 | 8 | 2 tasks | 6 files |
| Phase 05-admin-panel P01 | 3 | 2 tasks | 5 files |
| Phase 05-admin-panel P02 | 4 | 2 tasks | 7 files |
| Phase 05-admin-panel P03 | 5 | 2 tasks | 7 files |
| Phase 05-admin-panel P04 | 5 | 2 tasks | 8 files |
| Phase 06-bonus-system P01 | 2 | 2 tasks | 5 files |
| Phase 06-bonus-system P02 | 3 | 2 tasks | 5 files |
| Phase 06-bonus-system P03 | 3 | 2 tasks | 5 files |
| Phase 07-mid-season-import P01 | 15 | 2 tasks | 5 files |
| Phase 07-mid-season-import P02 | 45 | 4 tasks | 8 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Stack: Next.js 15 (App Router) + Supabase + Vercel Hobby — single free-tier deployment
- Auth: Email/password via Supabase Auth; George approves every registration
- Scoring: Pure function library (no side effects) — runs in web app, admin recalc, and offline fallback
- Visibility gating: Enforced at database level via Supabase RLS (cannot be bypassed client-side)
- Lockout: Server-side rejection where `fixture.kickoff_time < now()` — client-side alone is insufficient
- Bonuses: Two-phase (member picks, George confirms) — nothing auto-applied
- Phase 7 (Mid-Season Import) is a launch blocker — must complete before real members register
- XLSX library: Pin to xlsx v0.18.x — v0.19+ changed to paid license
- BST/GMT: Store all kick-offs as UTC; display converts to Europe/London timezone
- [Phase 01-foundation]: Scaffold workaround: create-next-app temp subdirectory then move files to project root (directory name violates npm naming)
- [Phase 01-foundation]: RLS admin JWT path: (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' (may need adjustment per Supabase project settings)
- [Phase 01-foundation]: email_opt_in default lives in form defaultValues not Zod schema — avoids zodResolver type conflict with react-hook-form
- [Phase 01-foundation]: Supabase clients use createClient<any> until supabase gen types is run post-deployment
- [Phase 01-foundation]: Security question answers hashed with SHA-256 (Web Crypto API), normalised to lowercase+trimmed — no bcrypt needed since personal questions, not passwords
- [Phase 01-foundation]: zodResolver excluded — @hookform/resolvers not installed; client forms use react-hook-form native validation; Zod validation happens in server actions
- [Phase 01-foundation]: Zod v4 uses .issues[] not .errors[] for validation errors — fixed across all admin server actions
- [Phase 01-foundation]: AUTH-04 coverage via magic link re-request — no separate reset page, requesting new link IS the recovery flow
- [Phase 01-foundation]: Database type set to any placeholder — unblocks TypeScript until supabase gen types runs against real project
- [Phase 02-fixture-layer]: BST/GMT label derived from getTimezoneOffset() offset (0=GMT, >0=BST) — Node.js ICU returns GMT+1 not BST for zzz token
- [Phase 02-fixture-layer]: sync.ts UUID resolution: query DB after upsert — never generate client-side UUIDs
- [Phase 02-fixture-layer]: Prediction lockout RLS (FIX-03) documented as commented SQL in migration 002 — Phase 3 MUST apply on predictions table
- [Phase 02-fixture-layer]: First-sync-on-deploy: /api/sync-fixtures checks empty sync_log before auth — auto-triggers on first post-deploy request
- [Phase 02-fixture-layer]: Team badges use plain img not next/image to avoid SVG optimization issues with football-data.org crest URLs
- [Phase 02-fixture-layer]: All-fixtures filter state stored in URL search params (?team=id) for shareability
- [Phase 02-fixture-layer]: editFixture kickoff guard: blocks time/team changes after kickoff server-side unless admin_override=true in FormData; scores/status always editable
- [Phase 02-fixture-layer]: Negative external_id for manually added fixtures (-Date.now()) prevents collision with football-data.org positive integer IDs
- [Phase 03-predictions]: Prediction visibility at kick-off per CONTEXT.md override of PRED-03 — predictions_select_member RLS policy uses kickoff_time <= now() threshold
- [Phase 03-predictions]: member_id resolved server-side from auth.uid() — never trusted from client in submitPredictions action
- [Phase 03-predictions]: Session client (not admin client) for prediction upserts so RLS enforces two-layer lockout at DB level
- [Phase 03-predictions]: createAdminClient() used on admin predictions page to bypass RLS — George sees all predictions regardless of kick-off status
- [Phase 03-predictions]: Admin predictions tab renamed to All Predictions per CONTEXT.md locked decision — George monitors all members from admin panel
- [Phase 03-predictions]: PredictionInputs uses inputMode=numeric for phone keypad fallback; GameweekView isLocked derived per-fixture; sticky submit button hidden when all fixtures kicked off
- [Phase 04-scoring-engine]: calculatePoints is pure with zero imports — enables offline use, dead simple TDD, and reuse across contexts
- [Phase 04-scoring-engine]: prediction_scores CHECK constraint enforces points_awarded IN (0,10,30) at DB level
- [Phase 04-scoring-engine]: recalculateFixture always uses adminClient — RLS blocks member writes to prediction_scores
- [Phase 04-scoring-engine]: Upsert on prediction_id UNIQUE makes recalculation idempotent — safe to re-run for any fixture
- [Phase 04-scoring-engine]: ScoreBreakdown interface kept local in UI components — avoids coupling to DB row type directly
- [Phase 04-scoring-engine]: Fixed footer uses fixed not sticky positioning — avoids mobile Safari stacking issues with nested scroll containers
- [Phase 04-scoring-engine]: scoredFixtureCount > 0 gate on total bar — ensures no provisional points shown before results arrive
- [Phase 04-scoring-engine]: detectNewlyFinished exported as pure testable helper — avoids complex sync mocking in tests
- [Phase 04-scoring-engine]: Pre-upsert status snapshot enables FINISHED-transition detection without re-querying after upsert
- [Phase 04-scoring-engine]: vi.mock hoisting: use vi.mocked(import) pattern, not variables in factory functions
- [Phase 05-admin-panel]: bonus_awards.awarded uses tri-state boolean (NULL=pending, true=confirmed, false=rejected)
- [Phase 05-admin-panel]: admin_notifications type CHECK dropped and re-added in migration 005 with all Phase 5 types included
- [Phase 05-admin-panel]: bonus_types and additional_prizes grant SELECT to authenticated users so members can see names/prize list
- [Phase 05-admin-panel]: SetBonusDialog existingPickCount passed as prop from server (not fetched client-side) — avoids client DB round-trip
- [Phase 05-admin-panel]: Bonuses page Double Bubble toggle uses toggleDoubleBubble imported directly as form action — no inline 'use server' needed in server components
- [Phase 05-admin-panel]: Server-side re-check on closeGameweek: canClose conditions re-queried from DB — client summary is display-only
- [Phase 05-admin-panel]: Dashboard action cards ordered by urgency: approvals > set bonus > confirm awards > close GW > prizes
- [Phase 05-admin-panel]: EmailNotificationToggles auto-saves on toggle change — no submit button, simpler UX for George
- [Phase 05-admin-panel]: Vercel Hobby already at 2-cron limit — check-date-prizes route created but NOT added to vercel.json; merging into sync-fixtures is future work
- [Phase 05-admin-panel]: Member bonuses page uses session client (not admin) so RLS restricts prize_awards to confirmed-only for members
- [Phase 06-bonus-system]: calculateBonusPoints routes via SCORE_EVALUABLE_BONUSES Set — extensible, O(1) lookup, named evaluators per type
- [Phase 06-bonus-system]: computeDisplayTotal excludes pending bonuses from doubled total — only George-confirmed awards count toward displayed points
- [Phase 06-bonus-system]: Jose Park The Bus qualifying scores: explicit readonly array (0-0, 1-0, 0-1) — total goals <= 1 with no ambiguity
- [Phase 06-bonus-system]: bonusFixtureId defaults to null — when no bonus active, stars hidden and bonus validation skipped entirely
- [Phase 06-bonus-system]: Bonus upsert uses onConflict gameweek_id,member_id — idempotent, overwrites prior pick on re-submit
- [Phase 06-bonus-system]: Bonus recalculation only runs on pending awards (awarded=null) — confirmed/rejected awards are never overwritten by auto-calc
- [Phase 06-bonus-system]: Double Bubble formula shown as (base + bonus) x 2 in footer for member transparency
- [Phase 07-mid-season-import]: pre_season_picks uses text arrays for team names (not UUID FKs) — Championship teams not in teams table
- [Phase 07-mid-season-import]: handle_new_user trigger uses lower(trim()) case-insensitive display_name matching to link imported placeholder rows on registration
- [Phase 07-mid-season-import P02]: importMembers uses createAdminClient (not session client) — RLS blocks member inserts with user_id=null via session client
- [Phase 07-mid-season-import P02]: clearImportedMembers targets only user_id IS NULL rows — registered members cannot be accidentally deleted
- [Phase 07-mid-season-import P02]: importPreSeasonPicks uses case-insensitive name matching and upsert with onConflict member_id,season for idempotent re-import

### Pending Todos

- [Phase 7] Add "Bucks" (Dave — the builder/backup admin) as a member in mid-season import with points matching the current league leader. Dave needs to use the platform alongside George to QA and catch issues before members use it.

### Blockers/Concerns

- [Pre-planning] George must sign off on scoring spec (bonus interactions — especially Golden Glory + Double Bubble stacking) before Phase 6 coding begins
- [Pre-planning] Verify football-data.org free tier still covers PL fixtures (API may have changed since training cutoff)
- [Pre-planning] Confirm Supabase pg_cron is available on free tier for keep-alive and result polling
- [Pre-planning] Confirm George's existing spreadsheet format before building Phase 7 import UI

## Session Continuity

Last session: 2026-04-12T00:53:30.427Z
Stopped at: Phase 8 context gathered, ready to plan
Resume file: .planning/phases/08-last-one-standing-h2h/08-CONTEXT.md
