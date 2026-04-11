# Architecture Research

**Domain:** Score prediction competition platform (football/soccer)
**Researched:** 2026-04-11
**Confidence:** HIGH (patterns derived directly from project requirements + well-established Next.js/Supabase free-tier architecture)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLIENT LAYER (Browser)                       │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│  Member UI   │  Admin Panel │  Public View │  Local Fallback    │
│  (predict,   │  (George:    │  (standings, │  Tool (offline,    │
│   standings) │   manage)    │   reports)   │  George only)      │
└──────┬───────┴──────┬───────┴──────┬───────┴────────┬───────────┘
       │              │              │                │
┌──────▼──────────────▼──────────────▼────────────────▼───────────┐
│                  NEXT.JS APP ROUTER (API Routes + Pages)         │
├──────────────────────────────────────────────────────────────────┤
│  Auth     │  Predictions  │  Fixtures  │  Scoring   │  Admin     │
│  Routes   │  Routes       │  Routes    │  Engine    │  Routes    │
│           │               │            │            │            │
│  /api/    │  /api/        │  /api/     │  /api/     │  /api/     │
│  auth/    │  predictions/ │  fixtures/ │  scoring/  │  admin/    │
└──────┬────┴───────┬────────┴─────┬──────┴─────┬──────┴─────┬────┘
       │            │              │            │            │
┌──────▼────────────▼──────────────▼────────────▼────────────▼────┐
│                    SERVICE LAYER                                  │
├──────────────────────────────────────────────────────────────────┤
│  FixtureSync  │  LockoutGuard  │  PointCalc  │  ReportGen       │
│  Service      │  Middleware    │  Engine     │  Service          │
│               │               │             │                   │
│  FootballAPI  │  Per-fixture   │  10/30pt    │  PDF + XLSX       │
│  + fallback   │  kick-off lock │  GG / DB    │  generation       │
└──────┬────────┴───────┬────────┴─────┬───────┴────────┬─────────┘
       │                │              │                │
┌──────▼────────────────▼──────────────▼────────────────▼─────────┐
│                    DATA LAYER (Supabase / PostgreSQL)            │
├──────────────────────────────────────────────────────────────────┤
│  users  │  fixtures  │  predictions  │  gameweeks  │  seasons   │
│  bonus  │  los_picks │  standings    │  audit_log  │  imports   │
└─────────┴────────────┴───────────────┴─────────────┴────────────┘
                              │
                    ┌─────────▼──────────┐
                    │  External APIs      │
                    │  football-data.org  │
                    │  (free tier)        │
                    └────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Notes |
|-----------|---------------|-------|
| Member UI | Predict submissions, view own results, standings, LOS picks | Read-only until kick-off passes |
| Admin Panel | George manages everything: bonuses, overrides, double bubble, late joiners, season reset | Separate route group `/admin` |
| Public View | League table, weekly reports — no auth required | Static-ish, revalidated on gameweek complete |
| Local Fallback Tool | Standalone script/page George can run offline from exported data | Ships as a downloadable HTML+JS bundle |
| Auth Routes | Email/password sign-in/up, session management | Supabase Auth |
| Predictions Routes | Submit, edit (pre-lockout), retrieve (visibility-gated) | Row-level security enforces member isolation |
| Fixtures Routes | Fetch gameweek fixtures, kick-off times | Consumed by both UI and LockoutGuard |
| Scoring Engine | Calculate points for each prediction once result confirmed | Pure function, deterministic, testable |
| FixtureSync Service | Cron job: pull fixtures + results from football API | Runs via Vercel Cron or Supabase Edge Function |
| LockoutGuard Middleware | Reject prediction writes after fixture kick-off time | Checked server-side on every prediction mutation |
| ReportGen Service | Produce PDF + XLSX on gameweek completion | Triggered by George manually or auto on all results in |
| Supabase DB | Primary data store — all competition state | Also handles Auth, Row Level Security |
| Audit Log | Immutable record of all scoring decisions, overrides, bonus applications | Critical for paper trail |

---

## Recommended Project Structure

```
src/
├── app/                          # Next.js App Router pages
│   ├── (member)/                 # Member-facing routes (auth required)
│   │   ├── predict/[gw]/         # Prediction submission per gameweek
│   │   ├── standings/            # League table
│   │   ├── last-one-standing/    # LOS tracker
│   │   └── profile/              # Member history
│   ├── (admin)/                  # George-only routes
│   │   ├── dashboard/            # Overview
│   │   ├── fixtures/             # Override results
│   │   ├── bonuses/              # Set active bonus per GW
│   │   ├── members/              # Manage members, late joiners
│   │   ├── reports/              # Trigger PDF/XLSX generation
│   │   └── import/               # Mid-season data import
│   ├── (public)/                 # No auth required
│   │   ├── table/                # Public standings
│   │   └── reports/[gw]/         # Published weekly reports
│   └── api/                      # Route handlers
│       ├── auth/                  # Auth callbacks
│       ├── fixtures/              # Fixture data
│       ├── predictions/           # Submit/edit/retrieve
│       ├── scoring/               # Trigger recalculation
│       ├── los/                   # Last One Standing ops
│       ├── admin/                 # Admin-only mutations
│       └── cron/                  # Called by Vercel Cron
│           ├── sync-fixtures/     # Pull from football API
│           └── sync-results/      # Pull results + trigger scoring
├── components/
│   ├── predict/                   # Prediction form, fixture card, lockout state
│   ├── standings/                 # League table, week view
│   ├── los/                       # LOS board, team picker
│   ├── admin/                     # Admin-specific UI
│   └── ui/                        # Shared design system
├── lib/
│   ├── scoring/                   # Point calculation engine (pure functions)
│   │   ├── calculate.ts           # Core: 10pt/30pt/Golden Glory/Double Bubble
│   │   ├── bonus.ts               # Bonus type handlers
│   │   └── validate.ts            # Sanity checks
│   ├── fixtures/                  # Football API client + fallback
│   ├── reports/                   # PDF (pdfkit/react-pdf) + XLSX (exceljs)
│   ├── los/                       # LOS eligibility + elimination logic
│   ├── import/                    # Mid-season CSV/JSON import logic
│   └── db/                        # Supabase client, typed query helpers
├── middleware.ts                   # LockoutGuard + auth checks
└── tools/
    └── fallback/                   # Local fallback tool (self-contained)
        ├── index.html              # Single-file tool George can open locally
        └── predictor-offline.ts    # Compiled into the HTML bundle
```

### Structure Rationale

- **Route groups `(member)` / `(admin)` / `(public)`:** Enforces auth boundary at the layout level — no member accidentally sees admin, no auth wall on public standings.
- **`lib/scoring/` as pure functions:** The scoring engine has zero side effects. Inputs: predictions[], results[], bonusConfig. Output: scoredPredictions[]. Testable in isolation, reusable in fallback tool.
- **`lib/reports/`:** Isolated because PDF/XLSX generation has heavy dependencies (pdfkit, exceljs) — code-split to avoid bloating other routes.
- **`tools/fallback/`:** The offline tool is a separate compilation target. It imports `lib/scoring/` and reads from a JSON export. Must have zero server dependencies.
- **`middleware.ts` for lockout:** Per-fixture lockout is a cross-cutting concern. Checking it in middleware ensures it cannot be bypassed by any route handler.

---

## Architectural Patterns

### Pattern 1: Server-Authoritative Lockout

**What:** Kick-off time is stored in the database (synced from the football API). Every prediction write is validated server-side: if `now >= fixture.kickoff_at`, reject. The client also shows a countdown and disables the form, but this is cosmetic only — the server is the authority.

**When to use:** Always. Never trust client-side lockout for real-money competitions.

**Trade-offs:** Adds latency on every prediction write; worth it for correctness.

**Example:**
```typescript
// middleware.ts or API route handler
async function assertPredictionEditable(fixtureId: string) {
  const fixture = await db.fixtures.findById(fixtureId)
  if (!fixture) throw new NotFoundError()
  if (new Date() >= new Date(fixture.kickoff_at)) {
    throw new LockoutError(`Fixture locked at ${fixture.kickoff_at}`)
  }
}
```

### Pattern 2: Two-Phase Bonus Application

**What:** Bonus awards have two distinct states: `member_pick` (what the member submitted) and `confirmed` (what George approved). Points are only calculated including the bonus after George flips `confirmed = true`. This prevents premature bonus scoring and gives George a review step.

**When to use:** Any admin-gated scoring decision (bonuses, additional prizes, Double Bubble toggle).

**Trade-offs:** Slightly more complex data model; eliminates the biggest risk of incorrect payouts.

**Example:**
```typescript
// Scoring engine checks confirmation before applying bonus
function applyBonus(prediction: Prediction, bonus: BonusConfig): number {
  if (!bonus.confirmed_by_admin) return 0
  switch (bonus.type) {
    case 'golden_glory': return prediction.base_points * 2  // doubles
    case 'double_bubble': return prediction.base_points * 2  // doubles all GW points
    case 'standard_20pt': return prediction.bonus_correct ? 20 : 0
  }
}
```

### Pattern 3: Gameweek State Machine

**What:** Each gameweek has an explicit state that controls what operations are allowed. Transitions are admin-triggered or automatic (all results in).

**States:**
```
draft → open → in_progress → awaiting_confirmation → complete → archived
```

- `draft`: fixtures not yet published
- `open`: members can submit predictions
- `in_progress`: some fixtures locked (kick-off passed), others still open
- `awaiting_confirmation`: all results in, scoring done, waiting for George to confirm bonuses
- `complete`: George confirmed, reports generated, standings updated
- `archived`: end of season, read-only

**When to use:** This state determines what the UI shows (prediction form vs results view) and what API routes accept.

**Trade-offs:** Adds a state management concern; eliminates countless "is this gameweek editable?" checks scattered across the codebase.

### Pattern 4: Append-Only Audit Log

**What:** Every scoring calculation, bonus application, manual override, and admin action writes an immutable record to `audit_log`. The log is the paper trail George needs to verify manually.

**When to use:** All scoring mutations, all admin actions.

**Trade-offs:** Slightly more storage; critical for trust in a real-money competition.

---

## Data Flow

### Prediction Submission Flow

```
Member submits prediction form
    ↓
POST /api/predictions
    ↓
middleware: assert session valid
    ↓
LockoutGuard: assert fixture not started (kick-off check)
    ↓
Visibility check: gameweek must be in 'open' or 'in_progress' state
    ↓
Upsert prediction row (one row per member+fixture)
    ↓
Return confirmation to client
```

### Results → Points Flow

```
Vercel Cron: /api/cron/sync-results (every 15 min on matchdays)
    ↓
Football API → fetch results for in-progress fixtures
    ↓
Update fixture.result + fixture.status in DB
    ↓
If all fixtures in gameweek have results:
    ↓
    Trigger ScoringEngine.calculateGameweek(gwId)
        ↓
        For each prediction:
            base_points = calcBase(prediction, result)   // 10/30
            bonus_points = applyBonus(prediction, bonus) // gated by confirmed
            total = base + bonus
        ↓
        Write scored_predictions rows
        ↓
        Update member season standings (running total)
        ↓
        Write audit_log entries
    ↓
    Set gameweek.status = 'awaiting_confirmation'
    ↓
    Email George: "GW{n} results in — review bonuses"
```

### Admin Bonus Confirmation Flow

```
George opens admin/bonuses/[gw]
    ↓
Reviews member bonus picks vs results
    ↓
George clicks "Confirm" on bonus awards
    ↓
POST /api/admin/bonuses/confirm
    ↓
    Set bonus.confirmed_by_admin = true
    ↓
    Re-run ScoringEngine.calculateGameweek(gwId) (bonus now included)
    ↓
    Update standings
    ↓
    Write audit_log
    ↓
George triggers PDF/XLSX generation → email to George
    ↓
George publishes report → gameweek.status = 'complete'
```

### Local Fallback Tool Flow

```
George triggers "Export All Data" from admin panel
    ↓
GET /api/admin/export → JSON bundle:
    { members, fixtures, predictions, results, standings, los_state, bonuses }
    ↓
Downloaded as predictor-data-[date].json
    ↓
George opens tools/fallback/index.html in browser (no server needed)
    ↓
Loads JSON file → renders standings, predictions, scoring
    ↓
George can manually verify/continue competition from spreadsheet data
```

### Visibility Gating Flow

```
Member requests GW predictions (their own or others')
    ↓
GET /api/predictions?gw=N
    ↓
If gameweek.status in ['open', 'in_progress']:
    → Return only requesting member's own predictions
If gameweek.status = 'complete':
    → Return all members' predictions (now public)
George (admin role):
    → Always return all predictions regardless of state
```

---

## Key Data Model Boundaries

### Core Entities and Their Owners

| Entity | Written by | Read by | Notes |
|--------|-----------|---------|-------|
| `fixtures` | FixtureSync cron + admin override | Everyone | Source of truth for kick-off times |
| `predictions` | Members (pre-lockout) | Member (own), George (all), public (post-GW) | One row per member+fixture |
| `results` | FixtureSync cron + admin override | Scoring engine | Stored on fixture row |
| `scored_predictions` | Scoring engine only | Everyone | Derived — never manually edited |
| `bonus_config` | George (admin) | Members (to know what to pick), Scoring engine | One row per gameweek |
| `bonus_picks` | Members during prediction | George for confirmation | Part of prediction submission |
| `los_picks` | Members (pre-GW), admin | LOS tracker | One per member per GW |
| `standings` | Scoring engine | Everyone | Denormalized for fast reads |
| `audit_log` | All scoring/admin mutations | George only | Append-only |
| `seasons` | Admin (season reset) | Everyone | Archives previous state |

### Component Communication Map

| From | To | Method | Notes |
|------|----|--------|-------|
| Member UI | API Routes | HTTP (fetch) | All via Next.js API |
| Admin Panel | API Routes | HTTP (fetch) | Admin routes require `role = 'admin'` check |
| API Routes | Supabase | Supabase JS client | Server-side only (never expose service key to client) |
| Cron Jobs | API Routes | HTTP (Vercel Cron → /api/cron/*) | Secured with CRON_SECRET header |
| Cron Jobs | Football API | HTTP (football-data.org) | Rate-limited on free tier (10 req/min) |
| Scoring Engine | DB | Direct via server action | Called from API route, writes to scored_predictions |
| ReportGen | DB | Read-only query | Generates snapshot from DB state |
| ReportGen | Email (Resend) | Resend API | Free tier: 100 emails/day |
| Local Fallback | None | Zero — reads local JSON file | Must have no external dependencies |

---

## Scaling Considerations

This system targets 100 users on free-tier infrastructure. Scale analysis is bounded accordingly.

| Concern | At 50-100 users (target) | At 500+ users (hypothetical) |
|---------|--------------------------|------------------------------|
| DB queries | Supabase free tier (500MB, 2 connections) is fine | Would need paid Supabase |
| API calls | Football API free tier (10 req/min) is fine for cron | Same — not user-driven |
| PDF generation | Runs once per GW — no concurrency issue | Queue it |
| Concurrent prediction submissions | Gameweek open = ~50 users, not simultaneous | Fine even at 500 |
| Email | 38 GWs × 1-2 emails = ~76 emails/season to George | Well within Resend free tier |
| Vercel serverless | Hobby tier sufficient; no long-running processes | Fine |

**Free-tier risk:** Supabase free tier pauses after 7 days inactivity. Must use a "keep-alive" cron ping or upgrade to Pro ($25/mo) before the season starts.

---

## Suggested Build Order (Phase Dependencies)

This ordering respects hard data dependencies — each phase needs the prior to be functional.

```
1. Foundation
   DB schema + Supabase setup + Auth
   (Everything depends on this)
        ↓
2. Fixture Layer
   Football API sync + fixture display + kick-off times
   (Lockout and predictions depend on fixtures existing)
        ↓
3. Prediction Submission
   Member form + server-side lockout + per-fixture lock UI
   (Scoring depends on predictions existing)
        ↓
4. Scoring Engine
   Pure calculation functions + result entry (manual first) + point display
   (Standings, bonuses, reports all depend on scores)
        ↓
5. Admin Panel
   Bonus management + result override + member management + double bubble
   (Needs scoring engine to confirm what to recalculate)
        ↓
6. Bonus System
   Bonus pick submission (member) + admin confirmation + score recalculation
   (Depends on scoring engine and admin panel)
        ↓
7. Last One Standing
   Parallel competition — independent state, but same fixture/gameweek model
   (Can be built after core prediction loop works)
        ↓
8. Reports & Export
   PDF generation + XLSX + email delivery + public report view
   (Needs complete scoring and standings data)
        ↓
9. Local Fallback Tool
   Offline HTML tool + data export endpoint
   (Needs the full data model to be stable before building export)
        ↓
10. Polish & Pre-Season
    Pre-season predictions + mid-season import + member profiles + UI polish
    (Built last — depends on stable data structures)
```

---

## Anti-Patterns

### Anti-Pattern 1: Client-Side Lockout Only

**What people do:** Disable the prediction form in the browser when kick-off time passes.
**Why it's wrong:** Any member can bypass client-side checks with browser dev tools or direct API calls. In a real-money competition, this is a trust-breaking bug.
**Do this instead:** Server-side lockout as the only enforced layer. Client-side is UI decoration only.

### Anti-Pattern 2: Scoring Computed On-The-Fly at Read Time

**What people do:** Store predictions and results, then calculate points when displaying the standings.
**Why it's wrong:** Scoring rules for this competition (Golden Glory, Double Bubble, bonus confirmation gates) are complex enough that on-the-fly calculation is slow, hard to audit, and prone to showing inconsistent states mid-confirmation.
**Do this instead:** Persist scored values in `scored_predictions` and `standings`. Recalculate and re-persist whenever a scoring input changes (result updated, bonus confirmed). Audit log records every recalculation.

### Anti-Pattern 3: Monolithic "Calculate Everything" Endpoint

**What people do:** One giant recalculate-all endpoint triggered after any result change.
**Why it's wrong:** With 38 gameweeks × 50 members × 10+ fixtures, recalculating the entire season on every result is wasteful and will hit serverless function timeouts on Vercel hobby tier (10s limit).
**Do this instead:** Scope recalculation to a single gameweek. Season standings are updated incrementally (add/subtract delta). Full season recalculation only needed for admin "verify all" tool.

### Anti-Pattern 4: Storing George's Bonus Confirmation in the Prediction Row

**What people do:** Put a `bonus_confirmed` flag on the member's prediction record, updated by George.
**Why it's wrong:** Confirmation is a per-gameweek admin action, not a per-prediction fact. Makes querying and auditing harder.
**Do this instead:** Store `bonus_config` at the gameweek level with `confirmed_by_admin` flag. Scoring engine reads gameweek config, not individual prediction rows, to determine whether bonus applies.

### Anti-Pattern 5: Visibility Enforced Only in the Frontend

**What people do:** Show/hide other members' predictions in the UI based on gameweek state.
**Why it's wrong:** API route returns all predictions regardless; any member can call the API directly.
**Do this instead:** The `/api/predictions` route checks `gameweek.status` server-side. If not complete, it only returns the requesting member's own predictions. George's admin token bypasses this check.

---

## Integration Points

### External Services

| Service | Integration Pattern | Free Tier Limits | Fallback |
|---------|---------------------|-----------------|---------|
| football-data.org | REST polling via Vercel Cron every 15 min on matchdays | 10 req/min, 10 req/min burst | Admin manual result entry |
| Supabase Auth | Supabase JS SDK, Next.js middleware | 50,000 MAU free | N/A |
| Supabase DB | Supabase JS SDK server-side only | 500MB, pauses after 7-day inactivity | Export to JSON + local tool |
| Resend (email) | Resend SDK, triggered post-GW | 100 emails/day, 3,000/month free | George checks site directly |
| Vercel Cron | Cron config in vercel.json, secured with secret | 2 cron jobs on Hobby tier | Manual trigger from admin panel |
| pdfkit / react-pdf | Server-side only, no browser dep | N/A (library) | XLSX only as fallback |
| ExcelJS | Server-side XLSX generation | N/A (library) | — |

### Internal Boundaries

| Boundary | Communication | Direction | Notes |
|----------|---------------|-----------|-------|
| Member UI ↔ API | HTTP REST | Bidirectional | No direct DB access from client |
| Admin Panel ↔ Scoring Engine | Via API route | Admin triggers → engine writes | Engine never called directly from client |
| FixtureSync ↔ Football API | HTTP polling | Outbound only | Cron-triggered, not user-triggered |
| Scoring Engine ↔ DB | Read predictions/results → write scores | Engine reads, then writes | Atomic gameweek recalculation |
| ReportGen ↔ DB | Read-only snapshot | ReportGen reads | Generates from stable `complete` state |
| Local Fallback ↔ Export | JSON file | One-way read | No server calls after download |

---

## Sources

- Architecture derived from project requirements analysis (PROJECT.md) — HIGH confidence
- Next.js App Router route group patterns: [nextjs.org/docs/app/building-your-application/routing/route-groups](https://nextjs.org/docs/app/building-your-application/routing/route-groups) — HIGH confidence
- Supabase free tier limits (500MB DB, 50k MAU, pause after 7-day inactivity): [supabase.com/pricing](https://supabase.com/pricing) — HIGH confidence (well-documented)
- Vercel Hobby tier cron limits (2 cron jobs): [vercel.com/docs/cron-jobs](https://vercel.com/docs/cron-jobs) — HIGH confidence
- football-data.org free tier (10 req/min): [football-data.org/documentation/quickstart](https://www.football-data.org/documentation/quickstart) — MEDIUM confidence (verify current limits)
- Resend free tier (100 emails/day): [resend.com/pricing](https://resend.com/pricing) — HIGH confidence
- Serverless function timeout on Vercel Hobby (10s): Vercel docs — HIGH confidence

---

*Architecture research for: Premier League Score Predictor competition platform*
*Researched: 2026-04-11*
