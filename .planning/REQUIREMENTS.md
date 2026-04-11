# Requirements: George's Premier League Predictor

**Defined:** 2026-04-11
**Core Value:** Accurate, automated point calculation that removes all manual load from George while keeping him in full control of the competition.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication & Members

- [x] **AUTH-01**: User can sign up with email and password
- [x] **AUTH-02**: George must approve each registration before member can access the tool (invite-only)
- [x] **AUTH-03**: User session persists across browser refresh
- [x] **AUTH-04**: User can reset password via email link
- [x] **AUTH-05**: George can add new members manually (late joiners) with starting points
- [x] **AUTH-06**: Two admin accounts — George (primary) and Dave (backup) — both with full admin access
- [x] **AUTH-07**: Separate admin login page and member login page
- [x] **AUTH-08**: George can submit his own predictions from the admin panel — he is both admin and participant (Dave is admin-only, not a participant)
- [x] **AUTH-09**: During signup, member either selects their name from the existing imported list (to link to their standings) or enters a new name with a note saying username should reflect their WhatsApp name

### Fixtures & Gameweeks

- [x] **FIX-01**: Premier League fixtures auto-loaded from football-data.org API per gameweek
- [x] **FIX-02**: Fixtures clearly grouped by gameweek with midweek vs weekend distinction
- [x] **FIX-03**: Per-fixture lockout at kick-off time — server-enforced, no submissions or edits after kick-off
- [x] **FIX-04**: Postponed/rescheduled matches handled explicitly (George can void or reassign)
- [x] **FIX-05**: George can manually add, edit, or correct fixtures as fallback

### Predictions

- [x] **PRED-01**: Member can submit score predictions (home/away goals) for all fixtures in a gameweek
- [x] **PRED-02**: Member can edit predictions any time before that fixture's kick-off
- [x] **PRED-03**: Predictions hidden from all other members until all fixtures in the gameweek are complete
- [x] **PRED-04**: George can view all members' predictions at any time
- [x] **PRED-05**: Late submissions accepted for remaining un-kicked-off fixtures only

### Scoring & Results

- [x] **SCORE-01**: Match results auto-pulled from football-data.org API
- [x] **SCORE-02**: George can manually enter or override match results
- [x] **SCORE-03**: Automatic point calculation — 10pts correct result, 30pts correct score (total)
- [x] **SCORE-04**: Live points display per prediction as results come in, with gameweek total at bottom
- [x] **SCORE-05**: Full calculation breakdown stored per prediction (not just final totals)
- [x] **SCORE-06**: Members see calculated points for each score as predictions are entered (once results are in)

### Bonus System

- [ ] **BONUS-01**: George sets the active bonus type before each gameweek commences
- [ ] **BONUS-02**: Members make their bonus pick during prediction submission (which game the bonus applies to)
- [ ] **BONUS-03**: Standard bonuses award 20pts if the chosen condition is met
- [ ] **BONUS-04**: Golden Glory bonus uses separate scoring formula — 20pts correct result, 60pts correct score on chosen game
- [ ] **BONUS-05**: Double Bubble — George toggles double points for designated gameweeks (GW10, GW20, GW30)
- [ ] **BONUS-06**: Two-phase confirmation — member picks bonus, George confirms before points are applied
- [ ] **BONUS-07**: Points shown before and after bonus application

### H2H Steals

- [ ] **H2H-01**: Tool automatically detects tied weekly winners
- [ ] **H2H-02**: H2H steals flagged in the gameweek report for the following week
- [ ] **H2H-03**: H2H steal resolved in following gameweek — highest scorer between tied players wins

### Last One Standing

- [ ] **LOS-01**: Members pick one team to win each week alongside their predictions
- [ ] **LOS-02**: If the team wins, member progresses; draw or loss = eliminated
- [ ] **LOS-03**: Once a team is picked, it cannot be picked again until all 20 PL teams have been used
- [ ] **LOS-04**: Tool tracks each member's elimination status and team usage history
- [ ] **LOS-05**: If member misses a round without submitting, they are eliminated
- [ ] **LOS-06**: When a winner is found, competition resets and all teams become available again
- [ ] **LOS-07**: George can view and manage LOS status for all members

### Pre-Season Predictions

- [ ] **PRE-01**: Members submit pre-season predictions — top 4, 10th place, 3 relegated, 3 promoted + playoff winner
- [ ] **PRE-02**: Pre-season predictions locked before GW1
- [ ] **PRE-03**: Pre-season points calculated at season end — 30pts per correct team, bonuses for all correct
- [ ] **PRE-04**: George confirms pre-season point awards
- [ ] **PRE-05**: Pre-season predictions logged in exportable format for George's records

### Admin Panel

- [x] **ADMIN-01**: George can approve or reject member registrations
- [x] **ADMIN-02**: George can set the active bonus for each gameweek before it starts
- [x] **ADMIN-03**: George can confirm or reject bonus point awards after gameweek
- [x] **ADMIN-04**: George can override match results and trigger score recalculation
- [x] **ADMIN-05**: George can toggle Double Bubble for specific gameweeks
- [x] **ADMIN-06**: George can manage members — add, remove, set starting points
- [x] **ADMIN-07**: Additional prizes tracked and surfaced in reports — only applied when George confirms
- [ ] **ADMIN-08**: George can import mid-season data (existing standings, pre-season picks)
- [x] **ADMIN-09**: George can close a gameweek manually (e.g., when postponed fixtures are voided)

### Reports & Export

- [ ] **RPT-01**: Weekly PDF summary report for the group — standings, results, H2H steals, bonus outcomes
- [ ] **RPT-02**: Personal weekly PDF sent to each member — their own points breakdown for the gameweek
- [ ] **RPT-03**: Detailed weekly XLSX spreadsheet for George's records (all members, all scores, all calculations)
- [ ] **RPT-04**: Reports emailed to George automatically after each gameweek completes
- [ ] **RPT-05**: Personal PDF emailed to each member after gameweek completes
- [ ] **RPT-06**: Updated standings and gameweek report viewable on the website
- [ ] **RPT-07**: Full data export — George can download all data to continue manually if site goes down

### Data & Continuity

- [ ] **DATA-01**: Mid-season import tool — load existing member names and points; league table always sorted by points descending (positions derived, not stored)
- [ ] **DATA-02**: Season archive — previous season data stored with historical records
- [ ] **DATA-03**: Member profiles with total points and history across seasons
- [ ] **DATA-04**: Local fallback — George can export everything needed to run manually
- [ ] **DATA-05**: Late joiner support — George adds members mid-season with custom starting points

### UI & Branding

- [ ] **UI-01**: Polished Premier League visual design with team badges and photos
- [ ] **UI-02**: Mobile-responsive design — works well on phones (most members will use mobile)
- [ ] **UI-03**: Overall league table prominently displayed
- [ ] **UI-04**: Clean prediction submission form — all fixtures visible, easy score entry
- [ ] **UI-05**: Public "How It Works" page explaining competition rules, scoring system, bonuses, LOS, and prizes

### Infrastructure

- [x] **INFRA-01**: Zero ongoing costs — all hosting, database, API, and email on free tiers
- [x] **INFRA-02**: Scalable to 100 members on free-tier infrastructure
- [x] **INFRA-03**: Supabase keep-alive mechanism to prevent free-tier database pausing

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Analytics

- **ANLYT-01**: Historical cross-season analytics (best predictors, scoring trends)
- **ANLYT-02**: Member vs member comparison tools
- **ANLYT-03**: Advanced statistics dashboard (prediction accuracy %, best/worst fixtures)

### Social

- **SOC-01**: Prediction leaderboard animations / celebrations
- **SOC-02**: Weekly "awards" (best predictor, worst week, most improved)

## Out of Scope

| Feature | Reason |
|---------|--------|
| WhatsApp bot / integration | Members use the website; George updates WhatsApp manually |
| Mobile app | Web-first with responsive design; native app adds complexity with no benefit |
| Payment collection | George handles fees outside the tool via bank transfer |
| In-app chat or messaging | WhatsApp group serves this purpose |
| Push notifications | Email only; members check the site or WhatsApp |
| Real-time live scores (WebSocket streaming) | Polling interval sufficient; real-time adds complexity |
| OAuth / social login | Email/password is simpler for this casual group |
| Open registration | Invite-only; George approves every member |
| Auto-applied bonuses | George must confirm all bonus/prize awards manually |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Complete |
| AUTH-05 | Phase 1 | Complete |
| AUTH-06 | Phase 1 | Complete |
| AUTH-07 | Phase 1 | Complete |
| AUTH-08 | Phase 1 | Complete |
| AUTH-09 | Phase 1 | Complete |
| FIX-01 | Phase 2 | Complete |
| FIX-02 | Phase 2 | Complete |
| FIX-03 | Phase 2 | Complete |
| FIX-04 | Phase 2 | Complete |
| FIX-05 | Phase 2 | Complete |
| PRED-01 | Phase 3 | Complete |
| PRED-02 | Phase 3 | Complete |
| PRED-03 | Phase 3 | Complete |
| PRED-04 | Phase 3 | Complete |
| PRED-05 | Phase 3 | Complete |
| SCORE-01 | Phase 4 | Complete |
| SCORE-02 | Phase 4 | Complete |
| SCORE-03 | Phase 4 | Complete |
| SCORE-04 | Phase 4 | Complete |
| SCORE-05 | Phase 4 | Complete |
| SCORE-06 | Phase 4 | Complete |
| BONUS-01 | Phase 6 | Pending |
| BONUS-02 | Phase 6 | Pending |
| BONUS-03 | Phase 6 | Pending |
| BONUS-04 | Phase 6 | Pending |
| BONUS-05 | Phase 6 | Pending |
| BONUS-06 | Phase 6 | Pending |
| BONUS-07 | Phase 6 | Pending |
| H2H-01 | Phase 8 | Pending |
| H2H-02 | Phase 8 | Pending |
| H2H-03 | Phase 8 | Pending |
| LOS-01 | Phase 8 | Pending |
| LOS-02 | Phase 8 | Pending |
| LOS-03 | Phase 8 | Pending |
| LOS-04 | Phase 8 | Pending |
| LOS-05 | Phase 8 | Pending |
| LOS-06 | Phase 8 | Pending |
| LOS-07 | Phase 8 | Pending |
| PRE-01 | Phase 9 | Pending |
| PRE-02 | Phase 9 | Pending |
| PRE-03 | Phase 9 | Pending |
| PRE-04 | Phase 9 | Pending |
| PRE-05 | Phase 9 | Pending |
| ADMIN-01 | Phase 1 | Complete |
| ADMIN-02 | Phase 5 | Complete |
| ADMIN-03 | Phase 5 | Complete |
| ADMIN-04 | Phase 5 | Complete |
| ADMIN-05 | Phase 5 | Complete |
| ADMIN-06 | Phase 1 | Complete |
| ADMIN-07 | Phase 5 | Complete |
| ADMIN-08 | Phase 7 | Pending |
| ADMIN-09 | Phase 5 | Complete |
| RPT-01 | Phase 10 | Pending |
| RPT-02 | Phase 10 | Pending |
| RPT-03 | Phase 10 | Pending |
| RPT-04 | Phase 10 | Pending |
| RPT-05 | Phase 10 | Pending |
| RPT-06 | Phase 10 | Pending |
| RPT-07 | Phase 10 | Pending |
| DATA-01 | Phase 7 | Pending |
| DATA-02 | Phase 11 | Pending |
| DATA-03 | Phase 11 | Pending |
| DATA-04 | Phase 10 | Pending |
| DATA-05 | Phase 7 | Pending |
| UI-01 | Phase 11 | Pending |
| UI-02 | Phase 11 | Pending |
| UI-03 | Phase 11 | Pending |
| UI-04 | Phase 11 | Pending |
| UI-05 | Phase 11 | Pending |
| INFRA-01 | Phase 1 | Complete |
| INFRA-02 | Phase 1 | Complete |
| INFRA-03 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 75 total
- Mapped to phases: 75
- Unmapped: 0

**Phase Distribution:**
| Phase | Requirements |
|-------|-------------|
| Phase 1: Foundation | AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08, ADMIN-01, ADMIN-06, INFRA-01, INFRA-02, INFRA-03 |
| Phase 2: Fixture Layer | FIX-01, FIX-02, FIX-03, FIX-04, FIX-05 |
| Phase 3: Predictions | PRED-01, PRED-02, PRED-03, PRED-04, PRED-05 |
| Phase 4: Scoring Engine | SCORE-01, SCORE-02, SCORE-03, SCORE-04, SCORE-05, SCORE-06 |
| Phase 5: Admin Panel | ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05, ADMIN-07, ADMIN-09 |
| Phase 6: Bonus System | BONUS-01, BONUS-02, BONUS-03, BONUS-04, BONUS-05, BONUS-06, BONUS-07 |
| Phase 7: Mid-Season Import | DATA-01, DATA-05, ADMIN-08 |
| Phase 8: Last One Standing & H2H | LOS-01, LOS-02, LOS-03, LOS-04, LOS-05, LOS-06, LOS-07, H2H-01, H2H-02, H2H-03 |
| Phase 9: Pre-Season Predictions | PRE-01, PRE-02, PRE-03, PRE-04, PRE-05 |
| Phase 10: Reports & Export | RPT-01, RPT-02, RPT-03, RPT-04, RPT-05, RPT-06, RPT-07, DATA-04 |
| Phase 11: Polish & Continuity | UI-01, UI-02, UI-03, UI-04, UI-05, DATA-02, DATA-03 |

---
*Requirements defined: 2026-04-11*
*Last updated: 2026-04-11 — traceability populated after roadmap creation*
