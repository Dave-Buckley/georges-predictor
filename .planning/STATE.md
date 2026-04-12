---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_plan: Plan 3 of 4 (10-03 Orchestration + Cron)
status: Phase 10 Plan 02 shipped — 3 PDF renderers (group/personal/kickoff) + 3 XLSX builders (weekly admin/kickoff backup/full export) + 5 React Email body templates + EmailLayout wrapper. All renderers pure; gatherFullExportData is the only DB-touching function. 497/497 tests green (+43 new). Build clean.
stopped_at: Completed 10-02-PLAN.md
last_updated: "2026-04-12T19:05:09.801Z"
last_activity: 2026-04-12
progress:
  total_phases: 11
  completed_phases: 9
  total_plans: 33
  completed_plans: 31
  percent: 94
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-11)

**Core value:** Accurate, automated point calculation that removes all manual load from George while keeping him in full control of the competition.
**Current focus:** Phase 9 complete — next up Phase 10 (Reports & Export) planning.

## Current Position

Phase: 10 of 11 (Reports & Export) — IN PROGRESS
Current Plan: Plan 3 of 4 (10-03 Orchestration + Cron)
Total Plans in Phase: 4 (10-01 + 10-02 complete; 10-03/04 pending)
Status: Phase 10 Plan 02 shipped — 3 PDF renderers (group/personal/kickoff) + 3 XLSX builders (weekly admin/kickoff backup/full export) + 5 React Email body templates + EmailLayout wrapper. All renderers pure; gatherFullExportData is the only DB-touching function. 497/497 tests green (+43 new). Build clean.
Last activity: 2026-04-12

Progress: [█████████░] 94% (9/11 phases complete + Phase 10 in-progress; 31/33 plans shipped)

**Deferred QA (tracked for end-of-project master QA sheet — `docs/FINAL_QA_CHECKLIST.md`):**
- Phase 8 Task 3 (08-03): 6 manual UI scenarios (admin LOS page, mobile LOS picker, member /los, H2H banner stages, notification triggers, RLS Network spot-check) — covered in §7, §8
- Phase 9 Task 4 (09-03): 9-section script covering member read-only, admin monitoring, late-joiner flow, actuals entry, calculation, confirmation, Championship management + rollover, dashboard card, mobile — merged into `docs/FINAL_QA_CHECKLIST.md` §10

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
| Phase 08-last-one-standing-h2h P01 | 32 | 3 tasks | 13 files |
| Phase 08-last-one-standing-h2h P02 | 12 | 2 tasks | 11 files |
| Phase 08-last-one-standing-h2h P03 | 120 min | 2 tasks | 13 files |
| Phase 09-pre-season-predictions P01 | 7 | 3 tasks | 11 files |
| Phase 09-pre-season-predictions P01 | 7 | 3 tasks | 11 files |
| Phase 09-pre-season-predictions P02 | 4 | 3 tasks | 10 files |
| Phase 09-pre-season-predictions P03 | 25 | 4 tasks | 14 files |
| Phase 10-reports-export P01 | 20 | 3 tasks | 12 files |
| Phase 10-reports-export P02 | 35 | 3 tasks | 18 files |

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
- [Phase 08-last-one-standing-h2h]: los_picks UPSERT key is (competition_id, member_id, gameweek_id) — Plan 02 server actions must match
- [Phase 08-last-one-standing-h2h]: evaluateLosRound withholds winner_id until survivors' picks are settled (no pending) — prevents premature winner mid-matchday
- [Phase 08-last-one-standing-h2h]: availableTeams full-resets to all 20 the moment the picked set covers the pool; duplicates de-duped; out-of-pool ids ignored
- [Phase 08-last-one-standing-h2h]: detectWeeklyTies filters total <= 0 before dense-ranking (SQL parity); member_ids/winner_ids sorted alphabetically for determinism
- [Phase 08-last-one-standing-h2h]: Partial unique index los_competitions_one_active ON (status) WHERE status='active' enforces single-active-cycle at DB level
- [Phase 08-last-one-standing-h2h]: No DB triggers for LOS lifecycle — all orchestration is application-level (Pitfall 5 from 08-RESEARCH.md)
- [Phase 08-last-one-standing-h2h]: submitPredictions 4th param losTeamId (default=null) — backward compatible signature extension; response gains top-level losSaved boolean
- [Phase 08-last-one-standing-h2h]: LOS pre-check (active-comp, eligibility, already-used, fixture resolution) runs BEFORE predictions upsert — ensures mandatory-pick rejection returns saved=0, no partial writes
- [Phase 08-last-one-standing-h2h]: h2h_steals insert uses plain INSERT + 23505 duplicate-key tolerance for idempotency; matches DB UNIQUE(detected_in_gw_id, position) exactly
- [Phase 08-last-one-standing-h2h]: Sync pipeline wraps each LOS/H2H orchestrator in try/catch — one failure does not halt others or fail sync_log success path
- [Phase 08-last-one-standing-h2h P03]: Admin LOS actions match Phase 5 bonuses idiom verbatim (requireAdmin + createAdminClient + Zod parse + revalidatePath) — zero drift
- [Phase 08-last-one-standing-h2h P03]: closeGameweek H2H integration is non-blocking — detectH2HForGameweek + resolveStealsForGameweek failures log admin_notifications type='system' metadata, close op always succeeds
- [Phase 08-last-one-standing-h2h P03]: resetCompetitionManually accepts winner_id?: string | null — null = explicit George-override reset with no winner (no prize)
- [Phase 08-last-one-standing-h2h P03]: setLosPickForMember bypasses kickoff guard (admin correction) but enforces team-not-already-used-in-cycle
- [Phase 08-last-one-standing-h2h P03]: H2HStealBanner three-stage variants (detected / resolving / resolved) driven purely by row state (detected_in_gw_id, resolves_in_gw_id, resolved_at) — no extra schema columns
- [Phase 08-last-one-standing-h2h P03]: Admin LOS table ordering computed client-side (active-first teams-used-ASC alpha tiebreak, eliminated after eliminated_at_gw-DESC alpha) — server fetch stays single-JOIN simple
- [Phase 09-pre-season-predictions P01]: Pre-season types extended in src/lib/supabase/types.ts (project's canonical types file) — plan-specified src/lib/types/database.ts does not exist in repo
- [Phase 09-pre-season-predictions P01]: calculatePreSeasonPoints is pure with zero imports (mirrors Phase 4 scoring idiom) — 30 pts flat per correct, set-equality for unordered categories, 4 flags including all_correct_overall when total === 12
- [Phase 09-pre-season-predictions P01]: Source-list validation (PL vs Championship) deferred to server actions in Plan 02 — PL team list requires DB access; keeping Zod schemas pure-static avoids DB coupling at the validator layer
- [Phase 09-pre-season-predictions P01]: getPreSeasonExportRows uses map-merge of picks + awards (not single JOIN) — tolerates picks-exist-without-award case, returns null points gracefully
- [Phase 09-pre-season-predictions P01]: Championship constant CHAMPIONSHIP_TEAMS_2025_26 includes Leeds United (plan starter list) — season-suffixed filename so 2026-27 sits alongside without replacing
- [Phase 09-pre-season-predictions P01]: Zod v4 .uuid() enforces strict RFC v1-8 regex (version digit required at position 13) — test fixtures must use v4-compliant UUIDs, not all-1s/2s
- [Phase 09-pre-season-predictions P01]: Migration 009 admin_notifications CHECK preserves all 17 prior types + adds 3 new pre-season types (Pitfall 7 ritual) — seasons + pre_season_awards + audit columns seeded
- [Phase 09-pre-season-predictions]: JSON payload in FormData (payload field) for both pre-season actions — avoids FormData flat-array encoding of top4/relegated/promoted arrays; client JSON.stringify, server JSON.parse + Zod safeParse
- [Phase 09-pre-season-predictions]: Shared PreSeasonPicker controlled component under src/app/(member)/pre-season/_components/ imported by both member form and admin late-joiner dialog — avoids ~200-line duplication; state+submit owned by parent
- [Phase 09-pre-season-predictions]: Lockout check compares upcoming.gw1_kickoff to now() AND asserts season param matches upcoming.season — rejects cross-season submissions
- [Phase 09-pre-season-predictions]: Admin setPreSeasonPicksForMember has NO lockout check by design — matches Phase 2 editFixture admin_override pattern; records submitted_by_admin=true + imported_by=admin.userId
- [Phase 09-pre-season-predictions P03]: DB-backed Championship list added mid-plan (migration 010 + championship_teams table) replacing the hardcoded CHAMPIONSHIP_TEAMS_2025_26 constant from Plan 01 — constant retained as seed/reference only; admin UI now manages the list, zero dev intervention at season boundaries
- [Phase 09-pre-season-predictions P03]: endOfSeasonRollover reads locked season-end actuals (final_relegated + final_promoted) as the single source of truth — swaps 3 PL ↔ 3 Championship teams in one transaction; idempotent via set-difference pre-checks; sanity-gates reject if any team isn't currently in the expected table
- [Phase 09-pre-season-predictions P03]: Rollover is application-side only (no DB triggers) — matches Phase 8 LOS decision; two-step preview + confirm dialog prevents accidental swaps
- [Phase 09-pre-season-predictions P03]: calculatePreSeasonAwards preserves confirmed=true rows' awarded_points on re-calc — only calculated_points and flags are rewritten, protecting George's manual overrides
- [Phase 09-pre-season-predictions P03]: Pre-season display-total aggregation deferred to Phase 10 export-time SUM — no central aggregator today (computeDisplayTotal covers only bonuses/prizes); Phase 10 to SUM pre_season_awards.awarded_points WHERE confirmed=true alongside other sources at read time
- [Phase 09-pre-season-predictions P03]: isChampionshipTeam refactored from array lookup to async DB query — all callers already in async server-action contexts so no interface gymnastics; all 398 prior tests remained green through the refactor
- [Phase 09-pre-season-predictions P03]: Manual QA script for Phase 9 (9 sections: member read-only, admin monitoring, late-joiner, actuals entry, calculation, confirmation, Championship+rollover, dashboard card, mobile) deferred to master end-of-project QA sheet at docs/FINAL_QA_CHECKLIST.md §10 — user approved 2026-04-12
- [Phase 10-reports-export P01]: xlsx pinned with --save-exact (0.18.5, NO caret) — v0.19+ is paid license per Phase 2 decision; package.json now carries "xlsx": "0.18.5" with no range prefix
- [Phase 10-reports-export P01]: serverExternalPackages: ['@react-pdf/renderer'] registered in next.config.ts preemptively — prevents the "yoga.wasm subpath not defined" class of Vercel server-bundler errors that manifest only in production (10-RESEARCH.md Pitfall 3)
- [Phase 10-reports-export P01]: Migration 011 admin_notifications CHECK preserves all 20 prior types + adds 3 Phase 10 types (report_send_failed, kickoff_backup_failed, report_render_failed) via drop+re-add ritual (Pitfall 7)
- [Phase 10-reports-export P01]: member_report_log UNIQUE(member_id, gameweek_id, report_type) enforces idempotent sends at DB level — retryable from the orchestrator without double-sending
- [Phase 10-reports-export P01]: member_report_log RLS — members SELECT own + admin SELECT all, NO session-role writes (service-role-only via createAdminClient)
- [Phase 10-reports-export P01]: gatherGameweekData uses single parallel Promise.all of 9 admin-client fetches; post-fetch fixture-id filter on predictions + prediction_scores avoids per-table WHERE-JOIN complexity
- [Phase 10-reports-export P01]: shapeData exported as pure transform — downstream renderer tests (Plans 02-04) can assert transform logic without mocking admin client
- [Phase 10-reports-export P01]: h2h_steals query uses .or(detected_in_gw_id.eq.${gw},resolves_in_gw_id.eq.${gw}) — reports surface both newly detected AND resolving-this-week steals in one pass
- [Phase 10-reports-export P01]: Weekly points aggregation excludes pending bonuses (awarded=null/false) — matches computeDisplayTotal precedent from Phase 6
- [Phase 10-reports-export P01]: Standings tiebreak on displayName alpha (after totalPoints DESC) — determinism for test assertions and stable ordering
- [Phase 10-reports-export P01]: Refactor src/lib/email.ts sendEmail to delegate to getResend() singleton — preserves Phase 1 auth email signature verbatim, avoids two Resend clients in same process
- [Phase 10-reports-export P01]: sendWithAttachments converts Buffer -> base64 at the edge (Resend expects string, not Buffer); graceful null-resend fallback returns error object, never throws
- [Phase 10-reports-export P01]: Resend mock for constructor-based `new Resend(...)` requires `function(this){ Object.assign(this, mock.client) }` — arrow-function mockImplementation is not construct-callable
- [Phase 10-reports-export P01]: Shared Phase 10 test fixtures live at tests/reports/fixtures/ — mockGameweekData + mockSupabaseFrom + createResendMock imported by every report test in Plans 02-04
- [Phase 10-reports-export P01]: Pre-existing lint errors (Phase 8 los/round.ts + Phase 1/2/4 test files) deferred to .planning/phases/10-reports-export/deferred-items.md — out of scope per GSD boundary rules; Phase 10 code lint-clean
- [Phase 10-reports-export]: P02: PDF content tests walk React element tree (invoke function components synchronously) rather than grepping renderToString output — react-pdf PDFs use glyph IDs so binary text-search is unreliable
- [Phase 10-reports-export]: P02: server-only aliased in vitest.config.ts to tests/stubs/server-only.ts — vi.mock resolves too late for vite import-analysis; pattern now available for any future server-only-guarded module
- [Phase 10-reports-export]: P02: Personal PDF throws Error on missing memberId (contract enforced) — no silent empty PDFs; both renderer runtime and test layer exercise the throw path
- [Phase 10-reports-export]: P02: Full-export split — buildFullExportXlsx is pure (sync Buffer); gatherFullExportData is the ONLY DB caller in the module and co-located so shape + collector evolve together; pre-season re-uses Phase 9 getPreSeasonExportRows via dynamic import with try/catch fallback
- [Phase 10-reports-export]: P02: @react-email/components installed at Plan 02 (dependency gap from Plan 01 — only react-email CLI dev-tool had been pinned); runtime primitives are required for Phase 10 email bodies

### Pending Todos

- [Phase 7] Add "Bucks" (Dave — the builder/backup admin) as a member in mid-season import with points matching the current league leader. Dave needs to use the platform alongside George to QA and catch issues before members use it.
- [Phase 10] Kickoff-time backup email to George — when the first fixture of each gameweek kicks off (predictions/LOS/bonus all locked at that moment), email George a single document containing every member's predictions, LOS pick, and bonus pick for the gameweek. Disaster-recovery backup so George can run the gameweek manually if the system dies mid-week. Timing variant of RPT-03/RPT-04.

### Blockers/Concerns

- [Pre-planning] George must sign off on scoring spec (bonus interactions — especially Golden Glory + Double Bubble stacking) before Phase 6 coding begins
- [Pre-planning] Verify football-data.org free tier still covers PL fixtures (API may have changed since training cutoff)
- [Pre-planning] Confirm Supabase pg_cron is available on free tier for keep-alive and result polling
- [Pre-planning] Confirm George's existing spreadsheet format before building Phase 7 import UI

## Session Continuity

Last session: 2026-04-12T19:05:09.797Z
Stopped at: Completed 10-02-PLAN.md
Resume file: .planning/phases/10-reports-export/10-03-PLAN.md
