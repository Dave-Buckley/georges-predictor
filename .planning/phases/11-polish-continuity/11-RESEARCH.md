# Phase 11: Polish & Continuity - Research

**Researched:** 2026-04-12
**Domain:** UI polish + branding, cross-season stats & profile pages, season archival via column versioning, guided admin wizard
**Confidence:** HIGH (most findings verified against existing codebase; MEDIUM on brand colour accuracy, dev-env screenshots strategy)

## Summary

Phase 11 is an integration-and-polish phase, not a green-field build. Every concern has a precedent already shipped in the codebase: column-versioned `season` archival (Phase 9 `pre_season_picks`, Phase 8 `los_competitions`), idempotent admin multi-step flows (Phase 5 gameweek close, Phase 9 rollover), and component re-use patterns (`team-badge.tsx`, `EmailNotificationToggles`, `MemberRow`). The phase adds one new migration (012), one pure stats library (`src/lib/profile/stats.ts`), three new routes (`/members/[slug]`, `/how-it-works`, `/admin/season-rollover`), one shared `<MemberLink>` helper, one pure-SVG weekly-points chart, theme-extension changes, and site-wide link replacement wherever `display_name` currently renders as a plain `<span>`.

Key risks are **NOT** technical — they are scope: (1) clickable-usernames rewrite touches ~30+ files, so the planner must bundle replacements per-surface rather than one-at-a-time, (2) the season archive wizard is application-level orchestration (no new DB triggers — matches Phase 8 LOS / Phase 9 rollover precedent), and (3) the `/members/[slug]` page needs to aggregate cross-season stats from tables that already filter by `season`, so the stats library must scope queries correctly.

**Primary recommendation:** Build Plan 01 as the migration + theme + `<MemberLink>` helper + site-wide rewrite (mechanical replacement), Plan 02 as member profile page + pure stats aggregator + SVG chart, Plan 03 as `/how-it-works` + hero imagery + mobile audit, Plan 04 as the `/admin/season-rollover` wizard + end-of-season summary page + home-widget rank strip.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Visual branding:**
- Rich PL feel — push beyond polished chrome: team kit colour accents on prediction cards, hero imagery on `/standings` and landing, team crests everywhere they fit
- Use free / already-in-use assets ONLY — Wikipedia SVG team crests (already shipped in Phase 2), no official Premier League logos or licensed marks
- Colour palette: PL-inspired — Primary purple `#37003c`, Accent green `#00ff85`, neutral slate/white for cards
- Dark mode: auto from system preference (Tailwind `dark:` prefix pattern)
- Typography: keep system font stack — zero network cost, instant render
- No logo licensing — app name stays "George's Predictor" with a simple wordmark

**Team kit colour accents:**
- Each team in the `teams` table gets a `primary_color` + `secondary_color` TEXT column (hex)
- Seed via migration with published team kit colours (Wikipedia team infoboxes)
- Usage: prediction cards show a subtle left-border in the home team's primary colour, fixture headers use two colours diagonally, league table name rows carry a thin coloured left accent matching the user's "favourite team" if set (new optional member field)

**Hero imagery:**
- Public `/standings` and `/` get a hero banner: simple stadium-silhouette SVG or geometric PL-purple panel with "George's Predictor" wordmark + tagline
- Generate in-code (CSS gradients + SVG) rather than loading images

**Mobile polish:** Audit all existing routes against iPhone 13 / Pixel 5; fix horizontal-scroll, tap-target, fixed-footer stacking issues

**Member profile depth (DATA-02 + DATA-03):**
- Current-season: total points, rank, prediction accuracy %, correct-result count, correct-score count, bonus confirmation rate, LOS status/teams-used/LOS wins count
- Previous seasons: list of seasons played with rank + total points + trophies (LOS winner, H2H survivor, weekly winner counts)
- Achievements: GW winner badges, all-correct bonus flags from pre-season, LOS winner, H2H steal survivor
- Chart: simple weekly-points line chart with running-total overlay — SVG-only, no charting library

**Profile visibility:** logged-in members can view any other member's profile (open book). George sees additional admin-only fields (email, registration date). NOT public — unauth users redirect to `/signin`.

**Clickable usernames:** every rendered member name becomes a link to `/members/{display_name_slug}` — replace all `<span>{displayName}</span>` usages. Slug derivation: `lower(trim(replace(displayName, ' ', '-')))` with uniqueness suffix if needed.

**How It Works page:**
- Route: `/how-it-works` (public, no auth), also linked from footer + signup page
- Single long-scroll with anchor jump-links at top
- Sections: Welcome → How to play → Scoring → Bonuses (types + Double Bubble + Golden Glory) → LOS → H2H Steals → Pre-Season → Prizes → FAQ
- Friendly explainer tone with worked examples
- Dev-env screenshots of: prediction form, gameweek results, admin bonus panel, LOS picker, pre-season form
- Screenshots stored in `/public/how-it-works/*.png`, retaken on material UI changes (short runbook)
- FAQ covers postponed fixtures, ties at top, can't change after kickoff, past seasons access

**Season archive:**
- Versioned with `season` INT column — extend every relevant table to include `season`
- Archive operation = metadata update on `seasons` table (set `ended_at`, mark inactive); NO physical data movement
- Cross-season queries use `WHERE season = X` filters everywhere
- Follows Phase 9 `pre_season_picks.season` + Phase 8 `los_competitions.season` precedent

**New-season wizard:**
- Admin route `/admin/season-rollover` — guided 8-step checklist
- (1) Confirm current season closed, (2) Archive with summary, (3) Define new season + GW1 kickoff, (4) Fixture sync from football-data.org, (5) Championship list carry-forward / rollover, (6) Members carry-forward with points reset to 0, (7) Pre-season window opens, (8) Final confirmation launches live
- Each step explicit "Next", back button works; cancel at any step = zero side effects until step 8

**Off-season member experience:** end-of-season summary page at `/` when current season archived (final standings, champion spotlight, LOS winners, prize awards, pre-season awards). Banner: "Next season kicks off on {date}". Profile pages still work. Prediction form locked with "Season over" message.

**League table prominence:**
- Already the landing page at `/` via Phase 10 re-export
- Add small league-table widget to logged-in member home: their rank + surrounding 5 players (rank-2 to rank+2 relative to viewer)

**UI polish checklist:** team crest consistent sizing + lazy-load + object-contain; button styling primary=purple / accent=green / destructive=red / secondary=slate outline; empty states with friendly copy + single CTA; skeleton loading placeholders (not spinners); error states with retry; auto dark mode; print styles for admin pages.

### Claude's Discretion
- Exact hero SVG composition
- Card corner radius, shadow depth, spacing unit (keep consistent)
- Chart visual style (line thickness, colour, axis labels)
- Mobile nav pattern (existing drawer vs new bottom-nav) — optimise for tap targets
- Whether to add "favourite team" picker to member profile
- Achievement badge icons (use existing lucide icons)
- Whether How It Works uses screenshots vs illustrated diagrams — screenshots preferred
- Whether to add "Share my profile" button (nice-to-have)

### Deferred Ideas (OUT OF SCOPE)
- Favourite team picker on profile (Claude's discretion — might ship, might not)
- Animated celebration on league-table rank change — v2
- Analytics dashboard (ANLYT-* v2)
- Member vs member comparison tool — ANLYT-02 v2
- Weekly awards automation — SOC-02 v2
- PL Premier Sans typography — skip, licensing cost
- Official PL logo usage — skip, legally risky
- Multi-language support — out of scope
- Dark-mode manual toggle — `prefers-color-scheme` auto-detect is enough
- "Share my profile" social share button — Claude's discretion
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UI-01 | Polished PL visual design with team badges and photos | Existing `team-badge.tsx` component ships crest rendering; Plan 01 adds `teams.primary_color/secondary_color` + tailwind theme tokens; hero SVGs generated in-code (CSS gradients + inline SVG) |
| UI-02 | Mobile-responsive — works on phones | Existing codebase already uses Tailwind responsive prefixes (`sm:`, `md:`); Plan 03 is a viewport audit pass to fix horizontal-scroll, tap-target, fixed-footer stacking regressions |
| UI-03 | League table prominently displayed | Already satisfied by Phase 10 Plan 04 (`src/app/page.tsx` re-exports `/standings`); Plan 04 adds home-widget "your rank + neighbours" strip for logged-in members |
| UI-04 | Clean prediction submission form | Phase 3 shipped working form; Plan 01 adds purple/green accents + home-team-colour left-border per fixture card |
| UI-05 | Public "How It Works" page | Plan 03 builds `/how-it-works` — long-scroll with anchor jumps, friendly tone, dev-env PNG screenshots committed to `/public/how-it-works/` |
| DATA-02 | Season archive with historical records | Column-versioning via `season` INT already established (Phase 8 `los_competitions`, Phase 9 `pre_season_picks` + `seasons` + `pre_season_awards`); Plan 01 migration 012 backfills any missing `season` columns; Plan 04 wizard updates `seasons.ended_at` metadata with zero data movement |
| DATA-03 | Member profiles with total points and history across seasons | Plan 02 builds `/members/[slug]` page + pure `src/lib/profile/stats.ts` library that aggregates per-season totals by filtering existing tables on `season` |
</phase_requirements>

## Standard Stack

### Core (already in project — verified from `package.json`)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.2.3 | App Router, server actions, route handlers | Already shipped in every prior phase |
| react | 19.2.4 | RSC + client components | Already shipped |
| tailwindcss | 4.x | CSS-first theming via `@theme` in `globals.css` — no `tailwind.config.ts` exists | Project uses Tailwind v4 (PostCSS plugin `@tailwindcss/postcss`). Theme extension happens inside `src/app/globals.css` via `@theme inline { ... }` |
| @radix-ui/react-dialog | 1.1.15 | Wizard step modals (if needed) | Already used for `CloseGameweekDialog`, `MoveFixtureDialog` |
| @radix-ui/react-select | 2.2.6 | Favourite-team picker dropdown (if shipped) | Already used elsewhere |
| lucide-react | 1.8.0 | Achievement icons (Trophy, Star, Crown, Medal) | Already used across admin + member UIs |
| @supabase/supabase-js | (via clients) | DB queries | Already used; admin client + session client patterns established |

### Supporting — new (additions this phase)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| *(none)* | — | Pure SVG chart, no charting lib | Member profile weekly-points chart per locked decision |
| *(none)* | — | No image hosting, SVG hero in-code per locked decision | Hero imagery on `/standings` and `/` |

**Critical:** Locked decisions in CONTEXT.md explicitly forbid charting libraries and image hosting. Do not propose `recharts`, `chart.js`, `@vercel/og`, `next-cloudinary`, or similar.

### Alternatives Considered (and rejected by CONTEXT.md)
| Instead of | Could Use | Why Rejected |
|------------|-----------|----|
| Pure SVG chart | recharts, chart.js, visx | CONTEXT.md: "SVG-only, no charting library (kept lightweight)" |
| In-code SVG hero | Stock image + next/image | CONTEXT.md: "Generate in-code (CSS gradients + SVG) rather than loading images — keeps bundle size tiny, no asset hosting" |
| System fonts | next/font + Google Fonts | CONTEXT.md: "keep system font stack — zero network cost, instant render" |
| Slug stored as computed helper | Dedicated `slug` column | CONTEXT.md lets helper or column; project precedent (`championship_teams_season_name_ci_idx` uses functional index on `lower(btrim(name))`) suggests functional index + helper function |

**Installation:** No new dependencies. All stack items are already installed.

## Architecture Patterns

### Recommended Project Structure (additions to existing tree)
```
supabase/migrations/
└── 012_polish_continuity.sql       # teams.primary_color/secondary_color, members.favourite_team_id, members.ended_at on seasons, functional slug index, any missing season columns

src/lib/profile/
└── stats.ts                        # PURE — aggregates per-season stats (inputs: DB rows; outputs: typed ProfileStats)

src/lib/members/
└── slug.ts                         # PURE — toSlug(displayName) + findMemberBySlug helper (async DB)

src/components/shared/
└── member-link.tsx                 # <MemberLink displayName={...} id={...} /> — renders <Link href={`/members/${toSlug(displayName)}`}>

src/components/charts/
└── weekly-points-chart.tsx         # Pure SVG line chart, props: { weeks: { gw, points, runningTotal }[] }

src/app/(member)/members/[slug]/
├── page.tsx                        # Member profile (auth-gated via member layout)
└── _components/
    ├── profile-header.tsx
    ├── season-stats-panel.tsx
    ├── achievement-badges.tsx
    └── season-history-table.tsx

src/app/(public)/how-it-works/
├── page.tsx                        # Single long-scroll, no auth
└── _components/                    # Anchor nav, section components

src/app/(public)/end-of-season/
└── page.tsx                        # Conditional render at `/` when current season archived

src/app/(admin)/admin/season-rollover/
├── page.tsx                        # Entry — wizard shell
└── _components/                    # Step components (1-8)

src/actions/admin/
└── season-rollover.ts              # archiveSeason, defineNewSeason, launchNewSeason server actions (idempotent, requireAdmin)

public/how-it-works/
├── prediction-form.png             # Dev-env screenshots, ~600-800px width
├── gameweek-results.png
├── admin-bonus-panel.png
├── los-picker.png
└── pre-season-form.png

docs/
└── how-it-works-screenshot-runbook.md   # One-page guide for George/Dave to retake screenshots
```

### Pattern 1: Column versioning (season INT)
**What:** Extend any per-season table with `season int NOT NULL`. Never move data between seasons — query-time filter.
**When to use:** Every table that stores per-member per-season state.
**Existing precedents (verified via grep on migrations):**
- `gameweeks.season` (migration 002) — already exists
- `pre_season_picks.season` (migration 007) — already exists
- `pre_season_awards.season` (migration 009) — already exists
- `seasons.season UNIQUE` (migration 009) — already exists
- `los_competitions.season` (migration 008) — already exists
- `championship_teams.season` (migration 010) — already exists
- `members` — currently NOT season-scoped (points stored as aggregate `starting_points`). CONTEXT.md decision: points are current-season aggregate; historical per-season totals **derived at query time** from `prediction_scores` + `bonus_awards` filtered by season (via gameweek FK join)

**Gap analysis (answer to critical research question "Does the existing schema already have `season` columns where needed?"):**

| Table | Has `season`? | Action in migration 012 |
|-------|---------------|-------------------------|
| `gameweeks` | YES (migration 002) | — |
| `fixtures` | NO (joins via `gameweek_id` → `gameweeks.season`) | No-op; use JOIN |
| `predictions` | NO (joins via `fixture_id` → `gameweek_id`) | No-op; use JOIN |
| `prediction_scores` | NO (joins via `prediction_id` → `fixture_id` → `gameweek_id`) | No-op; use JOIN |
| `bonus_awards` | NO (joins via `gameweek_id`) | No-op; use JOIN |
| `prize_awards` | NO (joins via `gameweek_id`) | No-op; use JOIN |
| `los_competitions` | YES (migration 008) | — |
| `los_picks` | NO (joins via `competition_id` → `season`) | No-op; use JOIN |
| `h2h_steals` | NO (joins via gameweek) | No-op; use JOIN |
| `pre_season_picks` | YES (migration 007) | — |
| `pre_season_awards` | YES (migration 009) | — |
| `seasons` | YES (is the registry) | Add `ended_at timestamptz NULL` column |
| `members` | N/A — aggregate-only column `starting_points` | Add `favourite_team_id uuid NULL REFERENCES teams(id)` (Claude's discretion but harmless if unset) |
| `teams` | N/A (team roster is global) | Add `primary_color text NULL`, `secondary_color text NULL` |

**Conclusion:** no missing `season` columns — every per-season table joins to `gameweeks` or `los_competitions` or already has its own column. Migration 012 is additive only (teams colours + member favourite team + seasons.ended_at + functional slug index on members).

**Example (existing precedent from migration 010):**
```sql
-- Source: supabase/migrations/010_championship_teams.sql:35
CREATE UNIQUE INDEX IF NOT EXISTS championship_teams_season_name_ci_idx
  ON public.championship_teams (season, lower(btrim(name)));
```
Phase 11 migration 012 mirrors this with:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS members_display_name_slug_idx
  ON public.members (lower(btrim(replace(display_name, ' ', '-'))));
```
This enforces slug uniqueness at the DB level and allows fast `WHERE slug = X` lookup.

### Pattern 2: Pure stats library (mirrors Phase 4 scoring + Phase 9 pre-season)
**What:** Zero-import pure function taking DB row arrays and returning aggregate stats.
**When to use:** Cross-season profile aggregation.
**Example (existing precedent from Phase 9 — note the pattern signature):**
```ts
// Source: src/lib/pre-season/calculate.ts (Phase 9)
export function calculatePreSeasonPoints(
  picks: PreSeasonPickRow,
  actuals: SeasonActuals,
): { points: number; flags: PreSeasonAwardFlags } {
  // Pure, no imports, no DB calls
}
```
Phase 11 mirrors this:
```ts
// src/lib/profile/stats.ts
export function aggregateSeasonStats(input: {
  predictionScores: PredictionScoreRow[]
  bonusAwards: BonusAwardRow[]
  prizeAwards: PrizeAwardRow[]
  preSeasonAward: PreSeasonAwardRow | null
  losPicks: LosPickRow[]
  losCompetitions: LosCompetitionRow[]
  h2hSteals: H2hStealRow[]
  gameweeks: GameweekRow[]
  memberId: string
  season: number
}): SeasonStats {
  // Pure — returns totalPoints, rank, accuracy%, correctResults, correctScores,
  // bonusConfirmationRate, losStatus, losTeamsUsed, losWins, gwWinnerCount
}
```

### Pattern 3: Application-level orchestration for season archive (no DB triggers)
**What:** Multi-step admin wizard implemented as a sequence of idempotent server actions, each with `requireAdmin()` + `createAdminClient()` + Zod validation + `revalidatePath()`.
**When to use:** Any admin flow that touches multiple tables or has multiple confirmation points.
**Precedent (STATE.md entries):**
- Phase 8: "No DB triggers for LOS lifecycle — all orchestration is application-level"
- Phase 9 Plan 03: "Rollover is application-side only (no DB triggers)"

**Step-to-server-action mapping for the wizard:**

| Step | Server action | Idempotent? | Side effects |
|------|---------------|-------------|--------------|
| 1 — Confirm current season closed | `getArchiveReadiness(season)` (read-only) | yes | none |
| 2 — Archive current season | `archiveSeason(season)` | yes (sets `seasons.ended_at = now()` if null) | `seasons.ended_at` only |
| 3 — Define new season | `defineNewSeason(year, gw1Kickoff)` | yes (INSERT ON CONFLICT DO NOTHING — row already seeded in migration 009) | UPSERT on `seasons` |
| 4 — Fixture sync | re-use existing `/api/sync-fixtures` (already idempotent per Phase 2) | yes | `fixtures`, `teams`, `gameweeks` |
| 5 — Championship carry-forward / rollover | re-use Phase 9 `endOfSeasonRollover` OR new `carryForwardChampionshipTeams(newSeason)` | yes | `championship_teams` |
| 6 — Members carry-forward | `carryForwardMembers(newSeason)` — **DOES NOT** reset `starting_points`; per CONTEXT.md points are aggregate-current, so reset means `UPDATE members SET starting_points = 0` | yes (re-runnable) | `members.starting_points` |
| 7 — Pre-season window opens | automatic — `pre_season_picks` lockout reads `seasons.gw1_kickoff` (Phase 9 mechanism) | yes | none — gated by seasons row from step 3 |
| 8 — Launch new season | `launchNewSeason(season)` — clears off-season banner by flipping a flag or detecting by query | yes | `admin_settings` or similar flag |

**Critical subtlety (CONTEXT.md ambiguity to resolve in planning):** Step 6 says "points reset to 0 for the new season; display_name + user_id preserved". The current schema stores points as `members.starting_points` (single aggregate). Two possible interpretations:
- **Interpretation A (simpler):** `UPDATE members SET starting_points = 0 WHERE approval_status='approved'`. History is queryable via `WHERE gameweek.season=X` aggregations.
- **Interpretation B (stricter):** Add `member_season_totals(member_id, season, final_points)` snapshot table, zero out `starting_points`. Avoids recomputing archived totals on every profile-page load.

**Recommendation:** Interpretation A is correct given CONTEXT.md's "points are current-season AGGREGATE; historical per-season totals derived at query time". No new snapshot table needed. Plan 04 wizard: just zero `starting_points`.

### Pattern 4: Clickable username via shared helper (`<MemberLink>`)
**What:** Single React component that receives `displayName` (and optionally `memberId`), renders `<Link href={`/members/${toSlug(displayName)}`}>`.
**When to use:** Every surface that currently renders a member's display_name as plain text.

**Answer to critical research question "Where is the MemberLink helper best placed — does a similar util exist?":** No existing util. Place at `src/components/shared/member-link.tsx`. Site-wide replacement touches **44 files** (from Grep), of which ~30 are surfaces where a member name is displayed in a list/table (the rest are form inputs, type definitions, or auth — those are OUT of scope).

**In-scope replacement targets (verified from Grep):**

| File | Occurrence |
|------|-----------|
| `src/app/(public)/standings/page.tsx` | League table rows `{m.display_name}` → `<MemberLink>` (NOTE: public page — if unauth, link target 404s or redirects to /login; acceptable per locked decision) |
| `src/components/predictions/predictions-table.tsx:107` | Admin "All Predictions" table |
| `src/components/los/admin-los-table.tsx:192` | Admin LOS table |
| `src/components/los/los-standings.tsx:87` | Member LOS view |
| `src/components/admin/confirm-bonus-awards.tsx:123` | Admin bonus confirmation list |
| `src/components/admin/confirm-prize-dialog.tsx:27` | Prize confirmation dialog (read-only display; link optional) |
| `src/components/admin/import-preview-table.tsx:55` | Import preview — likely skip (not a live member link) |
| `src/components/admin/member-table.tsx:158` | Admin members list |
| `src/components/member/dashboard-overview.tsx:27` | Member dashboard welcome — skip (own name, no link needed) |
| `src/app/(admin)/admin/pre-season/_components/admin-pre-season-table.tsx` | Admin pre-season table |
| `src/app/(member)/gameweeks/[gwNumber]/page.tsx` | Gameweek results per member |
| `src/app/(member)/bonuses/page.tsx` | Member bonuses view |
| `src/app/(admin)/admin/bonuses/page.tsx` | Admin bonuses view |
| `src/app/(admin)/admin/prizes/page.tsx` | Admin prizes view |
| `src/app/(admin)/admin/predictions/page.tsx` | Admin predictions page |

**Out-of-scope (form inputs, not displays):** signup-form.tsx, member-actions.tsx, member-table.tsx sort fields, action handlers, type definitions, validator files, email templates (PDF context — not clickable), import.ts, parse.ts.

**Planner guidance:** Bundle per-surface in tasks (e.g. Task "Admin surfaces" replaces all 5-6 admin files; Task "Member surfaces" replaces all member-facing files). Do NOT create a task per file.

### Pattern 5: Tailwind v4 CSS-first theme extension
**What:** Extend theme via `@theme` directive inside `src/app/globals.css` — no `tailwind.config.ts` file.
**Why:** Project is on Tailwind v4 (`"tailwindcss": "^4"` + `@tailwindcss/postcss` in `package.json`). There is NO `tailwind.config.ts` in the repo (verified via glob).
**Example:**
```css
/* src/app/globals.css */
@import "tailwindcss";

@theme inline {
  --color-pl-purple: #37003c;
  --color-pl-green: #00ff85;
  --color-pl-purple-50: #faf5fb;
  --color-pl-purple-900: #2a002f;
  /* ... */
}
```
Then use in JSX: `className="bg-pl-purple text-pl-green"`.

### Pattern 6: Next.js 16 App Router wizard (answer to critical research question)
**What:** Multi-step form with state persistence across steps.
**Answer to critical research question "Next.js 16 App Router patterns for the wizard (form state persistence)":**

Three viable patterns, in increasing complexity:
1. **URL-param state** (simplest, recommended for admin wizards): `?step=1&season=2026` — each step is an RSC, server action on submit validates + redirects to `?step=2`. State is URL, no client JS needed beyond Link navigation. **Project precedent:** Phase 2 uses `?team=id` URL state for fixture filter.
2. **Client component with useState** + server actions: useState for step index, form data; call server action on step transitions. Good when steps need interactive previews. **Project precedent:** `CloseGameweekDialog` uses dialog-scoped state.
3. **Server action with form ref** (Next 16 default React 19 pattern): each step is a `<form action={...}>`, server action returns partial state, client `useFormState` persists across renders.

**Recommendation for Phase 11 wizard:** Pattern 1 (URL-param state). Reasons: each step is naturally a distinct admin route, server actions already exist per step operation, no client-JS needed, matches Phase 2's simple URL-state precedent, easily cancellable (just navigate away), back button works natively.

### Anti-Patterns to Avoid
- **DB triggers for archive:** rejected by codebase precedent (Phase 8 + Phase 9 both went application-side)
- **Physical data movement between season partitions:** CONTEXT.md explicitly rejects this — column versioning only
- **Charting libraries:** CONTEXT.md explicitly rejects — pure SVG mandated
- **Image hosting / next/og / image CDN:** CONTEXT.md explicitly rejects — in-code SVG mandated
- **Google Fonts / next/font:** CONTEXT.md explicitly rejects — system stack mandated
- **One task per file for the clickable-username rewrite:** group by surface instead
- **Hand-written `tailwind.config.ts`:** Tailwind v4 project — use `@theme` in CSS
- **New DB columns for historical per-season snapshots:** per CONTEXT.md, derive at query time from existing season-scoped tables

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Slug generation for member names | Custom regex library | Inline `toSlug(name) = name.trim().toLowerCase().replace(/\s+/g, '-')` (matches project's Phase 7 display_name lookup idiom `lower(trim())`) | Slugs here are simple; project precedent uses Postgres `lower(btrim(...))` functional indexes. Do not pull `slug`, `slugify`, `@sindresorhus/slugify` npm deps |
| Dark mode toggle | Custom context + localStorage | `prefers-color-scheme` CSS media query + Tailwind v4 `dark:` prefix | CONTEXT.md: "auto from system preference" — explicitly deferred manual toggle |
| Admin auth guard | Custom permission library | Reuse existing `requireAdmin()` pattern (e.g. `src/actions/admin/gameweeks.ts:23-35`) | Already shipped, already tested, idempotent |
| Idempotent server action pattern | New framework | Zod parse + `createAdminClient()` + UPSERT ON CONFLICT + `revalidatePath()` — matches every Phase 5-10 admin action | Copy verbatim from `closeGameweek` or `confirmBonusAwards` |
| Chart rendering | recharts / chart.js / visx / nivo / d3 | Pure SVG — calculate points with `points[i].x = (i / (n-1)) * width`, line via `<path d="M ... L ..." />` | CONTEXT.md locked decision |
| Hero image composition | Stock image / generated AI image | In-code SVG with `<linearGradient>` and `<path>` elements | CONTEXT.md locked decision + zero-cost constraint |
| OG image generation | `@vercel/og` / `next/og` | Static PNG committed to `/public/og.png` OR none — app is auth-gated / invite-only | No social sharing value for private competition |

**Key insight:** The constraints (zero-cost, non-technical users, small friend group, system fonts only, in-code SVG, no charting lib) steer Phase 11 toward maximum use of platform primitives and existing codebase patterns. Every "should we use library X?" question has already been answered by CONTEXT.md: no.

## Common Pitfalls

### Pitfall 1: Tailwind v4 breaking changes (missing config file)
**What goes wrong:** Planner assumes `tailwind.config.ts` exists and asks for `theme.extend.colors` edits — fails because file does not exist.
**Why it happens:** Tailwind v3 muscle memory from training data.
**How to avoid:** Theme extension goes into `src/app/globals.css` under `@theme inline { ... }` — verified present in current `globals.css`.
**Warning signs:** Task description mentions editing `tailwind.config.ts` — reject and rewrite.

### Pitfall 2: Member display_name vs slug drift
**What goes wrong:** Two members register with similar names — "John Smith" and "john smith" both map to slug `john-smith`.
**Why it happens:** Slug is computed, not stored with uniqueness enforcement.
**How to avoid:** Migration 012 adds `CREATE UNIQUE INDEX members_display_name_slug_idx ON members (lower(btrim(replace(display_name, ' ', '-'))))`. If a signup would create a duplicate slug, admin approval flow rejects (or auto-suffixes in slug generator).
**Warning signs:** 404 on `/members/[slug]` for an existing member, or profile page showing the wrong person.

### Pitfall 3: admin_notifications CHECK constraint drift (every migration)
**What goes wrong:** Migration 012 adds a new notification type (e.g. `'season_archived'`) without preserving the existing 23 types from migration 011.
**Why it happens:** `ALTER TABLE ... DROP CONSTRAINT ... ADD CONSTRAINT` replaces the whole list.
**How to avoid:** Copy the full existing type list from migration 011 (or query `pg_constraint` first), add new types, re-add. STATE.md calls this "Pitfall 7 ritual" from Phase 9 + Phase 10.
**Warning signs:** Admin notification inserts fail after deploy.

### Pitfall 4: revalidatePath per-path (not recursive) in Next 16
**What goes wrong:** Season archive action revalidates `/` but `/standings` is stale.
**Why it happens:** Next 16 `revalidatePath` is per-path, not recursive (STATE.md Phase 10 P04 entry confirms).
**How to avoid:** Every mutation action calls `revalidatePath('/')` AND `revalidatePath('/standings')` AND any other affected page. For the wizard: `revalidatePath('/admin')`, `revalidatePath('/admin/season-rollover')`, `revalidatePath('/')`, `revalidatePath('/standings')`, `revalidatePath('/dashboard')`.
**Warning signs:** User reports UI showing pre-archive state after clicking "Launch new season".

### Pitfall 5: Wiring /members/[slug] to auth-only in the (member) route group
**What goes wrong:** Member clicks a username link from the public /standings page while unauth, hits `/members/[slug]`, expects redirect to /login but instead sees an error.
**Why it happens:** Middleware auth-gating on `/members/*` not configured; (member) layout bounces to /login but raw route might exist under /app/members.
**How to avoid:** Place route under `src/app/(member)/members/[slug]/page.tsx` — auth-gating is inherited from `(member)/layout.tsx` (which redirects to /login on no session). Verified pattern from existing `(member)/profile/page.tsx`.
**Warning signs:** Unauth users land on a broken profile page instead of /login.

### Pitfall 6: `starting_points` zero-reset during step 6 clobbers approvals
**What goes wrong:** Wizard resets `starting_points` for ALL members — including rows with `approval_status = 'pending'` or `'rejected'`.
**Why it happens:** Naive `UPDATE members SET starting_points = 0`.
**How to avoid:** `UPDATE members SET starting_points = 0 WHERE approval_status = 'approved' AND user_id IS NOT NULL`. Imported placeholder rows (user_id NULL) can also reset — verify with team.
**Warning signs:** Mid-season-imported members show 0 points in the NEW season when they shouldn't have been touched.

### Pitfall 7: React email templates hard-code slate/white — don't auto-inherit new brand tokens
**What goes wrong:** Phase 10 email templates (`src/emails/*.tsx`) use inline Tailwind-equivalent styles or hex values directly; they don't participate in the `@theme` tokens.
**Why it happens:** react-email renders in email-client contexts where CSS variables are unreliable.
**How to avoid:** For Phase 11 email re-colouring, edit the hex values directly in `src/emails/_shared/*` and the 4 template files. Do NOT refactor to reference CSS variables.
**Warning signs:** Brand refresh shows on site but emails still look Phase 10.

### Pitfall 8: Screenshots in /public are committed to git and inflate repo (MEDIUM confidence)
**What goes wrong:** 5 PNG screenshots at ~500KB each = 2.5MB committed; future re-shoots double-commit binary diffs.
**Why it happens:** Default path of least resistance is `git add /public/how-it-works/*.png`.
**How to avoid (answer to critical research question "Whether screenshots in How It Works should be committed as PNG files or stored off-repo"):** **Commit the PNGs to git.** Justifications:
  1. Zero-cost constraint forbids image CDN / off-repo hosting
  2. 5 × ~500KB = 2.5MB one-time — trivial for a modern git repo
  3. Vercel build pipeline already serves `/public/` automatically — no config needed
  4. Screenshots change rarely (per CONTEXT.md: "retaken whenever UI changes materially")
  5. Using git-lfs or an external bucket adds friction for Dave (backup admin) — violates non-technical-user constraint

Trim screenshots before commit: 800px width max, PNG optimization via `pngquant` (optional, one-time). A `docs/how-it-works-screenshot-runbook.md` documents the recipe.

**Warning signs:** Individual screenshot commits > 1MB, or future UI changes bloat repo.

## Code Examples

### Example 1: toSlug helper (pure)
```ts
// src/lib/members/slug.ts
// Pure — matches Postgres functional-index semantics:
//   CREATE UNIQUE INDEX ... ON members (lower(btrim(replace(display_name, ' ', '-'))))
export function toSlug(displayName: string): string {
  return displayName.trim().toLowerCase().replace(/\s+/g, '-')
}

// DB lookup helper (async)
export async function findMemberBySlug(
  supabase: SupabaseAdminClient,
  slug: string,
): Promise<MemberRow | null> {
  const { data } = await supabase
    .from('members')
    .select('*')
    .filter('display_name', 'ilike', slug.replace(/-/g, ' '))  // approximate
    .maybeSingle()
  return (data as MemberRow) ?? null
}
```

### Example 2: MemberLink component
```tsx
// src/components/shared/member-link.tsx
import Link from 'next/link'
import { toSlug } from '@/lib/members/slug'

interface MemberLinkProps {
  displayName: string
  className?: string
}

export function MemberLink({ displayName, className = '' }: MemberLinkProps) {
  return (
    <Link
      href={`/members/${toSlug(displayName)}`}
      className={`hover:text-pl-green transition ${className}`}
    >
      {displayName}
    </Link>
  )
}
```

### Example 3: Migration 012 skeleton
```sql
-- supabase/migrations/012_polish_continuity.sql
-- Phase 11: teams colours + members favourite team + seasons.ended_at + slug index

-- 1. Team kit colours
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS primary_color   text,
  ADD COLUMN IF NOT EXISTS secondary_color text;

-- 2. Member favourite team (Claude's discretion — nullable)
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS favourite_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;

-- 3. Seasons archive marker
ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS ended_at timestamptz;

COMMENT ON COLUMN public.seasons.ended_at IS
  'Set when admin archives the season via /admin/season-rollover. Null = active.';

-- 4. Slug functional index on members.display_name (unique)
CREATE UNIQUE INDEX IF NOT EXISTS members_display_name_slug_idx
  ON public.members (lower(btrim(replace(display_name, ' ', '-'))));

-- 5. Seed team colours (per CONTEXT.md — Wikipedia team infoboxes)
UPDATE public.teams SET primary_color = '#EF0107', secondary_color = '#FFFFFF' WHERE lower(name) LIKE 'arsenal%';
UPDATE public.teams SET primary_color = '#670E36', secondary_color = '#9FC5E8' WHERE lower(name) LIKE 'aston villa%';
-- ... 18 more UPDATEs; source Wikipedia team infobox for each PL club

-- 6. admin_notifications CHECK — add 'season_archived' and 'season_launched' types
ALTER TABLE public.admin_notifications DROP CONSTRAINT admin_notifications_type_check;
ALTER TABLE public.admin_notifications ADD CONSTRAINT admin_notifications_type_check
  CHECK (type IN (
    -- [All 23 existing types from migration 011 — must copy verbatim]
    'new_signup','approval_needed','system','sync_failure','fixture_rescheduled',
    'fixture_moved','result_override','scoring_complete','bonus_reminder','gw_complete',
    'prize_triggered','bonus_award_needed','import_complete','los_winner_found',
    'los_competition_started','h2h_steal_detected','h2h_steal_resolved',
    'pre_season_all_correct','pre_season_category_correct','pre_season_awards_ready',
    'report_send_failed','kickoff_backup_failed','report_render_failed',
    -- New Phase 11 types
    'season_archived','season_launched'
  ));
```

### Example 4: Pure SVG weekly-points chart
```tsx
// src/components/charts/weekly-points-chart.tsx
interface Week { gw: number; points: number; runningTotal: number }

export function WeeklyPointsChart({ weeks, width = 600, height = 200 }: { weeks: Week[]; width?: number; height?: number }) {
  if (weeks.length === 0) return null
  const maxTotal = Math.max(...weeks.map(w => w.runningTotal), 1)
  const maxWeekly = Math.max(...weeks.map(w => w.points), 1)
  const xStep = width / Math.max(weeks.length - 1, 1)

  const runningPath = weeks
    .map((w, i) => `${i === 0 ? 'M' : 'L'} ${i * xStep} ${height - (w.runningTotal / maxTotal) * height}`)
    .join(' ')

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      {/* Running total line */}
      <path d={runningPath} fill="none" stroke="#37003c" strokeWidth={2} />
      {/* Weekly points bars */}
      {weeks.map((w, i) => (
        <rect
          key={w.gw}
          x={i * xStep - 4}
          y={height - (w.points / maxWeekly) * height * 0.4}
          width={8}
          height={(w.points / maxWeekly) * height * 0.4}
          fill="#00ff85"
        />
      ))}
    </svg>
  )
}
```

### Example 5: Wizard URL-param pattern
```tsx
// src/app/(admin)/admin/season-rollover/page.tsx
export const dynamic = 'force-dynamic'

export default async function SeasonRolloverPage({
  searchParams,
}: { searchParams: Promise<{ step?: string; season?: string }> }) {
  const params = await searchParams  // Next 15+ async searchParams
  const step = parseInt(params.step ?? '1', 10)
  // Render step component by switch
}
```

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `tailwind.config.ts` `theme.extend` | Tailwind v4 `@theme inline` in CSS | No config file; edit `globals.css` |
| Separate charting library for simple trend | Pure SVG with inline path math | Zero bundle cost; CONTEXT.md mandated |
| DB triggers for archive | Application-level orchestration | Project precedent (Phase 8 + 9) |
| `useFormState` with client heavy lifting | Async `searchParams` + server actions returning redirect | Next 16 App Router idiom |

**Deprecated/outdated:**
- Tailwind v3 config patterns: training data still strongly biases toward `tailwind.config.ts`. This project has migrated to v4.
- `params` and `searchParams` as synchronous: Next 15+ made these Promise-based. All existing phase-10 code uses `await searchParams` / `await params` — continue the pattern.

## Open Questions

1. **Team kit colour accuracy**
   - What we know: CONTEXT.md says "Wikipedia team infoboxes" — free, consistent source
   - What's unclear: exact hex values per team (needed for migration 012 seed)
   - Recommendation: Planner task should list the 20 PL teams + hex values manually (15-minute task). Source: each club's Wikipedia article → infobox "Colours" field. Accept ~10% variance between sources; visual consistency matters more than pantone accuracy.

2. **PL colour palette variance (MEDIUM confidence)**
   - What we know: CONTEXT.md specifies `#37003c` (purple) + `#00ff85` (green)
   - What's unclear: official PL brand uses slightly different variants (`#360D3A`, `#3D195B` per web sources)
   - Recommendation: Keep CONTEXT.md values. Close enough; app is not licensed PL merchandise. If George comments on the exact shade, adjust in Plan 01 via the single CSS `@theme` declaration — low change cost.

3. **Favourite-team picker ship/defer (Claude's discretion per CONTEXT.md)**
   - What we know: migration 012 already adds the nullable column, cheap to include
   - What's unclear: worth the UI surface vs rollover risk
   - Recommendation: Ship the DB column. Ship the picker on the member profile page in Plan 02 (one `<Select>` component, ~30 min). Zero-harm if unset — league table accent gracefully no-ops.

4. **How It Works dev-env screenshots — committed decision**
   - What we know: CONTEXT.md says screenshots, `/public/how-it-works/*.png`
   - What's unclear: whether to commit binaries or use git-lfs
   - Recommendation: **Commit as PNG files.** See Pitfall 8 for full reasoning.

5. **End-of-season summary page routing**
   - What we know: CONTEXT.md says "at `/` when current season archived"
   - What's unclear: whether `/` conditionally renders end-of-season OR redirects OR overlays
   - Recommendation: `/` (already re-exporting `/standings`) becomes an RSC that checks `seasons.ended_at IS NOT NULL AND no_newer_active_season_exists` — if true, renders end-of-season summary RSC instead of standings. One file change, one new RSC.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 + @testing-library/react 16.3.2 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npm run test:run -- <path>` |
| Full suite command | `npm run test:run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | Theme tokens present; team-badge accepts primary_color prop | unit (snapshot / class-presence) | `npm run test:run -- tests/components/team-badge.test.tsx` | ❌ Wave 0 |
| UI-02 | Mobile audit — manual pass (viewport checklist merged into docs/FINAL_QA_CHECKLIST.md §13) | manual-only (justified: pixel-perfect responsive regression is human-visual, unit tests can't assert on real viewport rendering) | — | N/A — deferred to master QA sheet |
| UI-03 | Home widget renders member rank + 4 neighbours | unit | `npm run test:run -- tests/components/home-rank-widget.test.tsx` | ❌ Wave 0 |
| UI-04 | Prediction card renders with home-team primary_color left border | unit | `npm run test:run -- tests/components/prediction-card.test.tsx` | ❌ Wave 0 |
| UI-05 | /how-it-works renders all anchor sections | integration (RSC tree walk — Phase 10 idiom) | `npm run test:run -- tests/app/how-it-works.test.tsx` | ❌ Wave 0 |
| DATA-02 | archiveSeason sets seasons.ended_at idempotently; defineNewSeason UPSERTs | unit (server action with admin client mock) | `npm run test:run -- tests/actions/season-rollover.test.ts` | ❌ Wave 0 |
| DATA-02 | Archive does not move data; cross-season queries filter by season | unit (stats aggregator test) | `npm run test:run -- tests/lib/profile-stats.test.ts` | ❌ Wave 0 |
| DATA-03 | aggregateSeasonStats returns correct totals for a season | unit (pure function) | `npm run test:run -- tests/lib/profile-stats.test.ts` | ❌ Wave 0 |
| DATA-03 | /members/[slug] renders current-season stats + prior-season history | integration (RSC tree walk) | `npm run test:run -- tests/app/member-profile.test.tsx` | ❌ Wave 0 |
| — | Slug helper correctness (edge cases: unicode, multi-space, leading/trailing) | unit | `npm run test:run -- tests/lib/slug.test.ts` | ❌ Wave 0 |
| — | MemberLink renders correct href | unit | `npm run test:run -- tests/components/member-link.test.tsx` | ❌ Wave 0 |
| — | WeeklyPointsChart renders path for given weeks | unit (SVG snapshot) | `npm run test:run -- tests/components/weekly-points-chart.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test:run -- <file>` for the specific file(s) touched (<15s)
- **Per wave merge:** `npm run test:run` (full suite, currently 536 tests — phase 11 expected to add ~30-50)
- **Phase gate:** Full suite green before `/gsd:verify-work`; manual QA §13 completed by George or Dave on real iPhone / Pixel

### Wave 0 Gaps
- [ ] `tests/components/team-badge.test.tsx` — team-badge primary_color prop, covers UI-01
- [ ] `tests/components/prediction-card.test.tsx` — home-team-colour border, covers UI-04
- [ ] `tests/components/home-rank-widget.test.tsx` — logged-in rank strip, covers UI-03
- [ ] `tests/components/member-link.test.tsx` — href correctness
- [ ] `tests/components/weekly-points-chart.test.tsx` — SVG shape assertion
- [ ] `tests/lib/slug.test.ts` — `toSlug()` edge cases
- [ ] `tests/lib/profile-stats.test.ts` — `aggregateSeasonStats()` pure function
- [ ] `tests/actions/season-rollover.test.ts` — archiveSeason, defineNewSeason, launchNewSeason idempotency
- [ ] `tests/app/how-it-works.test.tsx` — anchor sections present (RSC tree walk)
- [ ] `tests/app/member-profile.test.tsx` — /members/[slug] RSC
- [ ] `tests/app/end-of-season.test.tsx` — conditional render at `/`
- Manual QA §13 (mobile responsive audit checklist) — new section in `docs/FINAL_QA_CHECKLIST.md`

Framework install: none — Vitest + @testing-library/react already installed.

## Sources

### Primary (HIGH confidence) — project codebase (verified this session)
- `supabase/migrations/001-011_*.sql` — full migration history; confirmed no `tailwind.config.ts`, confirmed season columns present where documented
- `src/app/globals.css` — confirmed Tailwind v4 `@theme inline` pattern
- `package.json` — confirmed versions: next 16.2.3, react 19.2.4, tailwindcss v4, vitest 4.1.4, no charting lib, no image hosting
- `src/lib/supabase/types.ts` — confirmed `MemberRow`, `TeamRow`, `SeasonRow` shapes
- `src/app/(public)/standings/page.tsx` — existing landing
- `src/app/(member)/profile/page.tsx` — existing minimal profile to extend
- `src/components/fixtures/team-badge.tsx` — existing crest renderer
- `src/actions/admin/gameweeks.ts` — `requireAdmin()` + `revalidatePath()` precedent
- `.planning/STATE.md` — extensive decision log including "No DB triggers for LOS lifecycle", "Rollover is application-side only", "revalidatePath is per-path not recursive"
- `.planning/REQUIREMENTS.md` — 7 requirements (UI-01..05, DATA-02, DATA-03) mapped to this phase

### Secondary (MEDIUM confidence) — web search verified
- [Premier League Color Codes (teamcolorcodes.com)](https://teamcolorcodes.com/soccer/premier-league-color-codes/) — PL palette near-variant
- [Premier League Brand Color Palette (mobbin.com)](https://mobbin.com/colors/brand/premier-league) — confirmed closest official purple `#360D3A`, user-picked `#37003c` is a minor variant

### Tertiary (LOW confidence — flagged for validation)
- Exact per-team PL kit hex values — planner task must verify per-team from Wikipedia infobox at build time (20 × 1-minute lookups)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every tool already in package.json, every pattern already shipped in prior phases
- Architecture: HIGH — column versioning + pure stats + application-orchestration all have 2+ prior-phase precedents
- Pitfalls: HIGH for items 1-7 (drawn from STATE.md direct quotes); MEDIUM for item 8 (screenshots strategy — reasoned from constraints, not from precedent)
- Team colour values: LOW — must be verified per-team at migration-write time

**Research date:** 2026-04-12
**Valid until:** 2026-05-12 (stable stack, but Tailwind v4 is still evolving — re-verify if ship slips)
