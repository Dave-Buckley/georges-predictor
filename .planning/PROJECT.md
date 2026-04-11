# George's Premier League Predictor

## What This Is

A web application that automates George's long-running (~10+ years) Premier League score predictor competition. Currently run manually via WhatsApp with ~50 members, the tool replaces the manual workload of collecting predictions, calculating points, generating standings, and producing weekly reports — while maintaining a full paper trail George can fall back on if the site ever goes down.

## Core Value

Accurate, automated point calculation that removes all manual load from George while keeping him in full control of the competition.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Members sign up with email/password and submit score predictions for each gameweek
- [ ] Fixtures auto-loaded per gameweek with clear grouping (midweek vs weekend)
- [ ] Per-fixture lockout at kick-off — no submissions or edits after a match starts
- [ ] Predictions hidden from other members until all fixtures in the gameweek are complete (George can see all)
- [ ] Members can edit their predictions any time before kick-off
- [ ] Live match results pulled automatically from a free football API
- [ ] George can manually enter/override match results as a fallback
- [ ] Automatic point calculation: 10pts correct result, 30pts correct score
- [ ] Live point display — members see calculated points per prediction as results come in, with a total at the bottom
- [ ] Weekly bonus system — George sets the active bonus before the gameweek; members make their bonus pick during submission
- [ ] Golden Glory bonus handled separately (doubles points on chosen game: 20pts result, 60pts score)
- [ ] Bonus points only applied after George confirms
- [ ] Double Bubble weeks (GW10, GW20, GW30) — George toggles double points on
- [ ] H2H Steal detection — tool automatically identifies tied weekly winners and flags the steal for the following gameweek report
- [ ] Last One Standing competition — members pick a team to win each week; tool tracks eliminations and team usage history
- [ ] Pre-season predictions (top 4, 10th place, relegation, promoted sides + playoff winner) submitted before GW1
- [ ] Overall league table with running point totals
- [ ] Additional prizes tracked and surfaced in reports but only applied when George manually confirms
- [ ] Weekly PDF report for the group (standings, results, H2H steals, bonus outcomes)
- [ ] Detailed weekly spreadsheet export for George's records
- [ ] Email reports sent to George automatically after each gameweek completes
- [ ] Updated standings/report viewable on the site each week
- [ ] George admin panel — manage members, set bonuses, confirm prizes, override scores, toggle Double Bubble, approve additional prizes
- [ ] Mid-season import — load existing member standings and pre-season picks for current season
- [ ] Late joiner support — George can add new members mid-season with starting points
- [ ] Member profiles with historical records and total points across seasons
- [ ] Season reset — archive previous season data and start fresh
- [ ] Local backup tool — George can export all data so he can continue manually if the site goes down
- [ ] Scalable to 100 users on free-tier infrastructure

### Out of Scope

- WhatsApp integration / bot — members use the website, George updates WhatsApp manually
- Mobile app — web-first, responsive design for mobile browsers
- Payment collection — George handles fees outside the tool
- Real-time chat or messaging within the tool
- Push notifications — email only

## Context

- Competition has run 10+ years, currently ~48 active members
- Managed by George, with Dave (the builder) as backup admin
- Members are a casual group of friends — the tool must be simple and frictionless
- Currently everything runs through WhatsApp: fixtures posted, members reply with predictions, George calculates manually
- George's manual process is the bottleneck — he reviews every submission individually
- There are 38 Premier League gameweeks per season, with midweek fixtures adding complexity
- The bonus system rotates weekly with specific bonuses assigned to specific gameweeks
- Some bonuses (Golden Glory) modify the scoring formula; most are simple 20pt yes/no
- The paper trail is critical — George needs to be able to verify and continue manually at any point
- The tool is being built mid-season (2025/26) so must support importing existing data
- Current season standings have been provided with 48 members

## Constraints

- **Cost**: Zero ongoing costs — all hosting, database, API, and email must use free tiers
- **Scale**: Must support up to 100 members on free infrastructure
- **Reliability**: Full data export capability so George can run manually if site is unavailable
- **Simplicity**: Members are not technical — submission flow must be dead simple
- **Accuracy**: Point calculation must be 100% accurate — this is real money
- **Admin control**: George approves all bonus/prize awards — nothing auto-applied without confirmation
- **Data integrity**: Weekly PDF + spreadsheet as permanent record

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Web app over desktop app | Members submit directly, reduces George's workload most | — Pending |
| Local fallback tool alongside web app | George must never be stuck if site goes down | — Pending |
| Free football API for live results | Zero cost constraint; manual override as backup | — Pending |
| Email/password auth | Simplest for a casual group; free to implement | — Pending |
| George confirms all bonus/prize awards | Prevents errors; George stays in control | — Pending |
| Per-fixture lockout (not per-gameweek) | Rules require it — late submissions count for remaining fixtures only | — Pending |
| Predictions hidden until gameweek complete | Prevents copying; George can see all at any time | — Pending |

---
*Last updated: 2026-04-11 after initialization*
