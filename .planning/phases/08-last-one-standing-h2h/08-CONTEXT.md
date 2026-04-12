# Phase 8: Last One Standing & H2H - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

The Last One Standing (LOS) sub-competition runs automatically alongside weekly predictions, and H2H steal situations are detected and flagged without manual work from George. LOS: members pick one team to win each week, eliminated on loss/draw/miss, can't reuse teams until all 20 used, competition resets when a winner is found. H2H: tied weekly points leaders are auto-detected and flagged as a steal for the following week. No reports (Phase 10) — just the tracking, detection, and display infrastructure.

</domain>

<decisions>
## Implementation Decisions

### LOS Team Pick
- LOS pick is part of the weekly prediction submission flow — member selects a team alongside their score predictions and bonus pick (extends Phase 3/6 pattern)
- Member picks from a dropdown/list of the 20 PL teams, filtered to only show teams they haven't used yet in the current cycle
- Pick is mandatory when an LOS competition is active and the member is still in — submission blocked without it (same pattern as bonus pick)
- If a member is eliminated, LOS pick section is hidden/disabled with a message ("You've been eliminated — next competition starts when a winner is found")
- Pick is editable until the first fixture of the gameweek kicks off (consistent with prediction lockout rules)

### LOS Elimination Logic
- Win = progress (team won their match)
- Draw or Loss = eliminated
- Miss a round without submitting = eliminated (no exceptions, per competition rules)
- Elimination checked automatically when match results come in (extends scoring/sync pipeline)
- If a member's chosen team hasn't played yet (fixture postponed), they remain "pending" until the fixture is resolved

### LOS Team Usage Tracking
- Each member's team usage tracked per competition cycle
- Once a team is picked, it's unavailable until ALL 20 PL teams have been used (then full reset within the same competition)
- The 20-team cycle resets independently of competition resets — competition reset (winner found) makes all teams available again regardless of usage

### LOS Competition Lifecycle
- Multiple LOS competitions per season (~4-7 expected with ~50 members)
- When only one member remains = winner (£50 prize)
- Competition auto-resets: all teams available, all members back in, new competition starts
- George gets a notification when a winner is found
- George can view and manage LOS status for all members (LOS-07)
- Claude's discretion on whether George manually triggers the reset or it's automatic

### LOS Admin View
- Claude's discretion on layout — George needs to see: who's still in, who's eliminated, each member's current pick, full team usage history
- Should be accessible from the admin sidebar (new "LOS" link or under existing section)
- George can manually eliminate or reinstate a member if needed (override capability)

### LOS Member View
- Claude's discretion on where members see LOS status — either on the gameweek prediction page or a dedicated LOS page
- Members should see: their status (in/eliminated), current pick, teams used, teams remaining, who's still in the competition
- Competition standings: list of members still in, ordered by... Claude's discretion (alphabetical, or by number of teams remaining)

### H2H Steal Detection
- System automatically detects when two or more members tie for highest weekly points
- Tied members are flagged as "H2H Steal" for the FOLLOWING gameweek
- The steal is resolved in the following gameweek: highest scorer between the tied members wins the jackpot
- If still tied after the steal gameweek, jackpot is split equally
- H2H steal status is tracked and visible to George in the admin panel
- Members should see H2H steal status on the gameweek page (who's in a steal, what's at stake)

### H2H Steal Resolution
- Claude's discretion on how the steal is resolved — detect automatically from following week's scores, flag for George to confirm
- The weekly jackpot (£30 1st, £10 2nd) applies to the steal resolution
- If the runner-up (£10) position also has a tie, the same H2H steal logic applies

### Claude's Discretion
- LOS pick UI (dropdown, card grid, or list — most user-friendly for mobile)
- LOS status page layout for members
- LOS admin page layout
- H2H steal visual treatment (how ties and steals are shown to members)
- Whether LOS competition reset is automatic or George-triggered
- How postponed fixtures affect LOS (pending status handling)
- H2H steal resolution flow (auto-detect + George confirm, or fully manual)
- Whether LOS and H2H get their own sidebar links or are grouped

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `teams` table: All 20 PL teams with names, codes, badge URLs — ready for LOS team selection
- `team-badge.tsx`: Team badge component — reuse in LOS pick and status displays
- Prediction submission flow (`prediction-form.tsx`, `submitPredictions` action): Extend with LOS pick (same pattern as bonus pick extension in Phase 6)
- `gameweeks` table with `closed_at` status: Use for determining LOS round boundaries
- Bonus pick star pattern on fixture cards (Phase 6): Similar UX pattern for LOS team selection
- Admin sidebar: Add LOS/H2H links
- Admin notification system: Extend for LOS winner, H2H steal detection
- `prediction_scores` table: Source for weekly totals used in H2H tie detection
- Scoring sync pipeline (`recalculate.ts`, `sync.ts`): Extend to trigger LOS elimination checks

### Established Patterns
- Server actions with `requireAdmin()` / session client for member ops
- TDD with Vitest
- Pure calculation functions (calculatePoints, calculateBonusPoints) — model for LOS elimination logic
- RLS for member data visibility
- Migration pattern for new tables

### Integration Points
- Prediction form: Add LOS team picker
- submitPredictions action: Accept LOS team pick
- Scoring pipeline: Trigger LOS elimination check when results come in
- Admin dashboard: Add LOS/H2H action cards
- Admin sidebar: New navigation items
- Member gameweek page: Show H2H steal status
- New tables needed: `los_competitions`, `los_picks`, `los_team_usage`, `h2h_steals`

</code_context>

<specifics>
## Specific Ideas

- LOS competitions are expected to run 4-7 times per season with ~50 members — they can last several weeks before a winner emerges
- "If you're still in the competition but fail to submit your selection on time before the round starts, you can only choose between the remaining fixtures" — late LOS picks should only allow teams from un-kicked-off fixtures
- "If you miss a round completely without sending in you're out, no exceptions" — strict elimination on missed rounds
- "Once we have our first winner, the process repeats, and you have all of your teams available to pick" — competition reset is clean
- "I will update each week who is still in the competition and if you cannot select a particular team" — George currently does this manually in WhatsApp, the system replaces this
- H2H steals are resolved the following week — "the highest point scorer between them wins" — if members tie on weekly points, next week determines the winner between them
- Runner-up (£10) position also gets H2H steal treatment if tied

</specifics>

<deferred>
## Deferred Ideas

- LOS jackpot payment tracking — George handles fees outside the tool
- Pre-season predictions evaluation — Phase 9
- Weekly reports including LOS status and H2H steals — Phase 10

</deferred>

---

*Phase: 08-last-one-standing-h2h*
*Context gathered: 2026-04-12*
