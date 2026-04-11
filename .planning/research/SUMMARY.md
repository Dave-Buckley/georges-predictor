# Project Research Summary

**Project:** George's Premier League Predictor
**Domain:** Private football score prediction competition platform
**Researched:** 2026-04-11
**Confidence:** HIGH

## Executive Summary

George's Predictor is a closed, invite-only Premier League score prediction platform for ~50-100 members running a real-money competition (£50 entry) with custom scoring rules, replacing a 10+ year WhatsApp-based manual process. The recommended stack is Next.js 15 (App Router) + Supabase (PostgreSQL + Auth + RLS) + Vercel Hobby — one deployment unit, entirely free-tier, with Supabase's Row-Level Security enforcing prediction visibility at the database level where it cannot be bypassed.

No existing platform (Superbru, Sky Super 6, BBC Score Predictor) supports the required combination of custom scoring, admin-controlled bonuses, a parallel Last One Standing competition, and a closed private group model. This is a bespoke build.

The non-negotiable design constraint is that scoring errors, late submissions, or prediction visibility leaks in a real-money competition cause immediate trust breakdown and financial disputes. Server-side lockout, database-level visibility gating, two-phase bonus confirmation (member picks → George confirms → recalculate), and an append-only audit log are architectural requirements, not optional polish.

## Key Findings

### Recommended Stack

**Core technologies:**
- **Next.js 15 (App Router):** Single deployment unit covering frontend + API routes on Vercel free tier
- **Supabase:** PostgreSQL with RLS for prediction visibility, built-in auth, free tier handles 100 users
- **Tailwind CSS 4:** Fast path to polished Premier League-branded UI
- **TypeScript 5:** Type safety critical for real-money scoring logic

**Key libraries:**
- `@react-pdf/renderer` — server-side PDF generation (weekly reports)
- `xlsx` v0.18.x — spreadsheet export (MUST pin to 0.18.x; 0.19+ changed to paid license)
- `resend` — 3,000 emails/month free tier (sufficient for weekly reports)
- `date-fns` + `date-fns-tz` — timezone-aware date handling (BST/GMT transitions)
- `football-data.org` API — free tier, 10 req/min, no monthly cap

### Expected Features

**Must have (table stakes):**
- Fixture list per gameweek with clear midweek/weekend grouping
- Score prediction submission with per-fixture lockout at kick-off
- Automatic point calculation (10pts result, 30pts exact score)
- Live points display as results come in
- Overall league table and weekly standings
- Predictions hidden until gameweek complete
- George admin panel with full control
- Weekly PDF report + spreadsheet export

**Should have (competition-specific):**
- Weekly bonus system (admin-controlled, two-phase confirmation)
- Golden Glory bonus (separate scoring formula — 20pts/60pts)
- Last One Standing sub-competition
- H2H Steal detection and flagging
- Pre-season predictions
- Additional prize tracking with admin confirmation
- Mid-season data import

**Defer (v2+):**
- Historical cross-season analytics
- Member-vs-member comparison tools
- Advanced stats dashboards

### Architecture Approach

Single Next.js monolith with Supabase backend. The scoring engine must be a pure function library (inputs → outputs, no side effects) that runs in three contexts: web app API routes, admin recalculation, and the offline local fallback tool. The gameweek state machine (`draft → open → in_progress → awaiting_confirmation → complete → archived`) is the spine — every feature gates on it.

**Major components:**
1. **Auth + Member Management** — Supabase Auth, George-approved registration
2. **Fixture Layer** — API sync, kick-off times, per-fixture lockout
3. **Prediction Engine** — Submission, editing, visibility gating
4. **Scoring Engine** — Pure function library, calculation breakdown storage
5. **Admin Panel** — Bonus management, overrides, prize confirmation
6. **Bonus System** — Weekly bonus + Golden Glory + Double Bubble
7. **Last One Standing** — Parallel competition tracker
8. **Reports** — PDF, XLSX, email delivery
9. **Local Fallback** — Offline HTML bundle + data export

### Critical Pitfalls

1. **Race condition on live results** — APIs emit FT status before scores are confirmed stable; double-poll before committing points
2. **Server-side lockout not enforced** — Must reject predictions server-side where `fixture.kickoff_time < now()`; client-side only is bypassable
3. **Prediction visibility leak** — Must enforce at database query level (RLS), not frontend filtering
4. **BST/GMT timezone errors** — Store all kick-offs as UTC; display converts to Europe/London; hardcoded offsets break mid-season
5. **Golden Glory + Double Bubble interaction** — Must be formally specified before coding; store calculation breakdown per prediction
6. **Supabase free tier pausing** — Database pauses after 7 days inactivity; need keep-alive mechanism

## Implications for Roadmap

Based on research, suggested 9-phase structure:

### Phase 1: Foundation
**Rationale:** Everything depends on the schema and auth
**Delivers:** Database schema, auth, gameweek state machine, George-approved registration
**Addresses:** Core data model, member management
**Avoids:** Schema retrofitting pitfall

### Phase 2: Fixture Layer
**Rationale:** Predictions can't exist without fixtures
**Delivers:** API sync, kick-off times, timezone handling, per-fixture lockout
**Uses:** football-data.org API, date-fns-tz
**Avoids:** Timezone/BST errors

### Phase 3: Predictions
**Rationale:** Core member action, depends on fixtures
**Delivers:** Submission form, editing, visibility gating (RLS)
**Avoids:** Visibility leak, lockout bypass

### Phase 4: Scoring Engine
**Rationale:** All downstream features depend on accurate scoring
**Delivers:** Pure function scoring library, manual result entry, live points display
**Avoids:** Scoring accuracy bugs, race conditions

### Phase 5: Admin Panel & Bonus System
**Rationale:** George needs control before bonuses go live
**Delivers:** Admin dashboard, bonus management, two-phase confirmation, Double Bubble toggle
**Avoids:** Auto-applied bonus errors

### Phase 6: Mid-Season Import & Member Management
**Rationale:** Must complete before real members register
**Delivers:** Data import tool, late joiner support, ghost account claim pattern
**Avoids:** Orphaned/duplicate records

### Phase 7: Last One Standing
**Rationale:** Independent sub-competition, safe to build after core loop
**Delivers:** Team selection, elimination tracking, team usage history

### Phase 8: Reports & Export
**Rationale:** Requires complete stable data
**Delivers:** Weekly PDF, detailed XLSX, email to George, on-site report page

### Phase 9: Polish & Fallback
**Rationale:** Built last, depends on stable data model
**Delivers:** Offline fallback tool, pre-season predictions, PL branding/photos, member profiles, season archive

### Research Flags

Phases needing deeper research during planning:
- **Phase 2:** Verify football-data.org current PL free tier coverage and Supabase pg_cron availability
- **Phase 8:** react-pdf layout complexity, Resend attachment limits, async job pattern on Vercel Hobby

Standard patterns (skip research-phase):
- Phases 1, 3, 4, 5, 6, 7, 9

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Free-tier limits for Vercel Cron and Supabase pause need live verification |
| Features | HIGH | Requirements validated from 10+ year running competition |
| Architecture | HIGH | Well-established Next.js + Supabase patterns |
| Pitfalls | HIGH | Domain-specific issues well-understood |

**Overall confidence:** HIGH

### Gaps to Address

- Verify football-data.org free tier PL coverage (training cutoff Aug 2025)
- Confirm Supabase pg_cron available on free tier
- George must sign off on scoring spec (bonus interactions) before scoring code is written
- Confirm George's existing spreadsheet format before building import UI

## Sources

### Primary (HIGH confidence)
- PROJECT.md — validated requirements from 10+ year competition
- Next.js, Supabase, Vercel official documentation patterns

### Secondary (MEDIUM confidence)
- football-data.org API documentation and community reports
- Free tier limits from training data (flagged for verification)

---
*Research completed: 2026-04-11*
*Ready for roadmap: yes*
