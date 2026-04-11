# Phase 3: Predictions - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Members can submit and edit home/away score predictions for open fixtures in a gameweek. Predictions are hidden from other members until the fixture kicks off (at which point they're locked and visible to all). George can view all predictions at any time from a dedicated admin view. George submits his own predictions from the member gameweek page (not the admin panel). No scoring, no bonuses, no results — those are Phases 4-6.

</domain>

<decisions>
## Implementation Decisions

### Prediction Entry UX
- Inline score inputs directly on each fixture card — two small number fields (home/away) appear in the existing `prediction-area` placeholder below the teams
- Mobile input: +/− stepper buttons with tap-to-type fallback (tapping the number opens phone keypad for direct entry)
- No modal, no separate form — members see fixtures and enter scores in one view

### Submission Flow
- All-at-once submission — member fills in scores across all fixtures, then hits one "Submit Predictions" button at the bottom of the gameweek page
- Partial submission allowed — only filled-in fixtures are saved; unfilled ones are skipped without error
- After initial submission, the button changes to "Update Predictions" — member edits scores and re-submits with the same button
- No auto-save — explicit submit/update action required

### Visibility & Reveal
- **OVERRIDES PRED-03**: Predictions become visible to ALL members at kick-off, not after gameweek completion
- Rule: kick-off = locked + visible. Once a fixture's kick-off time passes, everyone can see everyone's predictions for that match
- Before kick-off: member sees only their own predictions; other members' predictions are hidden
- Gameweek-level submission counter shown: "34 of 48 members have submitted" — no per-fixture counts
- No special export for WhatsApp — the page itself is the transparency tool; George shares the link in the group
- George can view all members' predictions at any time (before and after kick-off) from the admin panel

### George's Prediction Experience
- George submits his own predictions from the regular member gameweek page — same form as everyone else
- George does NOT use the admin "My Predictions" tab to submit — that tab repurposed (Claude's discretion)
- Admin panel has a dedicated "All Predictions" view: table showing all members' predictions per gameweek (members as rows, fixtures as columns) — used by George to check who's submitted and what they picked

### Claude's Discretion
- Saved prediction display on fixture cards (filled inputs vs read-only with edit vs colour-coded)
- Visual distinction between submitted and un-submitted fixtures
- Confirmation feedback after submit (banner vs dialog vs inline)
- On-page deadline urgency (sticky banner vs relying on existing amber/countdown UX + email reminders)
- Prediction reveal layout (per-fixture expandable vs separate view)
- Admin "My Predictions" tab content (redirect to member page, read-only summary, or remove)
- Empty state design (no predictions yet, no fixtures loaded)
- Late submission messaging (how to inform members that some fixtures are already locked)
- Overall gameweek submission counter placement and design

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `fixture-card.tsx`: Has `prediction-area` placeholder div — Phase 3 populates this with score inputs
- `lockout.ts` → `canSubmitPrediction()`: Server-side lockout check fully built, ready for prediction server actions
- `gameweek-view.tsx`: Renders fixture cards per gameweek — prediction form wraps this
- `gameweek-nav.tsx`: GW navigation with prev/next and dropdown — no changes needed
- `team-badge.tsx`: Team badge component — reuse in prediction displays
- Admin predictions page at `/admin/predictions`: Placeholder shell ready to be populated
- `src/lib/email.ts`: Email utility — reuse for deadline reminder emails (decided in Phase 1)
- `src/lib/validators/admin.ts`: Validation patterns — extend for prediction operations

### Established Patterns
- Server actions for mutations (`src/actions/admin/fixtures.ts`) — follow same pattern for prediction submit/update
- Route groups: `(admin)`, `(member)`, `(public)` — prediction pages fit into member and admin groups
- `force-dynamic` on data pages — apply to gameweek prediction pages
- Supabase RLS for access control — prediction visibility enforced at DB level
- Notification system (`admin_notifications` table) — extend for prediction-related admin alerts

### Integration Points
- `fixture-card.tsx` prediction-area div: inject score inputs here
- Member gameweek page (`/gameweeks/[gwNumber]`): wrap with prediction form
- Admin predictions page (`/admin/predictions`): replace placeholder with all-members table
- RLS policy SQL pre-written as comments in `002_fixture_layer.sql`: apply in Phase 3 migration (adjusted for kick-off visibility rule instead of gameweek-complete)
- Member dashboard (`dashboard-overview.tsx`): could show prediction status/deadlines

</code_context>

<specifics>
## Specific Ideas

- Visibility at kick-off is driven by transparency — George currently posts predictions in WhatsApp after kick-off so everyone can see. The site replaces that manual step.
- The +/− stepper on mobile is important because members are casual and non-technical — typing scores via keypad should be a fallback, not the primary input
- Submission counter ("34 of 48 submitted") creates social pressure to submit — mirrors the WhatsApp group dynamic where George chases stragglers
- George uses the member page to predict because he's also a player — keeping it the same as everyone else avoids confusion and means he sees exactly what members see

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-predictions*
*Context gathered: 2026-04-11*
