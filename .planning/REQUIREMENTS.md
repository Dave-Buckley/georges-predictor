# Requirements: George's Premier League Predictor

**Defined:** 2026-04-11
**Core Value:** Accurate, automated point calculation that removes all manual load from George while keeping him in full control of the competition.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication & Members

- [ ] **AUTH-01**: User can sign up with email and password
- [ ] **AUTH-02**: George must approve each registration before member can access the tool (invite-only)
- [ ] **AUTH-03**: User session persists across browser refresh
- [ ] **AUTH-04**: User can reset password via email link
- [ ] **AUTH-05**: George can add new members manually (late joiners) with starting points

### Fixtures & Gameweeks

- [ ] **FIX-01**: Premier League fixtures auto-loaded from football-data.org API per gameweek
- [ ] **FIX-02**: Fixtures clearly grouped by gameweek with midweek vs weekend distinction
- [ ] **FIX-03**: Per-fixture lockout at kick-off time — server-enforced, no submissions or edits after kick-off
- [ ] **FIX-04**: Postponed/rescheduled matches handled explicitly (George can void or reassign)
- [ ] **FIX-05**: George can manually add, edit, or correct fixtures as fallback

### Predictions

- [ ] **PRED-01**: Member can submit score predictions (home/away goals) for all fixtures in a gameweek
- [ ] **PRED-02**: Member can edit predictions any time before that fixture's kick-off
- [ ] **PRED-03**: Predictions hidden from all other members until all fixtures in the gameweek are complete
- [ ] **PRED-04**: George can view all members' predictions at any time
- [ ] **PRED-05**: Late submissions accepted for remaining un-kicked-off fixtures only

### Scoring & Results

- [ ] **SCORE-01**: Match results auto-pulled from football-data.org API
- [ ] **SCORE-02**: George can manually enter or override match results
- [ ] **SCORE-03**: Automatic point calculation — 10pts correct result, 30pts correct score (total)
- [ ] **SCORE-04**: Live points display per prediction as results come in, with gameweek total at bottom
- [ ] **SCORE-05**: Full calculation breakdown stored per prediction (not just final totals)
- [ ] **SCORE-06**: Members see calculated points for each score as predictions are entered (once results are in)

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

- [ ] **ADMIN-01**: George can approve or reject member registrations
- [ ] **ADMIN-02**: George can set the active bonus for each gameweek before it starts
- [ ] **ADMIN-03**: George can confirm or reject bonus point awards after gameweek
- [ ] **ADMIN-04**: George can override match results and trigger score recalculation
- [ ] **ADMIN-05**: George can toggle Double Bubble for specific gameweeks
- [ ] **ADMIN-06**: George can manage members — add, remove, set starting points
- [ ] **ADMIN-07**: Additional prizes tracked and surfaced in reports — only applied when George confirms
- [ ] **ADMIN-08**: George can import mid-season data (existing standings, pre-season picks)
- [ ] **ADMIN-09**: George can close a gameweek manually (e.g., when postponed fixtures are voided)

### Reports & Export

- [ ] **RPT-01**: Weekly PDF summary report for the group — standings, results, H2H steals, bonus outcomes
- [ ] **RPT-02**: Personal weekly PDF sent to each member — their own points breakdown for the gameweek
- [ ] **RPT-03**: Detailed weekly XLSX spreadsheet for George's records (all members, all scores, all calculations)
- [ ] **RPT-04**: Reports emailed to George automatically after each gameweek completes
- [ ] **RPT-05**: Personal PDF emailed to each member after gameweek completes
- [ ] **RPT-06**: Updated standings and gameweek report viewable on the website
- [ ] **RPT-07**: Full data export — George can download all data to continue manually if site goes down

### Data & Continuity

- [ ] **DATA-01**: Mid-season import tool — load existing member standings and pre-season picks
- [ ] **DATA-02**: Season archive — previous season data stored with historical records
- [ ] **DATA-03**: Member profiles with total points and history across seasons
- [ ] **DATA-04**: Local fallback — George can export everything needed to run manually
- [ ] **DATA-05**: Late joiner support — George adds members mid-season with custom starting points

### UI & Branding

- [ ] **UI-01**: Polished Premier League visual design with team badges and photos
- [ ] **UI-02**: Mobile-responsive design — works well on phones (most members will use mobile)
- [ ] **UI-03**: Overall league table prominently displayed
- [ ] **UI-04**: Clean prediction submission form — all fixtures visible, easy score entry

### Infrastructure

- [ ] **INFRA-01**: Zero ongoing costs — all hosting, database, API, and email on free tiers
- [ ] **INFRA-02**: Scalable to 100 members on free-tier infrastructure
- [ ] **INFRA-03**: Supabase keep-alive mechanism to prevent free-tier database pausing

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
| AUTH-01 | — | Pending |
| AUTH-02 | — | Pending |
| AUTH-03 | — | Pending |
| AUTH-04 | — | Pending |
| AUTH-05 | — | Pending |
| FIX-01 | — | Pending |
| FIX-02 | — | Pending |
| FIX-03 | — | Pending |
| FIX-04 | — | Pending |
| FIX-05 | — | Pending |
| PRED-01 | — | Pending |
| PRED-02 | — | Pending |
| PRED-03 | — | Pending |
| PRED-04 | — | Pending |
| PRED-05 | — | Pending |
| SCORE-01 | — | Pending |
| SCORE-02 | — | Pending |
| SCORE-03 | — | Pending |
| SCORE-04 | — | Pending |
| SCORE-05 | — | Pending |
| SCORE-06 | — | Pending |
| BONUS-01 | — | Pending |
| BONUS-02 | — | Pending |
| BONUS-03 | — | Pending |
| BONUS-04 | — | Pending |
| BONUS-05 | — | Pending |
| BONUS-06 | — | Pending |
| BONUS-07 | — | Pending |
| H2H-01 | — | Pending |
| H2H-02 | — | Pending |
| H2H-03 | — | Pending |
| LOS-01 | — | Pending |
| LOS-02 | — | Pending |
| LOS-03 | — | Pending |
| LOS-04 | — | Pending |
| LOS-05 | — | Pending |
| LOS-06 | — | Pending |
| LOS-07 | — | Pending |
| PRE-01 | — | Pending |
| PRE-02 | — | Pending |
| PRE-03 | — | Pending |
| PRE-04 | — | Pending |
| PRE-05 | — | Pending |
| ADMIN-01 | — | Pending |
| ADMIN-02 | — | Pending |
| ADMIN-03 | — | Pending |
| ADMIN-04 | — | Pending |
| ADMIN-05 | — | Pending |
| ADMIN-06 | — | Pending |
| ADMIN-07 | — | Pending |
| ADMIN-08 | — | Pending |
| ADMIN-09 | — | Pending |
| RPT-01 | — | Pending |
| RPT-02 | — | Pending |
| RPT-03 | — | Pending |
| RPT-04 | — | Pending |
| RPT-05 | — | Pending |
| RPT-06 | — | Pending |
| RPT-07 | — | Pending |
| DATA-01 | — | Pending |
| DATA-02 | — | Pending |
| DATA-03 | — | Pending |
| DATA-04 | — | Pending |
| DATA-05 | — | Pending |
| UI-01 | — | Pending |
| UI-02 | — | Pending |
| UI-03 | — | Pending |
| UI-04 | — | Pending |
| INFRA-01 | — | Pending |
| INFRA-02 | — | Pending |
| INFRA-03 | — | Pending |

**Coverage:**
- v1 requirements: 63 total
- Mapped to phases: 0
- Unmapped: 63 ⚠️

---
*Requirements defined: 2026-04-11*
*Last updated: 2026-04-11 after initial definition*
