# Phase 6: Bonus System - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

The weekly bonus system is fully operational — members pick which fixture their bonus applies to during prediction submission, bonus points are calculated automatically (standard 20pts / Golden Glory 20/60), Double Bubble doubles all points for designated gameweeks, and nothing hits totals until George confirms. Phase 5 built all admin infrastructure (bonus types, schedule, confirmation flows, Double Bubble toggle). This phase adds: member-facing bonus pick, bonus point calculation engine, Double Bubble multiplication, and the before/after points display.

</domain>

<decisions>
## Implementation Decisions

### Bonus Pick UX
- Bonus pick is mandatory — submission blocked with clear error if no fixture selected ("Pick your bonus fixture before submitting")
- Bonus pick submitted together with predictions — one "Submit Predictions" button (extends Phase 3 pattern)
- Member can change their bonus pick after submitting, same rules as predictions — editable until the selected fixture kicks off
- Show the pre-populated bonus type even before George confirms it — members pick based on that. If George changes it, picks are cleared and members are notified (Phase 5 decision)
- Claude's discretion on the most user-friendly pick interaction (star icon, radio button, or highlight — optimise for casual non-technical members on mobile)

### Bonus Point Calculation
- Standard bonuses: 20pts if the chosen fixture meets the bonus condition (e.g., Brace Yourself = a player scores exactly 2 goals in the chosen game)
- Golden Glory: separate formula — 20pts for correct result, 60pts for correct exact score on the chosen fixture (NOT the standard 10/30 formula)
- Bonus points calculated automatically when fixture results come in (extends Phase 4 sync-trigger pattern)
- Bonus points stored in bonus_awards.points_awarded — NOT added to prediction_scores
- No bonus points appear in member's total until George explicitly confirms the award (BONUS-06)

### Double Bubble
- Double Bubble doubles ALL points for the gameweek — both base prediction points AND bonus points
- Applied at display/calculation time, not stored as doubled values (keeps the raw scores clean for audit)
- GW10, GW20, GW30 pre-set by default, George can toggle any GW (Phase 5 decision)

### Points Display with Bonus (BONUS-07)
- Claude's discretion on layout — members must see points BEFORE and AFTER bonus application
- Should be clear which points are base prediction points vs bonus points vs Double Bubble multiplied
- Fits into existing fixture card + sticky total pattern from Phase 4

### Golden Glory Experience
- Claude's discretion on visual treatment — Golden Glory should be visually distinct from standard bonuses (different colour, icon, or card treatment)
- The 20/60 formula should be explained inline so members understand it's not the standard scoring

### Double Bubble Visibility
- Claude's discretion on how members know it's a Double Bubble week — visual badge, banner, or colour treatment on the gameweek page
- Doubled totals should show the multiplication clearly (e.g., "60pts × 2 = 120pts")

### Claude's Discretion
- Bonus pick interaction pattern (star, radio, highlight — most user-friendly for mobile)
- Points before/after bonus layout
- Golden Glory visual distinction
- Double Bubble visual treatment
- Bonus condition evaluation logic per bonus type (some need external data like "player scored a brace" — research should determine what's feasible with football-data.org API vs manual confirmation by George)
- How to handle bonus picks on fixtures that get postponed/rescheduled
- Empty state when bonus type doesn't apply to a gameweek (if any)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `bonus_types` table: 14 types seeded with name + description (Phase 5)
- `bonus_schedule` table: Full 38-GW rotation pre-populated (Phase 5)
- `bonus_awards` table: Has `member_id`, `gameweek_id`, `bonus_type_id`, `fixture_id`, `status` (pending/confirmed/rejected), `points_awarded` — ready for member picks (Phase 5)
- `src/actions/admin/bonuses.ts`: 5 admin server actions (setBonusForGameweek, toggleDoubleBubble, confirmBonusAward, bulkConfirmBonusAwards, createBonusType) — admin side complete
- `src/lib/validators/bonuses.ts`: Zod schemas for all bonus admin operations — extend for member pick submission
- `src/app/(member)/bonuses/page.tsx`: Member bonus info page already built (Phase 5) — shows all bonus types, schedule, prizes
- `prediction-form.tsx`: Client wrapper managing prediction state — extend to include bonus pick
- `fixture-card.tsx`: Prediction display area — extend to show bonus pick indicator and bonus points
- `gameweek-view.tsx`: Renders fixture cards per gameweek — wrap bonus pick state
- `src/lib/scoring/recalculate.ts`: Scoring recalculation — extend or create parallel bonus calculation
- `src/lib/scoring/calculate-points.ts`: Pure function for base scoring (0/10/30) — model for bonus calculation purity
- Sticky footer total (Phase 4) — extend to show bonus + Double Bubble breakdown

### Established Patterns
- Server actions for mutations with Zod validation + requireAdmin/requireMember guards
- TDD with Vitest — tests alongside implementation
- `createAdminClient()` for admin ops, session client for member ops with RLS
- RLS on bonus_awards currently admin-only — Phase 6 adds member SELECT/INSERT policies
- Pure calculation functions with zero imports (Phase 4 pattern) — reuse for bonus calculation

### Integration Points
- Prediction submission flow (`src/actions/predictions.ts`): Extend to accept bonus fixture pick alongside scores
- Fixture sync trigger: Extend to trigger bonus calculation alongside base scoring when results arrive
- `bonus_awards` RLS: Add member policies — members can INSERT their own pick and SELECT their own awards
- Gameweek page: Bonus pick integrated into prediction form
- Sticky footer: Extended with bonus + Double Bubble breakdown
- `bonus_schedule` RLS: Add member SELECT for confirmed bonuses (so they can see the active bonus)

</code_context>

<specifics>
## Specific Ideas

- "YOU ARE NO LONGER ALLOWED TO SELECT 'NONE' AS A BONUS OPTION" — this is a rule change from previous seasons. The system must enforce mandatory bonus picks.
- Some bonus conditions (Brace Yourself, Fergie Time, Shane Long, Pop Up Trent, Captain Fantastic, etc.) require match event data that may not be available from football-data.org free tier — research should determine which bonuses can be auto-evaluated vs which need George to manually confirm
- Golden Glory is the most impactful bonus (60pts for correct score vs 30pts normally) — it deserves special visual treatment
- Double Bubble weeks are exciting events in the competition — the visual should reflect that energy
- Members are casual and non-technical — the bonus pick must be impossible to miss or misunderstand

</specifics>

<deferred>
## Deferred Ideas

- H2H Steal detection and resolution — Phase 8
- Last One Standing tracking — Phase 8
- Pre-season predictions — Phase 9
- Weekly PDF/XLSX reports with bonus breakdown — Phase 10

</deferred>

---

*Phase: 06-bonus-system*
*Context gathered: 2026-04-12*
