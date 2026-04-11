# Phase 5: Admin Panel - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

George has a single dashboard to manage all competition operations — with full visibility into everything at all times. This phase adds: bonus management (set/confirm/override the pre-populated rotation), Double Bubble toggling, manual gameweek closing with pre-close summary, additional prize tracking with auto-detection, and dashboard expansion to surface all action items. Member approval, fixture management, result overrides, and prediction viewing are already built (Phases 1-4). Member-facing bonus picking UX and bonus point calculation engine are Phase 6 — this phase builds the admin controls and data structures that Phase 6 depends on.

</domain>

<decisions>
## Implementation Decisions

### Bonus Setup Flow
- Bonus rotation is pre-populated based on a fixed schedule (Brace Yourself GW1/16/32, Fergie Time GW2/17/33, Golden Glory GW3/18/34, etc. — full rotation defined in competition rules)
- System auto-seeds the full season schedule; George confirms each week before it goes live
- Bonus becomes visible to members immediately once confirmed
- George can change the bonus after it's been set, with a warning showing how many members have already picked — existing picks are cleared and members notified
- George can add new custom bonus types beyond the 14 predefined ones (fixed list + custom option)
- Dashboard + email reminder if a gameweek is approaching and bonus hasn't been confirmed yet
- Bonus management accessible from TWO entry points: the Bonuses sidebar page (season overview) AND the individual gameweek detail page

### Bonus Rotation Management
- Bonuses sidebar page shows a full season view — all 38 gameweeks with assigned bonus type
- George can edit any assignment from this page (swap bonus types between gameweeks, assign custom bonuses)
- Rotation auto-seeded from the defined schedule at season start; George reviews and adjusts as needed
- George can create new bonus types with a name and description

### Double Bubble
- GW10, GW20, GW30 pre-toggled on by default
- George can toggle Double Bubble on or off for ANY gameweek (not limited to defaults)
- Toggle accessible from both the Bonuses page and the gameweek detail page

### Bonus Confirmation After Gameweek
- Claude's discretion on confirmation UX (bulk table, auto-suggest with override, or one-by-one — whatever is most efficient for ~50 members)
- George must confirm/reject bonus awards before a gameweek can be closed

### Gameweek Closing Workflow
- Closing a gameweek finalises everything: locks all scores + predictions, requires bonus confirmation first, triggers report generation
- Blocked if fixtures haven't finished — show which fixtures are blocking and offer to void them
- George can reopen a closed gameweek with a confirmation dialog (explaining reports may need regenerating)
- Close button accessible from TWO entry points: gameweek detail page AND dashboard action card when ready to close
- Full pre-close summary shown: total fixtures, all results, bonus awards confirmed, total points distributed, any warnings — George reviews and confirms
- Dashboard + email notification when all fixtures in a gameweek have finished (toggleable in admin settings)

### Additional Prizes
- 13 predefined milestone prizes auto-seeded (180, Bore Draw, Christmas Present, Halloween Horror Show, Centurion, Fantastic 4, Bonus King, Easter Egg, Valentines Surprise, Dry January, Fresh Start, Knockout, Smart One Standing)
- System auto-detects triggers for detectable prizes (first to 180pts, first 0-0 correct, centurion, etc.)
- Date-based prizes (Christmas, Halloween, Easter, Valentine's) auto-snapshot standings at midnight on the relevant date
- George gets notification (dashboard + email) when a prize is triggered, then confirms to award
- George can edit the auto-detected result before confirming (e.g., correct a snapshot if standings changed)
- George can add NEW custom additional prizes mid-season alongside the original 13
- Prize list visible to members (so they know what they're chasing) but winners hidden until George confirms
- Prizes carry points and/or cash values — "applied" means adding to the member's record once confirmed

### Member-Facing Bonus Info
- Active bonus shown prominently on the gameweek prediction page AND accessible from a member bonus history page
- Bonus pick UX (how members select which game): Claude's discretion — must be obvious and idiot-proof
- Dedicated bonus info page showing all bonus types, their rules, and which gameweeks they apply to — members can reference anytime

### Dashboard Expansion
- Stays as one scrollable page (no tabs) — all action items stacked by urgency
- New action cards added: set bonus, confirm bonus awards, close gameweek, review prize triggers
- Gameweek lifecycle display: Claude's discretion on format (checklist vs action items vs summary)

### Admin Settings
- Email notification toggles added: bonus reminders, gameweek completion alerts, prize trigger alerts (toggleable on/off)
- Additional settings: Claude's discretion on what else belongs here

### Admin Audit Trail
- Claude's discretion on scope (all admin actions vs high-impact only) and presentation (dedicated log page vs inline per section)
- Must extend existing audit log pattern from Phase 4 result overrides

### Claude's Discretion
- Bonus confirmation UX for ~50 members (bulk table, auto-suggest, etc.)
- Bonus pick UX for members (inline on fixture cards vs separate step)
- Dashboard gameweek lifecycle display format
- Audit trail scope and presentation
- Admin settings page additions beyond email toggles
- Pre-close summary layout and design
- Bonus info page design for members

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AdminSidebar` (`src/components/admin/sidebar.tsx`): Has "Bonuses" nav item already wired (disabled) — enable it and point to bonus management page
- `result-override-dialog.tsx`: Impact preview pattern (shows affected count before confirming) — reuse for bonus changes and gameweek closing
- `scoring.ts` server action: Admin auth guard + audit log pattern — extend for bonus/prize admin actions
- `admin_notifications` table: Notification system with type/title/message — extend for bonus reminders, GW completion, prize triggers
- `SyncStatus` component: Status display pattern — reuse for gameweek lifecycle status
- `fixture-form.tsx` / `move-fixture-dialog.tsx`: Dialog patterns with confirmation — reuse for bonus/prize dialogs
- Admin dashboard page (`src/app/(admin)/admin/page.tsx`): Action-focused layout with stats cards — extend with new action cards
- Admin settings page (`src/app/(admin)/admin/settings/page.tsx`): Existing settings page — add email toggle controls
- Admin gameweek detail page (`src/app/(admin)/admin/gameweeks/[gwNumber]/page.tsx`): Fixture list with actions — add bonus setting and close GW controls

### Established Patterns
- Server actions for mutations (`src/actions/admin/`) — follow for bonus/prize/gameweek operations
- Zod validators in `src/lib/validators/` — extend for bonus and prize validation
- `createAdminClient()` for bypassing RLS in admin operations
- Radix UI Dialog pattern (used in result-override-dialog) — reuse for confirmation dialogs
- `force-dynamic` on data pages
- Migration pattern: numbered SQL files in `supabase/migrations/`

### Integration Points
- Sidebar: Enable "Bonuses" link → `/admin/bonuses`
- Admin dashboard: Add bonus/prize/GW action cards to existing layout
- Admin gameweek detail: Add bonus setting controls and close GW button
- Admin settings: Add email notification toggles
- New migration: `005_admin_panel.sql` — bonus types, bonus schedule, prizes, gameweek status extensions
- Member gameweek page: Show active bonus type (read-only for now; Phase 6 adds pick interaction)
- New member page: `/bonuses` — bonus info and history for members

</code_context>

<specifics>
## Specific Ideas

- The full bonus rotation was provided from competition rules — 14 named bonus types (Brace Yourself, Fergie Time, Golden Glory, London Derby, Jose Park The Bus, Shane Long, Pop Up Trent, Pay The Penalty, Captain Fantastic, Alan Shearer, Super Sub, Pep Talk, Klopp Trumps, Roy Keane) plus Double Bubble, each with specific GW assignments repeating in cycles of ~15
- All 13 additional prizes have specific names, emoji, trigger conditions, and cash values (£10-£20) — these should be seeded as data
- Mid-season start: don't backfill historical gameweeks — the system picks up from current standings (Phase 7 handles the import)
- George's weekly workflow should feel like a to-do list: confirm bonus → wait for results → confirm bonus awards → review prizes → close gameweek → prep next week
- Manual fixture creation already exists (Phase 2, FIX-05) — no new work needed for that

</specifics>

<deferred>
## Deferred Ideas

- Bonus point calculation engine and member bonus pick submission — Phase 6 (Bonus System)
- H2H Steal detection and resolution — Phase 8
- Last One Standing tracking — Phase 8
- Pre-season predictions — Phase 9
- Weekly PDF/XLSX reports and email distribution — Phase 10
- Historical backfill of past gameweeks — not planned (mid-season start)

</deferred>

---

*Phase: 05-admin-panel*
*Context gathered: 2026-04-12*
