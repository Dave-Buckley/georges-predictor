# Phase 2: Fixture Layer - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Premier League fixtures auto-loaded from football-data.org API, displayed per gameweek with correct UK timezone handling, per-fixture server-side lockout at kick-off, and George can manually manage fixtures (add, edit, reschedule, move between gameweeks). A dedicated all-fixtures page with team filter. No scoring, no predictions submission (those are Phases 3-4) — but the fixture infrastructure supports them.

</domain>

<decisions>
## Implementation Decisions

### Fixture Display
- Teams + kick-off time only per fixture (no venue/stadium)
- Team badges (crests) always shown alongside team names — sourced from football-data.org API
- BST/GMT timezone shown explicitly on every kick-off time (e.g., "15:00 BST"), not just once at the top — important because some members are abroad
- Fixtures always sorted by kick-off time within a gameweek (no manual reordering)
- Rescheduled fixtures show a visible "Rescheduled" badge/flag so members know the date changed

### Gameweek Navigation
- Members can browse all gameweeks — past, present, and future
- Navigation via prev/next arrows AND a dropdown picker to jump to any gameweek
- Default landing: Claude's discretion (smart default based on open fixtures vs recent results)
- Past gameweeks show fixtures, results, and the member's own predictions (read-only)
- Members can submit predictions up to 3 weeks in advance of the current gameweek
- Beyond the 3-week prediction window, future gameweeks are visible read-only (fixtures shown, no prediction inputs)
- Gameweeks marked "Complete" with a green badge when all fixtures have finished

### All-Fixtures Page
- Dedicated page showing all season fixtures (all 380 matches)
- Dropdown filter with all 20 Premier League teams (with badges) to see a specific team's fixtures
- Accessible to all logged-in members and admins (not public)

### Rescheduling & Predictions
- No "void" concept — postponed fixtures will always be played eventually
- Predictions stay and remain editable until the (rescheduled) kick-off time
- When a fixture is rescheduled, predictions carry over automatically — not wiped
- Members get BOTH email notification AND dashboard notice when a fixture they predicted is rescheduled
- If a fixture moves to a different gameweek, predictions move with it

### Admin Fixture Management
- Fixture management lives under the existing "Gameweeks" sidebar link (Claude's discretion on exact layout)
- George can manually add fixtures (Claude's discretion on form design — keep it simple/idiot-proof)
- George can edit fixture details (teams, date, time)
- George can move a fixture between gameweeks manually (API also does this automatically)
- George gets admin notification when API sync moves a fixture to a different gameweek
- Confirmation dialogs on edits: Claude's discretion (lean toward always-confirm given idiot-proof principle)
- Prediction count before editing: Claude's discretion (lean toward showing it for transparency)
- Fixtures always sorted by kick-off time — no manual reordering

### API Sync Behaviour
- Pull entire season's fixtures on first sync (all 380 matches)
- First sync happens automatically on deploy — George doesn't need to trigger it
- Auto sync on a schedule: Claude's discretion on frequency (balance football-data.org free tier limits vs freshness)
- George also has a "Sync Now" button in admin to force a manual refresh
- "Last synced" timestamp shown on both admin dashboard AND gameweeks page
- George always notified on sync failure (every time, not just after repeated failures)
- Sync log/history: Claude's discretion (lean toward a simple log given paper-trail requirement)

### Team Data
- Dedicated teams table in database with name, short code, badge URL
- Fixtures reference team IDs — reusable for Last One Standing, league table, and other phases
- Team data populated during fixture sync from football-data.org API

### Lockout UX
- Locked fixtures (past kick-off) appear greyed out with a lock icon — prediction inputs disabled
- Lockout happens exactly at kick-off time (no buffer)
- Countdown timer shown only for fixtures kicking off today (not future days)
- Amber/orange warning colour on fixtures within 30 minutes of kick-off — "closing soon" feel
- Pulsing red "LIVE" badge on fixtures currently being played (no live score — that's Phase 4)
- Postponed fixtures: Claude's discretion on visual treatment (badge, position in list)
- Fixture status storage approach: Claude's discretion (stored vs derived)
- Members manually refresh the page to see status changes (no auto-polling)

### Claude's Discretion
- Fixture layout style (cards vs table rows vs hybrid) — balance PL aesthetic with mobile-first
- Smart default gameweek landing (current GW with open fixtures vs most recent completed)
- Admin gameweek page layout and fixture management form design
- Sync frequency scheduling
- Sync log visibility and format
- Confirmation dialog policy on fixture edits
- Whether to show prediction count before editing
- Postponed fixture visual treatment
- Fixture status storage approach (database column vs derived from data)
- Admin gameweek status overview (what stats to show alongside fixtures)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AdminSidebar` (`src/components/admin/sidebar.tsx`): Has "Gameweeks" nav item already wired (disabled) — enable it and point to fixture management
- `src/lib/supabase/client.ts` / `server.ts`: Supabase client utilities for data access
- `src/lib/supabase/types.ts`: Type definitions — needs extending for fixtures, gameweeks, teams
- `src/lib/validators/admin.ts`: Admin validation patterns — extend for fixture operations
- `src/lib/email.ts`: Email utility — reuse for rescheduling notifications

### Established Patterns
- Route groups: `(admin)`, `(member)`, `(public)` — fixture pages fit into member and admin groups
- Admin routes under `src/app/(admin)/admin/` — add gameweeks route here
- Server actions pattern for data mutations (used in member management)
- Notification system: `admin_notifications` table with type/title/message pattern — extend for sync failures and fixture changes

### Integration Points
- Admin sidebar: Enable "Gameweeks" link → `/admin/gameweeks`
- Member dashboard: Add fixtures/gameweek section to existing `dashboard-overview.tsx`
- API routes: `src/app/api/` — add fixture sync endpoint (triggered by cron and manual button)
- Supabase database: New tables needed (teams, fixtures, gameweeks)
- football-data.org API: External dependency for fixture and team data

</code_context>

<specifics>
## Specific Ideas

- All times must show BST or GMT explicitly because some members are abroad — this was stressed as important
- Game fixtures can change date, so the system must handle rescheduling gracefully — this is a real-world concern, not edge case
- The all-fixtures page with team filter was specifically requested — members want to see a team's full season schedule
- 3-week advance prediction window was specifically requested — members like to get ahead
- Predictions must always carry over when fixtures reschedule — never wiped

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-fixture-layer*
*Context gathered: 2026-04-11*
