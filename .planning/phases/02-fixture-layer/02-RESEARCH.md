# Phase 2: Fixture Layer - Research

**Researched:** 2026-04-11
**Domain:** Premier League fixture sync (football-data.org), timezone handling, server-side lockout, Supabase schema design
**Confidence:** HIGH (core stack verified), MEDIUM (API response shape partially confirmed)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Fixture Display**
- Teams + kick-off time only per fixture (no venue/stadium)
- Team badges (crests) always shown alongside team names — sourced from football-data.org API
- BST/GMT timezone shown explicitly on every kick-off time (e.g., "15:00 BST"), not just once at the top
- Fixtures always sorted by kick-off time within a gameweek (no manual reordering)
- Rescheduled fixtures show a visible "Rescheduled" badge/flag

**Gameweek Navigation**
- Members can browse all gameweeks — past, present, and future
- Navigation via prev/next arrows AND a dropdown picker
- Past gameweeks show fixtures, results, and the member's own predictions (read-only)
- Members can submit predictions up to 3 weeks in advance of the current gameweek
- Beyond the 3-week prediction window, future gameweeks are visible read-only
- Gameweeks marked "Complete" with a green badge when all fixtures have finished

**All-Fixtures Page**
- Dedicated page showing all 380 season fixtures
- Dropdown filter with all 20 PL teams (with badges)
- Accessible to all logged-in members and admins (not public)

**Rescheduling and Predictions**
- No "void" concept — postponed fixtures will always be played eventually
- Predictions stay and remain editable until the (rescheduled) kick-off time
- Predictions carry over automatically when fixture is rescheduled — not wiped
- Members get BOTH email notification AND dashboard notice when a predicted fixture is rescheduled
- If a fixture moves to a different gameweek, predictions move with it

**Admin Fixture Management**
- Fixture management lives under the existing "Gameweeks" sidebar link
- George can manually add, edit, and move fixtures between gameweeks
- George gets admin notification when API sync moves a fixture to a different gameweek
- Fixtures always sorted by kick-off time — no manual reordering

**API Sync Behaviour**
- Pull entire season's fixtures on first sync (all 380 matches)
- First sync happens automatically on deploy
- George has a "Sync Now" button in admin for manual refresh
- "Last synced" timestamp shown on admin dashboard AND gameweeks page
- George always notified on sync failure (every time)

**Team Data**
- Dedicated teams table in database with name, short code, badge URL
- Fixtures reference team IDs

**Lockout UX**
- Locked fixtures appear greyed out with a lock icon
- Lockout happens exactly at kick-off time (no buffer)
- Countdown timer shown only for fixtures kicking off today
- Amber/orange warning colour on fixtures within 30 minutes of kick-off
- Pulsing red "LIVE" badge on fixtures currently being played (no live score)
- Members manually refresh the page to see status changes (no auto-polling)

### Claude's Discretion
- Fixture layout style (cards vs table rows vs hybrid)
- Smart default gameweek landing (current GW with open fixtures vs most recent completed)
- Admin gameweek page layout and fixture management form design
- Sync frequency scheduling
- Sync log visibility and format
- Confirmation dialog policy on fixture edits
- Whether to show prediction count before editing
- Postponed fixture visual treatment
- Fixture status storage approach (database column vs derived from data)
- Admin gameweek status overview (what stats to show alongside fixtures)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FIX-01 | Premier League fixtures auto-loaded from football-data.org API per gameweek | football-data.org v4 API confirmed; `/v4/competitions/PL/matches` returns all 380 fixtures; free tier covers PL |
| FIX-02 | Fixtures clearly grouped by gameweek with midweek vs weekend distinction | `matchday` field on each match + `utcDate` enables grouping; midweek = Mon-Thu, weekend = Fri-Sun |
| FIX-03 | Per-fixture lockout at kick-off time — server-enforced, no submissions or edits after kick-off | Server action compares `new Date() > fixture.kickoff_time`; RLS policy enforces same at DB layer |
| FIX-04 | Postponed/rescheduled matches handled explicitly | API status field: POSTPONED, SUSPENDED; upsert on `external_id` handles reschedule updates |
| FIX-05 | George can manually add, edit, or correct fixtures as fallback | Admin server actions with Zod validation; Supabase admin client bypasses RLS for admin ops |
</phase_requirements>

---

## Summary

This phase introduces the fixture data layer for George's Predictor. The primary external dependency is the football-data.org API (v4), which provides all Premier League fixture, team, and crest data on the free tier at 10 requests/minute. One API call (`GET /v4/competitions/PL/matches`) returns all 380 season fixtures. The sync runs via a Vercel cron job — critically, the Vercel Hobby plan limits cron jobs to **once per day**, meaning sync frequency is inherently constrained. A manual "Sync Now" button in admin compensates for this.

Timezone handling must use `date-fns-tz` with the `formatInTimeZone` function and `Europe/London` IANA timezone. This correctly returns "BST" in summer and "GMT" in winter, and because it runs timezone conversion server-side (not via `Intl.DateTimeFormat` which has locale-dependent behavior), it avoids SSR hydration mismatches. All kick-off times are stored as UTC `timestamptz` in Postgres and converted to London time only for display.

Server-side lockout is implemented in Next.js server actions: before accepting a prediction, the action fetches the fixture's `kickoff_time` from the database and checks `new Date() > kickoffTime`. An RLS policy using `now()` adds a second enforcement layer. Client-side UI (greyed-out inputs, lock icon) is cosmetic and must not be the sole guard.

**Primary recommendation:** Store all kick-offs as UTC `timestamptz`; use `date-fns-tz` for display; upsert fixtures by `external_id` (football-data.org match ID) for idempotent syncs; enforce lockout in server action + RLS.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| date-fns-tz | ^3.x | BST/GMT-aware kick-off display | `formatInTimeZone(date, 'Europe/London', 'HH:mm zzz')` returns correct BST/GMT label; avoids Intl locale bugs |
| @supabase/supabase-js | ^2.103.0 (already installed) | DB access for fixture CRUD and upsert | Already in project; admin client bypasses RLS for sync writes |
| zod | ^4.3.6 (already installed) | Input validation for fixture edit/add forms | Already used in project; consistent with admin.ts patterns |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| next/image | built-in (Next.js 16) | Render team badge crests | Needs `remotePatterns` config for `crests.football-data.org`; use `unoptimized` prop for SVG files |
| lucide-react | ^1.8.0 (already installed) | Lock icon, calendar icon, badge icons | Already in sidebar; consistent icon set |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| date-fns-tz | Intl.DateTimeFormat | `Intl` with `timeZoneName: 'short'` returns "BST" only with `en-GB` locale, returns "GMT+1" with `en-US` — locale-dependent and causes SSR hydration mismatches |
| date-fns-tz | luxon | Luxon is heavier; date-fns-tz is the project standard and already pairs with date-fns patterns |
| Vercel cron | Supabase pg_cron | pg_cron IS available on Supabase free tier; could call the sync API route; however, Vercel cron is simpler and keeps sync logic in Next.js, not DB layer |

**Installation:**
```bash
npm install date-fns-tz
```

---

## Architecture Patterns

### Recommended Database Schema (new tables for this phase)

```sql
-- Teams table (populated from API; reused by future phases)
CREATE TABLE public.teams (
  id           uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id  int   NOT NULL UNIQUE,   -- football-data.org team ID
  name         text  NOT NULL,
  short_name   text  NOT NULL,
  tla          text  NOT NULL,           -- 3-letter abbreviation
  crest_url    text,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Gameweeks table
CREATE TABLE public.gameweeks (
  id           uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  number       int   NOT NULL UNIQUE,    -- 1-38
  season       int   NOT NULL,           -- e.g. 2025
  status       text  NOT NULL DEFAULT 'scheduled'
                 CHECK (status IN ('scheduled', 'active', 'complete')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Fixtures table
CREATE TABLE public.fixtures (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id     int         NOT NULL UNIQUE,   -- football-data.org match ID
  gameweek_id     uuid        NOT NULL REFERENCES public.gameweeks(id),
  home_team_id    uuid        NOT NULL REFERENCES public.teams(id),
  away_team_id    uuid        NOT NULL REFERENCES public.teams(id),
  kickoff_time    timestamptz NOT NULL,           -- stored UTC
  status          text        NOT NULL DEFAULT 'SCHEDULED'
                    CHECK (status IN ('SCHEDULED','TIMED','IN_PLAY','PAUSED','FINISHED','POSTPONED','SUSPENDED','CANCELLED','AWARDED')),
  is_rescheduled  boolean     NOT NULL DEFAULT false,
  home_score      int,
  away_score      int,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Sync log
CREATE TABLE public.sync_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  synced_at   timestamptz NOT NULL DEFAULT now(),
  success     boolean     NOT NULL,
  fixtures_updated int    NOT NULL DEFAULT 0,
  error_message text
);
```

### Recommended File/Folder Structure

```
src/
├── app/
│   ├── (admin)/admin/
│   │   └── gameweeks/
│   │       ├── page.tsx              # Admin gameweeks list + fixture management
│   │       └── [gwNumber]/
│   │           └── page.tsx          # Single gameweek fixture management
│   ├── (member)/
│   │   ├── dashboard/
│   │   │   └── page.tsx              # Updated: add fixtures section
│   │   ├── gameweeks/
│   │   │   ├── page.tsx              # Member gameweek view (redirects to current)
│   │   │   └── [gwNumber]/
│   │   │       └── page.tsx          # Fixtures for a gameweek (read-only this phase)
│   │   └── fixtures/
│   │       └── page.tsx              # All-fixtures page with team filter
│   └── api/
│       └── sync-fixtures/
│           └── route.ts              # Cron + manual sync endpoint
├── lib/
│   ├── supabase/
│   │   └── types.ts                  # Extended with TeamRow, GameweekRow, FixtureRow
│   ├── validators/
│   │   └── admin.ts                  # Extended with addFixtureSchema, editFixtureSchema
│   └── fixtures/
│       ├── football-data-client.ts   # football-data.org API wrapper
│       ├── sync.ts                   # Sync logic: fetch + upsert
│       └── timezone.ts               # formatKickoffUK() helper
├── actions/
│   └── admin/
│       └── fixtures.ts               # addFixture, editFixture, moveFixture server actions
└── components/
    ├── fixtures/
    │   ├── fixture-card.tsx          # Single fixture display
    │   ├── gameweek-view.tsx         # Grouped fixtures for a gameweek
    │   └── team-badge.tsx            # Team crest + name component
    └── admin/
        └── fixture-form.tsx          # Add/edit fixture form
```

### Pattern 1: Idempotent Fixture Upsert

**What:** All 380 fixtures are upserted on every sync using `external_id` as the conflict key. This makes every sync safe to run multiple times.
**When to use:** On cron trigger and "Sync Now" button.

```typescript
// Source: Supabase JS upsert docs + football-data.org v4 match response
const { error } = await adminSupabase
  .from('fixtures')
  .upsert(
    mappedFixtures,
    { onConflict: 'external_id' }
  )
// mappedFixtures: football-data match[] -> our FixtureInsert[]
// Requires UNIQUE INDEX on fixtures(external_id)
```

### Pattern 2: UTC Storage + London Display

**What:** Store all kick-offs as UTC `timestamptz`. Display in Europe/London timezone (auto-handles BST/GMT).
**When to use:** Every kick-off time display.

```typescript
// Source: date-fns-tz npm docs; verified via WebSearch cross-reference
import { formatInTimeZone } from 'date-fns-tz'

export function formatKickoffUK(utcDateString: string): string {
  // utcDateString from DB is e.g. "2025-08-16T14:00:00+00:00"
  const date = new Date(utcDateString)
  // Returns "15:00 BST" or "15:00 GMT" depending on DST
  return formatInTimeZone(date, 'Europe/London', 'HH:mm zzz')
}

export function formatKickoffFullUK(utcDateString: string): string {
  return formatInTimeZone(date, 'Europe/London', 'EEE d MMM, HH:mm zzz')
  // e.g. "Sat 16 Aug, 15:00 BST"
}
```

**CRITICAL:** The `zzz` token in `formatInTimeZone` (from date-fns-tz) returns the timezone abbreviation of the *target* timezone, not the system timezone. This means it returns "BST" in summer and "GMT" in winter consistently regardless of server locale — confirmed by date-fns-tz documentation. Contrast: `Intl.DateTimeFormat` with `timeZoneName: 'short'` returns "BST" only for `en-GB` locale, returning "GMT+1" for `en-US` locale.

### Pattern 3: Server-Side Lockout in Server Action

**What:** Before accepting any prediction write, the server action validates that `now() < fixture.kickoff_time`.
**When to use:** Every prediction submit or edit action (Phase 3 uses this; Phase 2 builds the fixture data that enables it).

```typescript
// Source: established pattern from existing project server actions (src/actions/auth.ts)
// Applied to prediction submission in Phase 3
'use server'

export async function submitPrediction(input: PredictionInput) {
  const supabase = await createServerSupabaseClient()
  
  // Fetch fixture's kickoff time
  const { data: fixture } = await supabase
    .from('fixtures')
    .select('kickoff_time, status')
    .eq('id', input.fixture_id)
    .single()

  if (!fixture) return { error: 'Fixture not found' }

  // Server-side lockout check — client-side alone is insufficient
  if (new Date() >= new Date(fixture.kickoff_time)) {
    return { error: 'This fixture has kicked off — predictions are locked' }
  }
  // ... proceed with insert
}
```

**Supporting RLS policy (double enforcement):**
```sql
-- Predictions INSERT policy — rejects if kickoff has passed
CREATE POLICY predictions_insert_before_kickoff
  ON public.predictions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.fixtures f
      WHERE f.id = fixture_id
        AND f.kickoff_time > now()
    )
  );
```

### Pattern 4: football-data.org Sync API Route

**What:** Next.js API route that fetches all PL fixtures, upserts teams + fixtures.
**When to use:** Triggered by Vercel cron daily AND by admin "Sync Now" button.

```typescript
// Source: established keep-alive API route pattern (src/app/api/keep-alive/route.ts)
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // 1. Verify CRON_SECRET (same pattern as keep-alive)
  // 2. Fetch: GET /v4/competitions/PL/matches (returns all 380 fixtures)
  // 3. Extract unique teams from matches, upsert to teams table
  // 4. Upsert gameweeks (matchday 1-38)
  // 5. Upsert fixtures (onConflict: 'external_id')
  // 6. Detect rescheduled fixtures (kickoff_time changed) → create admin notification
  // 7. Write sync_log row
  // 8. Return { ok: true, fixtures_updated: N }
}
```

**Vercel cron schedule (vercel.json):**
```json
{
  "crons": [
    { "path": "/api/keep-alive", "schedule": "0 9 * * *" },
    { "path": "/api/sync-fixtures", "schedule": "0 7 * * *" }
  ]
}
```

Note: Vercel Hobby plan allows **100 cron jobs per project**, but each can run **only once per day** maximum. The `±59 minute` precision means `0 7 * * *` fires sometime between 07:00 and 07:59 UTC. This is sufficient for fixture freshness — real Premier League fixture rescheduling announcements are made days in advance, not hours.

### Pattern 5: Reschedule Detection During Sync

**What:** During sync, compare incoming `utcDate` against stored `kickoff_time`. If changed, mark `is_rescheduled = true` and notify admin.

```typescript
// Before upsert, query stored kickoff times for existing fixtures
const { data: existing } = await adminSupabase
  .from('fixtures')
  .select('external_id, kickoff_time, gameweek_id')
  .in('external_id', incomingIds)

const rescheduled = incoming.filter(match => {
  const stored = existingMap.get(match.id)
  return stored && stored.kickoff_time !== match.utcDate
})

// For rescheduled: set is_rescheduled = true, update kickoff_time
// Create admin_notification for each reschedule
// Email members who have predictions for those fixtures (Phase 3 will provide that query)
```

### Anti-Patterns to Avoid

- **Client-side-only lockout:** Never rely solely on disabled inputs or JavaScript countdown to prevent submissions. Client state is trivially bypassed. Always enforce in server action.
- **Storing timezone in DB:** Never store "BST" or "GMT" as a value. Store UTC only. BST/GMT is determined at display time by `date-fns-tz`.
- **Using `Intl.DateTimeFormat` for BST/GMT label:** With `en-US` locale it returns "GMT+1" not "BST". Use `formatInTimeZone` from `date-fns-tz` with `zzz` token.
- **Individual API calls per fixture for sync:** At 10 req/min free tier, 380 individual calls would take 38 minutes and fail. Use the single `GET /v4/competitions/PL/matches` call that returns all 380.
- **Caching fixture data in Next.js route cache:** Use `dynamic = 'force-dynamic'` on sync endpoints. Fixture data changes — stale cache causes missed reschedule detection.
- **Upsert without UNIQUE INDEX:** `onConflict: 'external_id'` requires a `UNIQUE INDEX` (or `UNIQUE` constraint) on `fixtures(external_id)`. Without it, Postgres throws `42P10`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| BST/GMT timezone conversion | Custom DST offset logic | `date-fns-tz` `formatInTimeZone` | DST transition dates change; IANA timezone database handles this correctly |
| Fixture upsert logic | Custom "insert or update" queries | Supabase `.upsert()` with `onConflict` | Supabase wraps `INSERT ... ON CONFLICT DO UPDATE`; single atomic operation |
| Midweek vs weekend grouping | Hard-coded day-of-week logic with manual edge cases | Derive from `utcDate` converted to London time: Monday-Thursday = midweek | DST affects which "day" it falls on in UK time |

**Key insight:** The entire external dependency (football-data.org) has done the hard work of normalising PL fixture data, team IDs, and crest URLs. Trust the API and map it cleanly to your schema — don't re-solve the data sourcing problem.

---

## Common Pitfalls

### Pitfall 1: Vercel Hobby Cron Runs Once Per Day Maximum

**What goes wrong:** Developer writes a cron expression like `0 * * * *` (hourly). Vercel rejects deployment: "Hobby accounts are limited to daily cron jobs."
**Why it happens:** Vercel Hobby tier limits cron to once per day with ±59 minute precision.
**How to avoid:** Design sync strategy to be correct with once-daily sync. Admin "Sync Now" button covers urgent manual refresh. Premier League fixture reschedules are typically announced days ahead.
**Warning signs:** Deployment fails with error about cron frequency.

### Pitfall 2: SSR Hydration Mismatch on Timezone Labels

**What goes wrong:** Server renders "GMT+1", client renders "BST" (or vice versa). React throws hydration mismatch warning.
**Why it happens:** `Intl.DateTimeFormat` `timeZoneName: 'short'` output depends on locale — `en-US` returns "GMT+1", `en-GB` returns "BST". Server and client may use different system locales.
**How to avoid:** Use `formatInTimeZone` from `date-fns-tz` which always returns the IANA abbreviation ("BST"/"GMT") regardless of system locale. Run the conversion server-side and pass the formatted string to the client.
**Warning signs:** Console shows "Text content did not match" on kick-off time elements.

### Pitfall 3: football-data.org Match Object Has Inline Team Data (Not Full Team Objects)

**What goes wrong:** Developer assumes the match response has full team objects (with crest URLs). It has only `id`, `name`, `shortName`, `tla`, `crest` in the team sub-object — no squad, venue, etc.
**Why it happens:** The API returns "slim" team objects in the matches endpoint to reduce payload size.
**How to avoid:** Extract team data from inline match objects during sync. The fields `homeTeam.id`, `homeTeam.name`, `homeTeam.shortName`, `homeTeam.tla`, `homeTeam.crest` are sufficient for the teams table.
**Warning signs:** Sync runs but team table has no crest URLs.

### Pitfall 4: Upsert Missing UNIQUE INDEX on external_id

**What goes wrong:** `supabase.from('fixtures').upsert(..., { onConflict: 'external_id' })` throws error `42P10: there is no unique or exclusion constraint matching the ON CONFLICT specification`.
**Why it happens:** PostgREST's upsert requires a `UNIQUE INDEX` or `UNIQUE CONSTRAINT` on the conflict column.
**How to avoid:** Add `UNIQUE` on `fixtures(external_id)` and `teams(external_id)` in the migration SQL.
**Warning signs:** Upsert call returns `{ error: { code: '42P10' } }`.

### Pitfall 5: next/image SVG crests Render Blank

**What goes wrong:** Team badge `<Image>` renders as a broken image or blank.
**Why it happens:** Two sub-issues — (a) `crests.football-data.org` domain not in `next.config.ts` `remotePatterns`; (b) `next/image` does not optimize SVGs by default and may block them.
**How to avoid:** Add `remotePatterns` entry for `crests.football-data.org`. For SVG crests, use `unoptimized` prop on `<Image>` or use standard `<img>` tag.
**Warning signs:** Console error "Invalid src prop ... hostname not configured".

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'crests.football-data.org',
        pathname: '/**',
      },
    ],
  },
}
```

### Pitfall 6: Midweek/Weekend Grouping Must Use London Time, Not UTC

**What goes wrong:** A match with `utcDate: "2025-08-18T19:00:00Z"` (Monday 19:00 UTC) is correctly a Monday-night fixture in the UK. In BST (UTC+1), it's 20:00 BST Monday — midweek. Developer checks UTC day-of-week, which is also Monday — this happens to be correct, but a match on `"2025-10-26T00:00:00Z"` (Sunday midnight UTC) is actually Saturday 23:00 GMT (BST transition date) — grouping by UTC Sunday would be wrong.
**Why it happens:** BST transitions create 1-hour offsets that shift apparent day boundaries.
**How to avoid:** Convert to London time before extracting day-of-week for midweek/weekend grouping.

```typescript
import { formatInTimeZone } from 'date-fns-tz'
const dayOfWeek = parseInt(formatInTimeZone(kickoffUTC, 'Europe/London', 'i')) // 1=Mon, 7=Sun
const isMidweek = dayOfWeek >= 1 && dayOfWeek <= 4 // Mon-Thu
```

---

## Code Examples

### football-data.org API Response (Match Object Shape)

```typescript
// Source: docs.football-data.org/general/v4/match.html + WebSearch verified
interface FootballDataMatch {
  id: number                          // external_id for our fixtures table
  utcDate: string                     // ISO 8601 UTC, e.g. "2025-08-16T14:00:00Z"
  status: 'SCHEDULED' | 'TIMED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | 
          'POSTPONED' | 'SUSPENDED' | 'CANCELLED' | 'AWARDED'
  matchday: number                    // 1-38 (gameweek number)
  stage: string                       // "REGULAR_SEASON"
  homeTeam: {
    id: number                        // external_id for teams table
    name: string                      // "Arsenal FC"
    shortName: string                 // "Arsenal"
    tla: string                       // "ARS"
    crest: string                     // "https://crests.football-data.org/57.png"
  }
  awayTeam: {
    id: number
    name: string
    shortName: string
    tla: string
    crest: string
  }
  score: {
    winner: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null
    fullTime: { home: number | null; away: number | null }
    halfTime: { home: number | null; away: number | null }
  }
  season: {
    id: number
    startDate: string
    endDate: string
    currentMatchday: number
  }
}

// API endpoint for all PL season fixtures (single call, returns all 380)
// GET https://api.football-data.org/v4/competitions/PL/matches
// Header: X-Auth-Token: {FOOTBALL_DATA_API_KEY}
// Optional: ?season=2025 (year of season start)
// Response: { filters: {...}, resultSet: { count: 380 }, matches: FootballDataMatch[] }
```

### Sync Logic Skeleton

```typescript
// Source: keep-alive route pattern (src/app/api/keep-alive/route.ts) adapted for sync
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.FOOTBALL_DATA_API_KEY
  const res = await fetch('https://api.football-data.org/v4/competitions/PL/matches', {
    headers: { 'X-Auth-Token': apiKey! },
    cache: 'no-store',
  })
  const data = await res.json()
  const matches: FootballDataMatch[] = data.matches

  // 1. Extract unique teams
  const teamsMap = new Map<number, TeamInsert>()
  for (const m of matches) {
    teamsMap.set(m.homeTeam.id, mapTeam(m.homeTeam))
    teamsMap.set(m.awayTeam.id, mapTeam(m.awayTeam))
  }

  // 2. Upsert teams
  await adminSupabase.from('teams').upsert([...teamsMap.values()], { onConflict: 'external_id' })

  // 3. Upsert gameweeks (matchdays 1-38)
  const gameweekNumbers = [...new Set(matches.map(m => m.matchday))]
  // ... upsert gameweeks

  // 4. Detect rescheduled fixtures before upsert
  // ... compare stored vs incoming kickoff_time

  // 5. Upsert fixtures
  await adminSupabase.from('fixtures').upsert(mappedFixtures, { onConflict: 'external_id' })

  // 6. Write sync_log row
  // 7. Return result
}
```

### Formatters (timezone.ts)

```typescript
// Source: date-fns-tz npm documentation, verified usage pattern
import { formatInTimeZone } from 'date-fns-tz'

const LONDON_TZ = 'Europe/London'

/** "15:00 BST" or "15:00 GMT" */
export function formatKickoffTime(utcString: string): string {
  return formatInTimeZone(new Date(utcString), LONDON_TZ, 'HH:mm zzz')
}

/** "Sat 16 Aug, 15:00 BST" */
export function formatKickoffFull(utcString: string): string {
  return formatInTimeZone(new Date(utcString), LONDON_TZ, 'EEE d MMM, HH:mm zzz')
}

/** Day number in London time (1=Mon … 7=Sun) for midweek/weekend grouping */
export function getLondonDayOfWeek(utcString: string): number {
  return parseInt(formatInTimeZone(new Date(utcString), LONDON_TZ, 'i'))
}

export function isMidweekFixture(utcString: string): boolean {
  const day = getLondonDayOfWeek(utcString)
  return day >= 1 && day <= 4 // Monday–Thursday
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `moment-timezone` | `date-fns-tz` v3 | 2022 onwards | Smaller bundle, tree-shakeable, same IANA support |
| `images.domains` in next.config | `images.remotePatterns` | Next.js 13 → mandatory in 16 | `domains` is deprecated; `remotePatterns` required from Next.js 16 |
| football-data.org v2 API | v4 API | May 2022 | v2 deprecated; all endpoints under `/v4/`; migration encouraged |
| Vercel cron via separate service | Native `vercel.json` crons | ~2023 | Built-in support; no third-party scheduler needed |

**Deprecated/outdated:**
- `images.domains` in next.config.ts: deprecated, use `remotePatterns` (Next.js 16 will warn or error on `domains`)
- football-data.org v2 API: use v4 only

---

## Open Questions

1. **football-data.org 2025-26 season availability confirmation**
   - What we know: PL is confirmed on free tier; 2025-26 fixtures exist (matchweek 32 confirmed live on PL site as of research date)
   - What's unclear: Whether football-data.org has the `?season=2025` fixtures fully populated, or whether the default (current season) endpoint is sufficient
   - Recommendation: During Wave 0 of planning, test `GET /v4/competitions/PL/matches` with a free API key and verify the response includes 380 matches

2. **Reschedule notification to members (email)**
   - What we know: Resend free tier allows 3,000 emails/month (100/day); project has ~30 members max
   - What's unclear: Phase 2 builds the notification infrastructure; the actual member email for rescheduling requires knowing which members have predictions for the rescheduled fixture — that's Phase 3 data
   - Recommendation: Build the notification trigger in Phase 2 but gate member emails behind a check that Phase 3's predictions table exists; admin notification always fires in Phase 2

3. **football-data.org crest URL format (SVG vs PNG)**
   - What we know: Examples show both `531.svg` and `90.png` — format varies by team
   - What's unclear: Whether all 20 PL teams have SVG crests or a mix
   - Recommendation: Use `<img>` tag with `loading="lazy"` for crests (not `<Image>` optimized) to avoid SVG optimization issues; add `crests.football-data.org` to `remotePatterns` anyway for flexibility

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 + @testing-library/react 16 |
| Config file | `vitest.config.ts` (exists) |
| Quick run command | `npx vitest run tests/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FIX-01 | `syncFixtures()` fetches from API and upserts to DB | unit | `npx vitest run tests/actions/admin/fixtures.test.ts` | ❌ Wave 0 |
| FIX-02 | `isMidweekFixture()` returns correct midweek/weekend grouping | unit | `npx vitest run tests/lib/fixtures.test.ts` | ❌ Wave 0 |
| FIX-03 | Server action rejects prediction when `now() >= kickoff_time` | unit | `npx vitest run tests/actions/admin/fixtures.test.ts` | ❌ Wave 0 |
| FIX-04 | Sync detects rescheduled fixture and sets `is_rescheduled = true` | unit | `npx vitest run tests/actions/admin/fixtures.test.ts` | ❌ Wave 0 |
| FIX-05 | `editFixture` server action validates input and updates DB | unit | `npx vitest run tests/actions/admin/fixtures.test.ts` | ❌ Wave 0 |
| FIX-02 | `formatKickoffTime()` returns "15:00 BST" in summer and "15:00 GMT" in winter | unit | `npx vitest run tests/lib/fixtures.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/lib/fixtures.test.ts tests/actions/admin/fixtures.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/lib/fixtures.test.ts` — covers `formatKickoffTime`, `isMidweekFixture` (FIX-02), timezone edge cases (BST/GMT transitions)
- [ ] `tests/actions/admin/fixtures.test.ts` — covers sync upsert logic (FIX-01), reschedule detection (FIX-04), lockout validation (FIX-03), edit action (FIX-05)
- [ ] `src/lib/fixtures/` directory — create the module (football-data-client.ts, sync.ts, timezone.ts)

---

## Sources

### Primary (HIGH confidence)
- `docs.football-data.org/general/v4/match.html` — match status values, utcDate format, team sub-object fields
- `docs.football-data.org/general/v4/competition.html` — `/v4/competitions/PL/matches` endpoint, `currentMatchday`, query params
- `docs.football-data.org/general/v4/policies.html` — free tier: 10 req/min; PL confirmed free
- `vercel.com/docs/cron-jobs/usage-and-pricing` — Hobby: once per day max, 100 cron jobs, ±59min precision
- `supabase.com/docs/reference/javascript/upsert` — `onConflict` upsert pattern
- Existing project code: `src/app/api/keep-alive/route.ts`, `src/lib/validators/admin.ts`, `src/lib/email.ts` — established patterns to follow

### Secondary (MEDIUM confidence)
- `npmjs.com/package/date-fns-tz` — `formatInTimeZone` with `zzz` token for BST/GMT; confirmed via WebSearch cross-reference with GitHub issues
- WebSearch: `Intl.DateTimeFormat` locale-dependent "BST" vs "GMT+1" issue — confirmed by multiple community sources
- WebSearch: `crests.football-data.org/{id}.svg` crest URL pattern — confirmed by API docs cross-reference
- `github.com/orgs/supabase/discussions/37405` — pg_cron available on free tier, resource-limited only

### Tertiary (LOW confidence)
- Football-data.org 2025-26 season availability: confirmed via PL site showing matchweek 32, inferred API has data but not directly tested with API key

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — date-fns-tz and Supabase upsert patterns verified via docs; existing project patterns confirmed in code
- Architecture: HIGH — follows established project conventions (server actions, admin client, RLS, API routes)
- Pitfalls: MEDIUM-HIGH — hydration mismatch and UNIQUE INDEX issues verified by official docs and community; API shape partially inferred from docs (not live-tested)
- football-data.org API: MEDIUM — free tier confirmed, endpoint structure confirmed, live 2025-26 response not directly tested

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (football-data.org API policies stable; Next.js/Supabase versions pinned in package.json)
