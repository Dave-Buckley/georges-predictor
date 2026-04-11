# Roadmap: George's Premier League Predictor

## Overview

George's Predictor replaces a 10+ year manual WhatsApp process with a proper web application. The build proceeds in natural delivery layers: foundation and auth first (everything depends on it), then fixtures and predictions (the core member loop), then the scoring engine and admin controls, then competition-specific features (bonus system, Last One Standing, H2H, pre-season picks), then reports and export, and finally polish and long-term continuity. Mid-season import is treated as a launch-critical phase — real members can't register until existing standings are loaded.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Project scaffold, database schema, auth, George-approved registration, infrastructure setup
- [ ] **Phase 2: Fixture Layer** - Fixtures auto-loaded from API, timezone handling, per-fixture server-side lockout
- [ ] **Phase 3: Predictions** - Member prediction submission, editing, visibility gating via RLS
- [ ] **Phase 4: Scoring Engine** - Pure function scoring library, live results, manual override, point breakdown storage
- [ ] **Phase 5: Admin Panel** - George's control dashboard, overrides, bonus management, gameweek close
- [ ] **Phase 6: Bonus System** - Weekly bonuses, Golden Glory, Double Bubble, two-phase confirmation
- [ ] **Phase 7: Mid-Season Import** - Load existing standings and late joiners before members onboard (launch blocker)
- [ ] **Phase 8: Last One Standing & H2H** - LOS sub-competition, H2H steal detection and reporting
- [ ] **Phase 9: Pre-Season Predictions** - Pre-season submission, lockout, end-of-season scoring
- [ ] **Phase 10: Reports & Export** - Weekly PDF, XLSX, email delivery, on-site report page, full data export
- [ ] **Phase 11: Polish & Continuity** - Premier League branding, member profiles, season archive, mobile responsiveness

## Phase Details

### Phase 1: Foundation
**Goal**: The project infrastructure exists, the database schema is correct and complete, members can register, and George can approve them — the bedrock every other feature rests on.
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08, AUTH-09, ADMIN-01, ADMIN-06
**Success Criteria** (what must be TRUE):
  1. A member can sign up with email and password and receives a "pending approval" message
  2. George receives notification and can approve or reject the registration from an admin view
  3. There are separate admin and member login pages; George and Dave both have admin access
  4. George can submit his own predictions from the admin panel (he's both admin and player; Dave is admin-only)
  5. An approved member can log in, refresh the page, and remain logged in (session persists)
  4. A member can request a password reset and receive an email link that works
  5. The application is deployed on Vercel and the Supabase database does not pause due to inactivity
**Plans:** 4/5 plans executed
Plans:
- [ ] 01-01-PLAN.md — Project scaffold, Supabase clients, middleware, DB schema, RLS, keep-alive, test infra
- [ ] 01-02-PLAN.md — Member signup flow (magic link) and branded landing page
- [ ] 01-03-PLAN.md — Admin login, dashboard shell with sidebar, member management CRUD
- [ ] 01-04-PLAN.md — Member login (magic link), member dashboard with approval gating, test suite
- [ ] 01-05-PLAN.md — Vercel deployment, environment config, end-to-end verification

### Phase 2: Fixture Layer
**Goal**: Premier League fixtures are automatically loaded per gameweek, displayed with correct grouping and timezone, and the system enforces per-fixture lockout at kick-off server-side.
**Depends on**: Phase 1
**Requirements**: FIX-01, FIX-02, FIX-03, FIX-04, FIX-05
**Success Criteria** (what must be TRUE):
  1. Fixtures for the current gameweek appear automatically, grouped as midweek or weekend
  2. Kick-off times display correctly in UK time (BST in summer, GMT in winter) regardless of server timezone
  3. After a fixture's kick-off time passes, the server rejects any prediction submission for that fixture
  4. George can manually add, edit, or void a fixture from the admin panel
  5. A postponed fixture can be marked void or rescheduled without corrupting other gameweek data
**Plans:** 3 plans
Plans:
- [ ] 02-01-PLAN.md — DB schema (teams, gameweeks, fixtures, sync_log), API client, sync engine, timezone helpers, cron config
- [ ] 02-02-PLAN.md — Admin fixture management (add/edit/move server actions, gameweeks pages, sync status)
- [ ] 02-03-PLAN.md — Member fixture display (gameweek view, fixture cards, lockout UX, all-fixtures page, dashboard update)

### Phase 3: Predictions
**Goal**: Members can submit and edit their score predictions for open fixtures, and predictions are hidden from other members until the gameweek is fully complete.
**Depends on**: Phase 2
**Requirements**: PRED-01, PRED-02, PRED-03, PRED-04, PRED-05
**Success Criteria** (what must be TRUE):
  1. A member can submit home/away score predictions for all unlocked fixtures in a gameweek
  2. A member can change their prediction for any fixture up until that fixture's kick-off
  3. A member cannot see any other member's predictions until every fixture in the gameweek has a final result
  4. George can view all members' predictions for any fixture at any time
  5. A member who submits late can still predict remaining fixtures that have not yet kicked off
**Plans**: TBD

### Phase 4: Scoring Engine
**Goal**: Points are calculated automatically and accurately as results come in, the full calculation breakdown is stored, and members can see their running points in real time.
**Depends on**: Phase 3
**Requirements**: SCORE-01, SCORE-02, SCORE-03, SCORE-04, SCORE-05, SCORE-06
**Success Criteria** (what must be TRUE):
  1. Match results are pulled automatically from the football-data.org API after each fixture ends
  2. George can manually enter or override a result and trigger an immediate recalculation
  3. A correct result prediction awards exactly 10 points; a correct exact score awards exactly 30 points
  4. Each member's prediction page shows points earned per fixture updating live as results come in, with a gameweek total at the bottom
  5. The full calculation breakdown (result points, score points, bonus points, applied formula) is stored per prediction and auditable
**Plans**: TBD

### Phase 5: Admin Panel
**Goal**: George has a single dashboard to manage all competition operations — with full visibility into everything at all times. Approve members, override results, set gameweek bonuses, toggle Double Bubble, close gameweeks, and submit his own predictions.
**Depends on**: Phase 4
**Requirements**: ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05, ADMIN-07, ADMIN-08, ADMIN-09
**Success Criteria** (what must be TRUE):
  1. George can set the active bonus type for an upcoming gameweek before it opens
  2. George can confirm or reject individual bonus point awards after the gameweek closes
  3. George can override a match result and trigger score recalculation for all affected members
  4. George can toggle Double Bubble on or off for a specific gameweek
  5. George can manually close a gameweek (e.g., when a postponed fixture is voided) and the system finalises standings
  6. Additional prizes are surfaced in the admin view and only applied when George explicitly confirms them
**Plans**: TBD

### Phase 6: Bonus System
**Goal**: The weekly bonus system is fully operational — members pick which fixture their bonus applies to, George confirms before points are awarded, Golden Glory uses its separate formula, and Double Bubble doubles correctly.
**Depends on**: Phase 5
**Requirements**: BONUS-01, BONUS-02, BONUS-03, BONUS-04, BONUS-05, BONUS-06, BONUS-07
**Success Criteria** (what must be TRUE):
  1. Members see the active bonus for the gameweek and can select which fixture it applies to during prediction submission
  2. Standard bonuses award exactly 20 points when the member's chosen condition is met
  3. Golden Glory awards 20 points for a correct result and 60 points for a correct exact score on the chosen fixture (not the standard formula)
  4. Double Bubble doubles all points for the designated gameweeks (GW10, GW20, GW30) — verified by comparing pre- and post-toggle totals
  5. No bonus points appear in a member's total until George explicitly confirms them
  6. Members can see their points both before and after bonus application to verify the confirmation step
**Plans**: TBD

### Phase 7: Mid-Season Import
**Goal**: George can load all existing member standings, pre-season picks, and historical data for the current season so real members can register and continue without starting from zero.
**Depends on**: Phase 5
**Requirements**: DATA-01, DATA-05, ADMIN-08
**Success Criteria** (what must be TRUE):
  1. George can upload or paste existing member point totals and they appear correctly in the league table
  2. Existing pre-season picks are stored against each member's account and match George's records
  3. A late-joining member added by George mid-season starts with the correct custom point total George specifies
  4. After import, all 48 existing members appear in the standings with correct totals before any new gameweek plays
**Plans**: TBD

### Phase 8: Last One Standing & H2H
**Goal**: The Last One Standing sub-competition runs automatically alongside weekly predictions, and H2H steal situations are detected and flagged without manual work from George.
**Depends on**: Phase 6
**Requirements**: LOS-01, LOS-02, LOS-03, LOS-04, LOS-05, LOS-06, LOS-07, H2H-01, H2H-02, H2H-03
**Success Criteria** (what must be TRUE):
  1. Members can select one team to win as their LOS pick during weekly prediction submission
  2. Members who pick a losing or drawing team are automatically marked eliminated; winners progress
  3. The system prevents a member from picking a team they have already used in the current cycle
  4. George can view a table showing every member's LOS status, current pick, and full team usage history
  5. If a member misses a round without submitting, they are automatically eliminated
  6. When a LOS winner is found, the competition resets and all 20 teams become available again
  7. Tied weekly points leaders are automatically detected and flagged in the following week's report as an H2H steal
**Plans**: TBD

### Phase 9: Pre-Season Predictions
**Goal**: Members can submit pre-season predictions (top 4, 10th, relegation, promoted teams) before GW1, predictions lock automatically, and George can confirm end-of-season point awards.
**Depends on**: Phase 3
**Requirements**: PRE-01, PRE-02, PRE-03, PRE-04, PRE-05
**Success Criteria** (what must be TRUE):
  1. Members can submit top-4, 10th place, 3 relegated teams, 3 promoted teams, and playoff winner before GW1 opens
  2. Pre-season predictions lock automatically when GW1 begins — no further edits possible
  3. At season end, the system calculates 30 points per correct team and surfaces the results for George's confirmation
  4. George can confirm pre-season point awards and they are added to final season totals
  5. Pre-season predictions are included in George's exportable records
**Plans**: TBD

### Phase 10: Reports & Export
**Goal**: After each gameweek completes, a weekly PDF summary goes to all members, a detailed XLSX goes to George, and all data can be exported as a manual fallback.
**Depends on**: Phase 8
**Requirements**: RPT-01, RPT-02, RPT-03, RPT-04, RPT-05, RPT-06, RPT-07, DATA-04
**Success Criteria** (what must be TRUE):
  1. A weekly PDF summary (standings, results, H2H steals, bonus outcomes) is generated and emailed to George automatically when a gameweek closes
  2. Each member receives a personal PDF with their own points breakdown for the gameweek via email
  3. A detailed XLSX file is generated with all members, all scores, and all calculations for George's records
  4. The current standings and latest gameweek report are viewable on the website without logging in
  5. George can download a single export file containing all data in a format that lets him continue running the competition manually if the site goes down
**Plans**: TBD

### Phase 11: Polish & Continuity
**Goal**: The application looks and feels like a professional Premier League product, member profiles show historical data, and the season can be cleanly archived and reset.
**Depends on**: Phase 10
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, DATA-02, DATA-03
**Success Criteria** (what must be TRUE):
  1. The application displays team badges and Premier League branding throughout — it does not look like a generic web form
  2. All core flows (prediction submission, league table, gameweek results) work correctly on a mobile phone screen without horizontal scrolling
  3. The overall league table is prominently displayed and updates after each gameweek closes
  4. A member can view their historical points and prediction records across previous seasons
  5. A public "How It Works" page explains the competition rules, scoring, bonuses, LOS, and prizes
  6. George can archive the current season and start a new one without losing any historical data
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 4/5 | In Progress|  |
| 2. Fixture Layer | 0/3 | Not started | - |
| 3. Predictions | 0/TBD | Not started | - |
| 4. Scoring Engine | 0/TBD | Not started | - |
| 5. Admin Panel | 0/TBD | Not started | - |
| 6. Bonus System | 0/TBD | Not started | - |
| 7. Mid-Season Import | 0/TBD | Not started | - |
| 8. Last One Standing & H2H | 0/TBD | Not started | - |
| 9. Pre-Season Predictions | 0/TBD | Not started | - |
| 10. Reports & Export | 0/TBD | Not started | - |
| 11. Polish & Continuity | 0/TBD | Not started | - |

---
*Roadmap created: 2026-04-11*
*Last updated: 2026-04-11 — Phase 2 plans created (3 plans in 2 waves)*
