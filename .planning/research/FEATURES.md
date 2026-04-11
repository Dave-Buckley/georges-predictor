# Feature Research

**Domain:** Private friends' football score predictor competition (~50-100 members)
**Researched:** 2026-04-11
**Confidence:** HIGH (requirements are validated from a 10+ year existing competition; domain knowledge from comparable platforms: Superbru, Sky Sports Super 6, BBC Score Predictor, Draft Kings pick'em)

## Feature Landscape

### Table Stakes (Users Expect These)

Features the members assume exist. Missing these = product feels broken compared to the WhatsApp process it replaces.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Email/password registration and login | Members need persistent accounts to track predictions and history | LOW | No OAuth needed; simple email + password is correct for this audience |
| Fixture list per gameweek | Members can't predict without knowing the matches | LOW | Pull from free football API (football-data.org); George can manually add/correct |
| Score prediction submission (home/away goals per match) | The core act — submit a prediction for each fixture | LOW | One form per gameweek, all fixtures on one screen |
| Per-fixture lockout at kick-off | Competition integrity — no late picks after a match starts | MEDIUM | Requires accurate kick-off times and server-side enforcement, not just client-side |
| Ability to edit predictions before lockout | Members expect this; WhatsApp allows re-sending corrections | LOW | Replace-in-place; only show the latest submission |
| Point calculation: correct result (10pts) and correct score (30pts) | The fundamental scoring rule the whole competition is built on | LOW | Deterministic logic once results are in; must be 100% accurate |
| Live points display as results arrive | Members want to see how they're doing mid-gameweek | MEDIUM | Requires polling/refresh or SSE; points calculate incrementally as results come in |
| Overall league table (running season totals) | Members check standings weekly — this is the scoreboard | LOW | Aggregate query; display after each gameweek settles |
| Gameweek standings (points that week only) | Members care about weekly performance, not just overall | LOW | Secondary view; compare weekly rank vs season rank |
| Results hidden from other members until gameweek complete | Competition integrity — prevents copying others' picks | MEDIUM | Enforce at data layer, not just UI; George exempt |
| George admin panel | Admin must manage the competition without touching a database | HIGH | Core admin actions: member management, score overrides, bonus settings, prize confirmation |
| Manual result override (George) | API failures happen; George must be able to enter/correct results | LOW | Simple form in admin; triggers recalculation |
| Member profile page | Members want to see their own prediction history and season record | MEDIUM | Personal history view, season stats, current rank |
| Season league table page | Public-to-members view of all standings, sortable | LOW | Standard leaderboard UI |
| Weekly report/summary viewable on site | Members expect to review the gameweek outcome after it closes | MEDIUM | Formatted summary: results, points earned, standings change, bonus outcomes |

### Differentiators (Competitive Advantage)

Features that make this better than the WhatsApp process and better than generic prediction platforms.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Rotating weekly bonus system (George-configurable) | Replicates the real competition's depth; generic platforms don't have this | HIGH | George sets the active bonus before each GW; members make their bonus pick as part of submission; bonus points held until George confirms |
| Golden Glory bonus (doubles points on one chosen fixture) | Unique mechanic — transforms a 30pt correct score into a 60pt windfall | MEDIUM | Separate pick from standard bonus; applies 2x multiplier to that fixture's points; must be handled as a special case in scoring |
| Double Bubble gameweeks (GW10, GW20, GW30) | High-stakes weeks create narrative and excitement | LOW | George toggles a flag per GW; all points doubled; must be clearly signalled to members before they submit |
| H2H Steal mechanic (tied weekly winner triggers steal next week) | Unique to this competition; adds inter-member drama | HIGH | Detect ties in weekly standings; flag the steal situation; surface it in the weekly report; carry it forward to the next gameweek for George to confirm |
| Last One Standing competition (team pick per week, team used = exhausted) | Secondary competition running in parallel adds retention and engagement | HIGH | Track each member's team usage history across the season; eliminate members who pick a losing team; surface survivors clearly; show remaining usable teams per member |
| Pre-season predictions (top 4, relegation, promoted sides, playoff winner) | Season-long engagement hook; members check back even when a gameweek is quiet | MEDIUM | One-time submission before GW1; scoring applied at season end; needs milestone tracking |
| Additional milestone prizes (tracked and surfaced, confirmed by George) | Keeps engagement beyond the main table — long streaks, perfect weeks, etc. | MEDIUM | Prize tracking logic + George confirmation step; surface in weekly report |
| Weekly PDF report emailed to George | Permanent record that mirrors the manual paper trail George has built over 10 years | HIGH | PDF generation (score breakdown, standings, H2H, bonus outcomes) + email delivery; runs automatically after GW settles |
| Detailed spreadsheet export per gameweek | George needs granular data he can open in Excel | MEDIUM | CSV/XLSX export with all member predictions, results, points per fixture, bonus outcomes |
| Full data export (all seasons, all members) | Zero lock-in; George can continue manually if the site ever goes down | MEDIUM | JSON or CSV dump of all data; available on demand from admin panel |
| Mid-season data import | Competition is already mid-season; must onboard without losing history | HIGH | CSV import for member standings, pre-season picks, existing season data; one-time but critical |
| Late joiner support (George adds mid-season with starting points) | Competition allows new members; handled manually today | LOW | Admin adds member + sets starting point balance; nothing automatic |
| Member historical records across seasons | Long-running competition (10+ years) — history is a feature, not just data | MEDIUM | Per-member season-by-season stats; overall hall of fame potential |
| Season archive and reset | Graceful end-of-season transition without data loss | MEDIUM | Archive current season, zero out running totals, preserve history |
| Team badge and Premier League visual branding | Elevates the product above a plain spreadsheet; members will share screenshots | MEDIUM | Source SVG/PNG badges; apply to fixture rows, Last One Standing tracker, reports |
| Midweek vs weekend fixture grouping | PL has distinct midweek rounds — members need to know which deadline applies | LOW | Simple date-based grouping logic; clear labelling in the submission UI |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| WhatsApp bot / integration | Replicates the existing workflow members know | Webhook complexity, phone number management, Meta API policy changes, adds a second submission surface that can desync with the web app | Keep WhatsApp as George's announcement channel; members use the web app only |
| Real-time live score ticker on the site | Feels exciting; members want match updates | Requires paid API tier or websocket infrastructure; free APIs have rate limits that make a live ticker unreliable; maintenance burden is high relative to value | Show calculated points updating per fixture as results are confirmed; don't try to replicate a live scores feed |
| Automated bonus/prize application | Saves George a step; feels efficient | Bonus rules have edge cases and George must be the arbiter — auto-applying creates disputes with real money at stake | Hold bonus/prize points in a pending state; George reviews and confirms with one click |
| Public sign-up (open registration) | Platform growth | This is a closed friends' competition; open registration creates spam, strangers, and management overhead | George adds members via admin; invite-only model |
| Mobile app (iOS/Android) | Members use phones primarily | Doubles build and maintenance cost; native app adds app store review cycles and push notification infrastructure | Responsive web app works in mobile browser; covers the use case without the overhead |
| Push notifications | Members want alerts for deadlines, results | Requires service workers or a native app; adds a permission request that casual users decline; email is sufficient for this group | Email notifications for deadline reminders and weekly report delivery; optionally in-app banners |
| In-app chat or messaging | Members want to discuss predictions | Replicates WhatsApp where the group already lives; adds moderation burden and real-time infrastructure | Keep social on WhatsApp; the web app is for data, not discussion |
| Automated payment collection | Natural fit for a money competition | Adds PCI compliance, payment processor accounts, and legal complexity; George already handles this outside the tool | Out of scope by design; George collects fees manually |
| Per-member public prediction visibility before lockout | Transparency feels fair | Directly enables copying — undermines competition integrity | Reveal all predictions simultaneously after the last match in the gameweek kicks off |
| Complex permissions tiers (moderator, captain, etc.) | Large competitions sometimes need this | This group has one admin (George) and Dave as backup; more roles add UI and logic complexity for zero benefit | Two roles only: Admin (George/Dave) and Member |

## Feature Dependencies

```
[Authentication / Member Accounts]
    └──requires──> [All member-facing features]

[Fixture Data (API or Manual)]
    └──requires──> [Prediction Submission]
                       └──requires──> [Per-fixture Lockout]
                                          └──requires──> [Kick-off Time Accuracy]
    └──requires──> [Live Points Display]
    └──requires──> [Weekly Report]

[Match Results (API or Manual Override)]
    └──requires──> [Point Calculation]
                       └──requires──> [League Table]
                       └──requires──> [Gameweek Standings]
                       └──requires──> [Bonus Calculation (pending George confirm)]
                                          └──requires──> [Weekly Bonus Config (admin)]
                                          └──requires──> [Golden Glory Pick]
                       └──requires──> [Weekly Report generation]

[Point Calculation]
    └──requires──> [H2H Steal Detection]
    └──requires──> [Double Bubble toggle (admin)]
    └──requires──> [Additional Prize Tracking]

[Last One Standing]
    └──requires──> [Authentication / Member Accounts]
    └──requires──> [Match Results]
    └──requires──> [Team Usage History per member]

[Pre-season Predictions]
    └──requires──> [Authentication / Member Accounts]
    └──enhances──> [League Table] (pre-season points applied at season end)

[Mid-season Import]
    └──requires──> [Authentication / Member Accounts]
    └──enables──> [League Table starting from correct baseline]

[Weekly PDF Report]
    └──requires──> [Point Calculation]
    └──requires──> [League Table]
    └──requires──> [Bonus Calculation]
    └──requires──> [H2H Steal Detection]
    └──requires──> [Email Delivery]

[Full Data Export]
    └──requires──> [All data models exist]

[Season Archive/Reset]
    └──requires──> [Full Data Export] (archive before reset)
```

### Dependency Notes

- **Per-fixture lockout requires kick-off time accuracy:** Incorrect kick-off times (especially when API doesn't update for postponements) will let members submit after a match starts. George's manual override is the safety valve.
- **Bonus calculation requires George confirmation:** Bonus picks must be stored before George confirms them. If auto-applied, disputes arise. The pending state is a hard dependency for the admin confirmation flow.
- **Mid-season import must precede any point calculation:** If standing baseline is wrong, every subsequent calculation is wrong. Import is a one-time but blocking step before the app goes live.
- **H2H Steal detection enhances Weekly Report:** The steal flag is surfaced in the report; the detection logic must run before report generation.
- **Last One Standing is an independent sub-competition:** It shares member accounts and match results but has no scoring overlap with the main predictor. Can be developed and deployed independently.
- **Golden Glory conflicts with standard bonus flow:** Golden Glory is a special-case bonus that modifies fixture-level scoring (not a flat addition). It needs its own calculation path, not a generic bonus handler.

## MVP Definition

### Launch With (v1)

The minimum needed to replace the WhatsApp process for GW predictions.

- [ ] Authentication (email/password register, login, logout) — identity is the foundation of everything
- [ ] Fixture list loaded per gameweek (API + manual entry fallback) — members can't predict without this
- [ ] Score prediction submission form with per-fixture lockout — the core action
- [ ] Edit predictions before lockout — members expect this; without it, mistakes become disputes
- [ ] Match result entry (API auto + George override) — needed to calculate anything
- [ ] Point calculation (correct result 10pts, correct score 30pts) — the competition's scoring contract
- [ ] Live points display per prediction as results arrive — immediate feedback loop
- [ ] Gameweek and season league tables — the scoreboard; members check this constantly
- [ ] Predictions hidden from others until gameweek complete — competition integrity
- [ ] George admin panel (result override, member management basics) — George must control the competition
- [ ] Mid-season data import (member standings baseline) — required because competition is already in progress
- [ ] Weekly bonus system (George sets active bonus, members pick, George confirms) — the real competition requires this from day one
- [ ] Golden Glory bonus handling — used in the real competition; must be correct from GW1
- [ ] Double Bubble toggle (GW10, GW20, GW30) — hard-coded weeks but George must be able to enable it
- [ ] Full data export (CSV/JSON) — George's safety net; must be present before go-live

### Add After Validation (v1.x)

Once the core prediction and scoring loop is confirmed accurate:

- [ ] Last One Standing competition — complete sub-competition with team usage tracking and elimination logic
- [ ] H2H Steal detection and weekly report surfacing — adds drama; needs stable scoring first
- [ ] Weekly PDF report auto-generated and emailed to George — high value but needs stable data; PDF generation is a build complexity spike
- [ ] Weekly spreadsheet export — complements PDF; lower complexity
- [ ] Pre-season predictions submission and tracking — timing-dependent; only needed before next season
- [ ] Additional milestone prize tracking — needs stable base scoring before layering prizes
- [ ] Member historical profiles (multi-season records) — nice to have once current season is running smoothly
- [ ] Team badges and full PL branding polish — visual layer on top of working data layer

### Future Consideration (v2+)

- [ ] Season archive/reset workflow — only needed at end of 2025/26 season; defer until close
- [ ] Late joiner admin flow (polished) — George can add manually in v1; polish the UX later
- [ ] Multi-season hall of fame / all-time records — 10 years of history is valuable but digitising it is a separate project

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Authentication | HIGH | LOW | P1 |
| Fixture loading (API + manual) | HIGH | LOW | P1 |
| Prediction submission + lockout | HIGH | MEDIUM | P1 |
| Point calculation (result + score) | HIGH | LOW | P1 |
| League table (season + weekly) | HIGH | LOW | P1 |
| Predictions hidden until GW complete | HIGH | MEDIUM | P1 |
| George admin panel (core) | HIGH | HIGH | P1 |
| Mid-season import | HIGH | HIGH | P1 |
| Weekly bonus system | HIGH | HIGH | P1 |
| Golden Glory bonus | HIGH | MEDIUM | P1 |
| Double Bubble toggle | HIGH | LOW | P1 |
| Full data export | HIGH | MEDIUM | P1 |
| Live points display | HIGH | MEDIUM | P1 |
| Last One Standing | HIGH | HIGH | P2 |
| H2H Steal detection | MEDIUM | MEDIUM | P2 |
| Weekly PDF report + email | HIGH | HIGH | P2 |
| Spreadsheet export | MEDIUM | MEDIUM | P2 |
| Pre-season predictions | MEDIUM | MEDIUM | P2 |
| Milestone prize tracking | MEDIUM | MEDIUM | P2 |
| Member historical profiles | MEDIUM | MEDIUM | P2 |
| PL branding / team badges | MEDIUM | MEDIUM | P2 |
| Season archive/reset | HIGH | MEDIUM | P3 |
| Multi-season hall of fame | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch (v1)
- P2: Should have, add when possible (v1.x)
- P3: Nice to have, future consideration (v2+)

## Competitor Feature Analysis

This is a private competition, not a public platform, so direct competitors are services that similar friend groups use instead. The relevant comparison is: what do these platforms offer, and what does this project do differently?

| Feature | Superbru | Sky Super 6 | BBC Score Predictor | George's Predictor |
|---------|----------|-------------|---------------------|-------------------|
| Exact score prediction | Yes | Yes (6 matches only) | Yes | Yes (all PL matches) |
| Custom scoring rules | No (fixed) | No (fixed) | No (fixed) | Yes — 10/30pt system, bonuses, Double Bubble |
| Admin-controlled bonuses | No | No | No | Yes — George controls all bonus application |
| Last One Standing | No | No | No | Yes — parallel sub-competition |
| Pre-season predictions | No | No | No | Yes — top 4, relegation etc. |
| Private closed group | Yes | No (public) | No (public) | Yes — invite-only by design |
| PDF report generation | No | No | No | Yes — weekly audit trail for George |
| Manual result override | No | No | No | Yes — George's safety net |
| Full data export | No | No | No | Yes — permanent paper trail |
| Mid-season import | No | No | No | Yes — supports existing competition mid-flight |
| Free infrastructure | — | — | — | Yes — zero cost constraint |

**Key insight:** No existing platform supports the combination of custom scoring rules, admin-controlled bonuses, a parallel Last One Standing competition, and a private group with a designated admin. The project's differentiators are not a nice-to-have — they are why generic platforms cannot replace the WhatsApp-based competition.

## Sources

- PROJECT.md — requirements validated from 10+ year running competition (primary source, HIGH confidence)
- Domain knowledge: Superbru, Sky Sports Super 6, BBC Score Predictor feature sets (training data, MEDIUM confidence — architecture and feature sets are well-known and stable)
- Domain knowledge: common pitfalls in prediction platform builds (training data, MEDIUM confidence)

---
*Feature research for: Private Premier League score predictor competition platform*
*Researched: 2026-04-11*
