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

### Pending Todos

None yet.

### Blockers/Concerns

- [Pre-planning] George must sign off on scoring spec (bonus interactions — especially Golden Glory + Double Bubble stacking) before Phase 6 coding begins
- [Pre-planning] Verify football-data.org free tier still covers PL fixtures (API may have changed since training cutoff)
- [Pre-planning] Confirm Supabase pg_cron is available on free tier for keep-alive and result polling
- [Pre-planning] Confirm George's existing spreadsheet format before building Phase 7 import UI

## Session Continuity

Last session: 2026-04-11
Stopped at: Roadmap created. Ready to begin Phase 1 planning.
Resume file: None
