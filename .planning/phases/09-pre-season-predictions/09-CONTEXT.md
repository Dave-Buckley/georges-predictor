# Phase 9: Pre-Season Predictions - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Members submit pre-season predictions (top 4, 10th place, 3 relegated, 3 promoted, playoff winner) before GW1 of the next season. Predictions lock automatically when GW1 begins. At season end, the system calculates 30pts per correct team, flags all-correct scenarios to George, and George confirms the final point awards which then count toward season totals. The feature must also surface already-imported current-season picks (read-only) and let George add picks for late joiners.

</domain>

<decisions>
## Implementation Decisions

### Scoring
- 30 pts per correct team pick (flat — top 4, 10th, relegated, promoted, playoff winner all score the same)
- No fixed "all correct" bonus formula
- System **detects and flags** to George (via existing admin notification pattern) when a member gets all picks correct in any category (top 4, relegated, promoted) OR all 12 picks overall
- George decides manually what reward (if any) to give — zero-config for the bonus layer, full control for George
- Per-category flags: `all_top4_correct`, `all_relegated_correct`, `all_promoted_correct`, `all_correct_overall`
- Flags shown on the admin confirmation page and emitted as `admin_notifications` entries at season-end calc time

### Late joiners
- Members who register AFTER pre-season lockout can still have picks, entered by George via the admin panel
- Reuses the admin-can-override-lockout pattern
- No self-submission grace window — keeps the pattern consistent with mid-season import and member-addition flows from Phase 7

### Current season (picks already imported)
- Members see a read-only view of their own pre-season picks (imported via Phase 7 importPreSeasonPicks)
- Route: `/pre-season` for members — shows own picks with category sections, team crests/names, lock status banner ("Locked since GW1")
- No editing, no button to submit — form only exists for future seasons before GW1

### Championship team list
- Hardcoded seasonal constant in code (e.g., `CHAMPIONSHIP_TEAMS_2025_26`) — 24 teams
- One file update per season, no admin UI, no schema overhead
- Constant lives alongside existing team data (e.g., `src/lib/teams/championship-2025-26.ts`)
- Next season's constant added by the developer before the new pre-season submission window opens

### Pick validation scope
- "Top 4" and "10th place" picks: must be from the 20 PL teams (teams table)
- "Relegated" picks: must be from the 20 PL teams (teams table)
- "Promoted" picks and "playoff winner": must be from the hardcoded Championship list
- Enforced server-side in the submission action (reject any pick outside its allowed list)
- Enforced client-side in the picker UI (filter dropdowns to valid sources)

### Lockout
- Server-side rejection where `current_season.gw1_kickoff < now()` — same pattern as fixture lockout (Phase 2)
- `seasons` table or env config holds the GW1 kickoff timestamp per season
- Admin override flag allows George to enter picks after lock for late joiners
- UI shows a "Locked" banner when submission window has closed

### Submission form UX
- Single page, all 5 categories on one screen (not a wizard)
- Category sections with counters ("Top 4: 0/4 selected")
- Radix Select or searchable dropdown per slot for team picking
- Submit button disabled until all 12 picks are filled
- Mobile-first layout (most members on phone per UI-02)
- Form shows only before lockout for future seasons

### Admin monitoring
- Dashboard action card: "Pre-season submissions — N/M submitted" with link (appears only when pre-season window is open)
- Full page `/admin/pre-season` shows: every member's picks in a table, "not submitted" list, submission timestamps
- Submission status visible to George at all times (even after lock) for record-keeping

### End-of-season confirmation
- George's flow mirrors Phase 6 bonus confirmation pattern (per-member review, adjustable amounts, apply)
- Admin page lists every member with: their picks, which were correct (highlighted), calculated 30pts/correct subtotal, any all-correct flags, an editable "final award" field pre-filled with the system calculation, a one-click "Apply all" button plus per-member apply
- Applied awards written to a `pre_season_awards` table (or equivalent) with `confirmed_by`, `confirmed_at`
- Awards added to season totals only after confirmation (never auto-applied)

### Export
- Pre-season picks and awards included in the data export (Phase 10 / RPT-03 / RPT-07 / DATA-04 / PRE-05)
- Format: one row per member per season with all 12 picks + total pre-season points awarded

### Claude's Discretion
- Exact form layout (card vs list style for categories)
- Whether to show an "N of 12 picks complete" progress bar
- Whether correct picks in the admin end-of-season view show crests or just team names
- Copy/microcopy for lock banners, empty states, submission success
- Whether the admin page has a filter for "not submitted" / "all-correct flagged" / "submitted"
- Whether to batch-email members at end-of-season with their pre-season result (coordinate with Phase 10 reports)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `pre_season_picks` table (migration 007): already has `member_id`, `season`, `top4: text[]`, `tenth_place: text`, `relegated: text[]`, `promoted: text[]`, `promoted_playoff_winner: text`, RLS policies — schema is done
- `importPreSeasonPicksRowSchema` (Zod): same field shape can be reused/extended for the member submission schema
- `handle_new_user` trigger (migration 007): links placeholder rows on registration — already supports late-registering members seeing their imported picks
- `teams` table: source of truth for top 4 / 10th / relegated pick validation
- `team-badge.tsx`: reuse in both submission form and display views
- Admin bonus confirmation pattern (Phase 6): per-member review, George confirms, two-phase apply — direct model for the end-of-season confirmation flow
- Admin notifications table + patterns (Phase 5): `all-correct` flag notifications slot in as new notification types
- Admin sidebar + dashboard action cards: add "Pre-Season" sections
- Member nav pattern from Phase 8 (`/los` link): add `/pre-season` alongside

### Established Patterns
- Two-phase confirmation (member → George) — same as bonuses, LOS awards, prizes
- Server-side lockout based on a timestamp in the DB — same as fixture/prediction lockout
- Admin-override-lockout flag — same as editFixture admin_override
- Pure calculation function pattern (`calculatePoints`, `calculateBonusPoints`) — pre-season scoring is a natural next pure lib: `calculatePreSeasonPoints(picks, actuals) -> { correctByCategory, allCorrectFlags, totalPoints }`
- Case-insensitive name matching with `lower(trim())` — reuse for team name comparisons when evaluating correctness against final standings
- `admin_notifications` CHECK constraint extended per phase — add new notification types in migration 009
- `requireAdmin()` server action guard — applies to all admin pre-season actions
- Vitest + TDD for pure functions, integration for actions — same test layout

### Integration Points
- New migration `009_pre_season.sql` — adds seasons table (or GW1 kickoff config), pre_season_awards table, new admin_notifications types, any columns needed on pre_season_picks for admin-entered rows
- New server actions: `submitPreSeasonPicks` (member), `getPreSeasonContext`, `setPreSeasonPicksForMember` (admin), `confirmPreSeasonAwards` (admin)
- New pure lib: `src/lib/pre-season/calculate.ts` + tests
- Championship team constant: `src/lib/teams/championship-2025-26.ts`
- Member page: `src/app/(member)/pre-season/page.tsx`
- Admin page: `src/app/(admin)/admin/pre-season/page.tsx`
- Admin sidebar update: new "Pre-Season" link
- Member layout: add "/pre-season" to nav
- Admin dashboard: conditional pre-season action card
- Season-end trigger: either an admin "Calculate pre-season" button or a cron tied to a season-closed flag — Claude's discretion during planning

</code_context>

<specifics>
## Specific Ideas

- The "bonuses for all correct" requirement is deliberately implemented as a FLAG system not a points formula — George sees who nailed every top 4, every relegated team, every promoted team, or the full 12, and decides rewards manually
- For the current (mid-season) reality, the submission form is never shown — members only see their imported picks read-only; the full submission flow fires for NEXT season's pre-season window
- Late joiner admin flow reuses `setPreSeasonPicksForMember` and mirrors George's existing "George can add new members manually" pattern (AUTH-05)
- Championship list stored as a constant file, not a table, because it changes once per year and we want zero admin overhead (aligns with the zero-cost / idiot-proof principles)
- Picker validation must filter by source (PL teams vs Championship) to avoid nonsense picks like "Burnley in the top 4 AND relegated AND promoted"

</specifics>

<deferred>
## Deferred Ideas

- Self-submission grace window for late joiners (admin-enters-picks is enough for v1)
- Historical pre-season data across multiple seasons (data layer exists via `season` column, but UI for browsing past seasons = DATA-02 / DATA-03, not this phase)
- Member-facing "how did I do" page at season end with animations/celebrations — Phase 10 report or v2 social feature
- Batch email of pre-season results — coordinate with Phase 10 reports

</deferred>

---

*Phase: 09-pre-season-predictions*
*Context gathered: 2026-04-12*
