# Phase 7: Mid-Season Import - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

George can load all existing member standings and pre-season picks for the current season so real members can register and continue without starting from zero. This is a launch blocker — must complete before real members register. The import creates member records (with display_name and starting_points) that the existing signup dropdown (Phase 1) references, so members can link to their imported data when they register. Also includes "Bucks" (Dave) as a member with joint-top points for QA purposes.

</domain>

<decisions>
## Implementation Decisions

### Import Data Format
- Claude's discretion on the import mechanism — George needs to provide ~48 member names with current point totals
- George's source data is likely a spreadsheet or WhatsApp message — support paste (CSV/tab-separated) as the simplest zero-friction option
- Pre-season picks import: George has historical records of top 4, 10th place, relegation, promoted sides predictions per member — these should be importable alongside standings
- The import should be a one-time admin operation accessible from the admin panel (not a recurring feature)

### Member Record Creation
- Import creates member rows in the database with `display_name` and `starting_points` — these are the "imported names" that appear in the Phase 1 signup dropdown
- Members are created with `approval_status = 'pending'` and NO auth user — they're placeholders until the real person registers and claims their name
- When a member registers and picks their name from the dropdown, their auth user gets linked to the existing member row (inheriting their starting_points)
- "Bucks" (Dave — the builder/backup admin) must be included with points matching the current league leader for QA testing

### Late Joiner Support (DATA-05)
- Already built in Phase 1: George can add members manually via admin panel with custom starting_points
- Phase 7 may just need to verify this works correctly with the import flow — no new feature needed unless the import reveals gaps

### Pre-Season Picks (ADMIN-08)
- Pre-season predictions (top 4, 10th, relegation, promoted + playoff winner) need storage
- These are evaluated at season end (Phase 9) — Phase 7 just stores them
- Claude's discretion on storage schema and import UX

### Import Validation
- Claude's discretion on validation — at minimum: no duplicate names, point totals are non-negative integers, all required fields present
- George should see a preview of what will be imported before confirming
- Import should be reversible (George can clear and re-import if he made a mistake)

### Claude's Discretion
- Import page layout and UX (paste box, file upload, or manual entry table)
- Pre-season picks storage schema
- Import preview and confirmation flow
- Error handling for malformed data
- Whether to support XLSX upload (xlsx library already pinned to v0.18.x per STATE.md decisions) or just plain text paste
- How "Bucks" is seeded (part of the import or separate admin action)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `members` table: Already has `display_name`, `starting_points`, `approval_status` columns — import writes directly here
- `addMember` action in `src/actions/admin/members.ts`: Creates auth user + member row with starting_points — may be reusable for individual imports
- Admin members page (`/admin/members`): Member management UI already built — import could live here or as a new admin page
- `src/lib/validators/admin.ts`: Validation patterns — extend for import validation
- xlsx v0.18.x pinned in STATE.md decisions — available for XLSX parsing if needed

### Established Patterns
- Server actions for admin mutations with `requireAdmin()` guard
- `createAdminClient()` for bypassing RLS
- Admin notification system for important events
- Confirmation dialogs before impactful actions (result override pattern)

### Integration Points
- Admin sidebar: Add "Import" link or integrate into existing Members/Settings page
- Members table: Bulk insert of member placeholder rows
- Signup dropdown: Phase 1's dropdown reads from `members` table — imported names automatically appear
- Pre-season predictions: New table needed (or extend existing schema)

</code_context>

<specifics>
## Specific Ideas

- This is a launch blocker (noted in STATE.md blockers) — must complete before real members register
- George's existing data has ~48 members with WhatsApp display names like "Big Steve", "Dan The Man"
- "Bucks" (Dave) to be added with joint-top points — noted in STATE.md pending todos
- The import replaces George's manual process of entering members one-by-one through the admin panel
- Import preview with confirmation follows the same pattern as the result override impact preview (Phase 4)
- STATE.md blocker: "Confirm George's existing spreadsheet format before building Phase 7 import UI" — the import should be flexible enough to handle whatever format George provides

</specifics>

<deferred>
## Deferred Ideas

- Pre-season prediction evaluation and scoring — Phase 9
- Historical cross-season analytics — v2
- Season archive and historical records — Phase 11

</deferred>

---

*Phase: 07-mid-season-import*
*Context gathered: 2026-04-12*
