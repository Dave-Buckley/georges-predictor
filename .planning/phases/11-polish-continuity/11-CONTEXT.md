# Phase 11: Polish & Continuity - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

The final build phase before launch. Three concerns: (1) visual polish — the app feels like a Premier League product, not a generic web form, with PL-inspired branding, team kit accents, hero imagery on public surfaces, and consistent mobile-safe layouts throughout; (2) member profile pages — every member has a public-ish (logged-in-users-only) profile with cross-season stats, achievements, and a weekly-points trajectory chart, reachable by clicking any username anywhere in the app; (3) season archival + continuity — George can cleanly archive the current season and launch the next via a guided wizard, with all historical data preserved via season-column versioning, and a public "How It Works" explainer page that works for new signups and casual curious visitors.

</domain>

<decisions>
## Implementation Decisions

### Visual branding
- **Rich PL feel** — push beyond polished chrome: team kit colour accents on prediction cards, hero imagery on `/standings` and landing, team crests everywhere they fit
- Use free / already-in-use assets ONLY — Wikipedia SVG team crests (already shipped in Phase 2), no official Premier League logos or licensed marks
- Colour palette: PL-inspired
  - Primary: purple `#37003c` (Premier League signature)
  - Accent: green `#00ff85` (Premier League accent)
  - Backgrounds: neutral slate/white for cards, purple reserved for headers/CTAs
  - Dark mode: auto from system preference (Tailwind `dark:` prefix pattern)
- Typography: keep system font stack — zero network cost, instant render
- No logo licensing — app name stays "George's Predictor" with a simple wordmark

### Team kit colour accents
- Each team in the `teams` table gets a `primary_color` + `secondary_color` TEXT column (hex)
- Seed via migration with published team kit colours (same sources as crests — Wikipedia team infoboxes)
- Usage: prediction cards show a subtle left-border in the home team's primary colour, fixture headers use two colours diagonally, league table name rows carry a thin coloured left accent matching the user's "favourite team" if set (new optional member field — Claude's discretion)

### Hero imagery
- Public `/standings` and `/` get a hero banner: simple stadium-silhouette SVG or geometric PL-purple panel with "George's Predictor" wordmark + tagline
- Generate in-code (CSS gradients + SVG) rather than loading images — keeps bundle size tiny, no asset hosting

### Mobile polish
- Audit all existing routes against real iPhone 13 / Pixel 5 viewports
- Fix any horizontal-scroll bugs, tap-target issues, fixed-footer stacking
- Ensure prediction form + LOS picker + pre-season form are effortless on a phone (these are the highest-stakes mobile surfaces)

### Member profile depth
- **Full stats + history** — per CONTEXT.md for DATA-02 + DATA-03
- **Current season:** total points, rank, prediction accuracy % (correct results / total predictions), correct-result count, correct-score count, bonus confirmation rate, LOS status + teams used + LOS wins count
- **Previous seasons:** list of seasons played with rank + total points + any trophies (LOS winner, H2H survivor, weekly winner counts)
- **Achievements:** GW winner badges (weekly top scorer), all-correct bonus flags from pre-season, LOS winner, H2H steal survivor
- **Chart:** simple weekly-points line chart with running-total overlay — SVG-only, no charting library (kept lightweight)

### Profile visibility
- **Logged-in members can view any other member's profile** (open-book principle)
- George sees every member's profile + additional admin-only fields (email, registration date, approval history)
- **NOT public** — requires login; unauth users hit redirect to `/signin`
- Matches feature idea from memory: "Clickable usernames → player profile" — every rendered member name becomes a link to `/members/{display_name_slug}` across the app

### Clickable usernames
- Replace all `<span>{displayName}</span>` usages with `<Link href={`/members/${slug}`}>{displayName}</Link>`
- Surfaces: league table, gameweek results, admin panel, H2H banner, LOS standings, bonus confirmation, report emails (deep links into the app)
- Slug derivation: `lower(trim(replace(displayName, ' ', '-')))` with uniqueness suffix if needed; stored as a computed column or helper

### How It Works page
- Route: `/how-it-works` (public, no auth) — also linked from footer + signup page
- **Single long-scroll page** with anchor jump-links at top
- Sections: Welcome → How to play → Scoring (results + exact score) → Bonuses (types + Double Bubble + Golden Glory) → Last One Standing → H2H Steals → Pre-Season Predictions → Prizes → FAQ
- **Friendly explainer tone** — conversational, worked examples like "Say you predict Arsenal 2-1 Chelsea and the result is Arsenal 3-2 Chelsea — you got the result right, that's 10 points. If you'd predicted 3-2 exactly you'd have scored 30."
- Include dev-env **screenshots** of: prediction form, gameweek results, admin bonus panel, LOS picker, pre-season form
- Screenshots stored in `/public/how-it-works/*.png`, retaken whenever UI changes materially (documented in a short runbook)
- FAQ covers: "What happens if a fixture is postponed?", "What if there's a tie at the top?", "Can I change my prediction after kickoff?", "How do I see my past seasons?"

### Season archive shape
- **Versioned with `season` INT column** — extend every relevant table to include `season` (most already do via `gameweeks.season` join)
- Archive operation = metadata update on the `seasons` table (set `ended_at`, mark inactive); NO physical data movement
- Cross-season queries use `WHERE season = X` filters everywhere; member profile history aggregates across seasons
- Zero data loss risk — every row stays in place
- Follows Phase 9's `seasons` + `pre_season_picks.season` precedent already set

### Tables needing `season` column (verified at planning time)
- `gameweeks` (likely already has it via FK to seasons, or via `gw1_kickoff`)
- `prediction_scores` (inherits season from gameweek FK)
- `predictions` (inherits)
- `los_competitions` (each belongs to a season)
- `bonus_awards`, `prize_awards` (inherit via gameweek)
- `pre_season_picks`, `pre_season_awards` (already has `season`)
- `members` — points stored as current-season AGGREGATE; historical per-season totals derived at query time from `prediction_scores` + `bonus_awards` filtered by season

### New season wizard
- Admin route: `/admin/season-rollover` (or modal on admin dashboard)
- **Guided multi-step checklist:**
  1. Confirm current season is fully closed (all GWs closed, pre-season awards confirmed, LOS competition resolved)
  2. Click "Archive {YYYY-YY} season" — sets `ended_at`, shows summary of final standings
  3. Define new season: entry for `YYYY-YY`, set GW1 kickoff timestamp
  4. Fixture sync: one-click pull from football-data.org for the new season's fixtures
  5. Championship list: carry forward existing OR swap via the end-of-season rollover (from Phase 9)
  6. Members: carry forward with points reset to 0 for the new season; display_name + user_id preserved
  7. Pre-season window opens — system unlocks `submitPreSeasonPicks` for the new season
  8. Final confirmation → launches new season live
- Each step requires explicit "Next" click; back button works
- Cancel at any step with zero side effects until step 8

### Off-season member experience
- Between archive + new-season-launch, members see:
  - End-of-season summary page at `/` — final league table, champion spotlight (top 3 with photos/crests), LOS winners list, prize awards summary, total pre-season awards
  - Banner: "Next season kicks off on {date}" — countdown + reminder about pre-season picks
  - Profile pages still work (showing just-archived season + prior seasons)
  - Prediction form locked with "Season over" message
- After new season launches but before GW1: pre-season picks form unlocks for new season, everything else remains frozen

### League table prominence
- Already the landing page at `/` via Phase 10 re-export of `/standings`
- Phase 11: add a small league-table widget to the logged-in member home that shows their rank + surrounding 5 players (rank-2 to rank+2 relative to the viewer)
- Keeps engagement high — members immediately see where they stand without navigating

### UI polish checklist (locked items for planner to mechanize)
- Team crest rendering: consistent sizing, `loading="lazy"`, object-contain
- Button styling: primary = purple, accent = green, destructive = red, secondary = slate outline
- Empty states with friendly copy + single CTA button
- Loading states: skeleton placeholders matching expected shape (not spinners)
- Error states: actionable text + retry button
- Dark mode: auto from system preference; tested on both
- Print styles for admin pages (so George can print league tables if site dies)

### Claude's Discretion
- Exact hero SVG composition
- Card corner radius, shadow depth, spacing unit (keep consistent, pick sensible defaults)
- Chart visual style (line thickness, colour, axis labels)
- Mobile nav pattern (existing drawer vs new bottom-nav) — optimise for tap targets
- Whether to add a "favourite team" picker to member profile (feels natural but not required)
- Achievement badge icons (use existing lucide icons)
- How It Works page illustration style (screenshots vs illustrated diagrams — screenshots preferred)
- Whether to add a "Share my profile" button (nice-to-have, Claude decides)

</decisions>

<specifics>
## Specific Ideas

- The PL purple + green palette feels authentically football without requiring any licensed assets — the colours are not trademarked when used outside official PL contexts
- Clickable usernames is the glue that makes the rest of the phase cohere — once every name is a link, the profile page becomes the centre of social engagement
- The end-of-season summary is the emotional close of the competition; worth a bit of polish (champion crest, trophy icon) to make members feel like they played something real
- Guided wizard for new season matches George's pattern: every admin-facing flow is multi-step with explicit confirmations (bonus confirmation, award calculation, etc.)
- Season archive via column versioning is the same pattern Phase 9 already established — nothing to invent
- Screenshots in How It Works are free to produce from the dev environment; the cost is a one-page runbook so George can retake them if the UI changes

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `team-badge.tsx` — crest rendering, used everywhere fixtures appear
- `/standings` public page (Phase 10) — target for hero polish
- `/profile` member page (Phase 10) — extend with stats + history (currently just email opt-out)
- React Email layout (Phase 10) — already uses a consistent design; extend with PL accents
- Tailwind CSS — config already in place, just extend theme with purple + green
- lucide icons — already used, pick more for achievements
- Pure calc libs (scoring, bonus, LOS, H2H, pre-season) — all season-aware inputs; feed profile stats
- `seasons` table (Phase 9) — basis for archive state
- `/admin` dashboard — place for season-rollover card
- Admin sidebar (Phase 8) — add "Season rollover" link

### Established Patterns
- Server actions with `requireAdmin()` for archive + new season
- Idempotent admin operations (bonus confirmation, award calculation, season archive)
- Pure calc + render separation from Phase 4/6/8/9/10
- Mobile-first Radix components (Select, Dialog, Toggle)
- TDD for new calculation helpers (profile stat aggregations)
- Column versioning via `season` — continue this pattern throughout

### Integration Points
- Extend Tailwind `tailwind.config.ts` theme: PL purple, PL green, semantic tokens
- New migration 012: `members.favourite_team_id` (nullable FK to teams), `teams.primary_color` + `secondary_color`, any missing `season` columns, slug index for `members.display_name`
- New pure lib: `src/lib/profile/stats.ts` — aggregates per-season stats from existing tables
- New routes: `/members/[slug]`, `/how-it-works`, `/admin/season-rollover`
- Replace member-name rendering site-wide: helper `<MemberLink displayName={name} />`
- Weekly-points chart: `src/components/charts/weekly-points-chart.tsx` (pure SVG, no library)
- End-of-season summary: `/app/(public)/end-of-season/page.tsx` (auto-shown at `/` when active season is archived)
- Home widget for logged-in members: "your rank + neighbours" strip on member dashboard
- Admin archive action: extend existing `/admin/gameweeks` flow with a season-level archive button
- Email templates updated with new brand colours (group PDF, personal PDF, admin XLSX headers, kickoff backup)

</code_context>

<deferred>
## Deferred Ideas

- Favourite team picker on profile (Claude's discretion — might ship, might not; cheap to defer)
- Animated celebration on league table rank change — v2 social feature
- Analytics dashboard (prediction trends, best/worst fixtures) — ANLYT-* v2
- Member vs member comparison tool — ANLYT-02 v2
- Weekly "awards" automation (best predictor, worst week, most improved) — SOC-02 v2
- PL Premier Sans typography — skip, licensing cost
- Official PL logo usage — skip, legally risky for a friend group
- Multi-language support — out of scope
- Dark-mode manual toggle — `prefers-color-scheme` auto-detect is enough
- "Share my profile" social share button — Claude's discretion; might ship if trivial

</deferred>

---

*Phase: 11-polish-continuity*
*Context gathered: 2026-04-12*
