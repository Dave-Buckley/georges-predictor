---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: planning
stopped_at: Completed 02-fixture-layer/02-02-PLAN.md
last_updated: "2026-04-11T19:32:24.672Z"
last_activity: 2026-04-11 — Roadmap created, 11 phases derived from 71 v1 requirements
progress:
  total_phases: 11
  completed_phases: 2
  total_plans: 8
  completed_plans: 8
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-11)

**Core value:** Accurate, automated point calculation that removes all manual load from George while keeping him in full control of the competition.
**Current focus:** Phase 1 — Foundation

## Current Position

Phase: 1 of 11 (Foundation)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-04-11 — Roadmap created, 11 phases derived from 71 v1 requirements

Progress: [░░░░░░░░░░] 0%

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

### Pending Todos

None yet.

### Blockers/Concerns

- [Pre-planning] George must sign off on scoring spec (bonus interactions — especially Golden Glory + Double Bubble stacking) before Phase 6 coding begins
- [Pre-planning] Verify football-data.org free tier still covers PL fixtures (API may have changed since training cutoff)
- [Pre-planning] Confirm Supabase pg_cron is available on free tier for keep-alive and result polling
- [Pre-planning] Confirm George's existing spreadsheet format before building Phase 7 import UI

## Session Continuity

Last session: 2026-04-11T19:27:28.112Z
Stopped at: Completed 02-fixture-layer/02-02-PLAN.md
Resume file: None
