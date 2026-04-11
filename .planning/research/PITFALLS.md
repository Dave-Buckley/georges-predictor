# Pitfalls Research

**Domain:** Private real-money football score prediction competition platform
**Researched:** 2026-04-11
**Confidence:** HIGH (domain knowledge from football API ecosystems, prediction competition patterns, and real-money scoring systems; web search unavailable — flagged where external verification would strengthen claims)

---

## Critical Pitfalls

### Pitfall 1: Point Calculation Applied at Wrong Moment (Race Condition on Live Results)

**What goes wrong:**
Points are calculated the instant an API result lands, before the result has been confirmed final. A match in extra time, or with an API delivering a partial/incorrect final score, triggers scoring. Members see wrong points. If George has already shared standings, correcting it causes disputes in a real-money competition.

**Why it happens:**
Developers use "full-time" status from APIs without checking whether the score has been confirmed and stable. football-data.org and API-Football both emit status events (FT, AET, PEN) separately. A naive implementation scores on first FT event without waiting for API data to stabilise.

**How to avoid:**
- Never auto-calculate points from a single API poll. On FT status: wait for a second poll (5–10 minutes later) that confirms the same scoreline before committing points to the database.
- Store the raw API result separately from the computed points. Recomputing is always possible; a corrupted points ledger is not easily untangled.
- George's manual override is the authoritative source — if a manual entry exists, it takes precedence over any API value.
- Add an "unconfirmed" flag to results that have not yet passed the double-poll check. Display these as provisional in the UI.

**Warning signs:**
- Points for a match change after being displayed ("3-1 scored 30pts" becomes "2-1 scored 10pts")
- API response shows FT status but scoreline changes on next poll
- Members screenshot standings before gameweek is officially closed

**Phase to address:** Core scoring engine phase (earliest possible — point calculation must be auditable before any other feature is built on top of it)

---

### Pitfall 2: Per-Fixture Deadline Not Enforced Server-Side

**What goes wrong:**
The kickoff lockout is enforced only in the UI (hiding the form, disabling buttons). A user with basic technical knowledge can POST a prediction directly to the API endpoint after kickoff has passed. Since this is real money, a single successful late submission — even accidental — causes disputes George cannot easily resolve without an audit trail.

**Why it happens:**
The UI lockout is built first and appears to work during testing. Server-side validation is deferred as "we'll add it later." It never gets added because the feature looks done.

**How to avoid:**
- On every prediction submission endpoint: check `fixture.kickoff_time < now()` server-side. Reject with a clear error if kickoff has passed.
- Store the time of every submission attempt (including rejected ones) with a server timestamp, never client-supplied.
- The server timestamp must come from the server's clock, not the browser. Never trust `Date` from the request payload.
- Log all rejected late submissions — George needs to be able to show a member "your request arrived at 15:03:22, kickoff was 15:00:00."

**Warning signs:**
- Prediction form visible in browser dev tools after kickoff
- No server-side timestamp on submission records
- API endpoint accepts predictions without checking fixture state

**Phase to address:** Prediction submission phase (must be in place before any real members submit; cannot be retrofitted after launch without risk)

---

### Pitfall 3: Prediction Visibility Leak Before Gameweek Completes

**What goes wrong:**
Members can see each other's predictions before all fixtures finish, enabling copying on upcoming fixtures within the same gameweek. In a competition where 30pts for a correct score is a large swing, this is a material competitive advantage and will cause immediate trust breakdown if discovered.

**Why it happens:**
Developers build the "my predictions" view first, then extend it to a shared view. The visibility rule ("hidden until all fixtures complete") is added as a UI filter but the underlying API endpoint returns all predictions regardless. Anyone inspecting network requests can extract others' predictions.

**How to avoid:**
- The API endpoint for "other members' predictions" must enforce the visibility rule at the query level — never return rows where the gameweek is not yet complete.
- George's admin role is the only exception — implement via a separate admin endpoint, not a client-side `isAdmin` check that suppresses display.
- A gameweek is "complete" only when every fixture has a confirmed final result, including any postponed matches that have been replayed. Define this clearly in the data model.
- Write an automated test: as a regular member, request another member's predictions for an in-progress gameweek — expect a 403 or empty result, never the actual predictions.

**Warning signs:**
- "Show predictions" feature works by filtering the response in the frontend rather than the backend
- Admin visibility implemented by passing `?admin=true` in the URL
- No test coverage for the visibility boundary

**Phase to address:** Prediction submission + visibility phase (same phase as submission — these two rules are a paired pair of integrity constraints)

---

### Pitfall 4: Timezone Errors Causing Wrong Lockout Times

**What goes wrong:**
A Saturday 3pm kickoff is stored in the database as `15:00:00` without timezone context. In BST (British Summer Time, UTC+1), the API returns UTC kickoffs. The lockout fires at 2pm UK time (when it should fire at 3pm UK time) or at 4pm UK time (if the conversion is inverted). Members get locked out an hour early or an hour late. In the late case, predictions submitted after kickoff become valid — a real-money integrity issue.

**Why it happens:**
- football-data.org returns UTC timestamps. API-Football returns UTC by default. Developers store them without normalising and display them without converting.
- The UK observes BST from late March to late October — this covers roughly half the Premier League season. The clocks change during the season, so a working lockout in December breaks in April.
- JavaScript `new Date()` in the browser uses the local machine's timezone. Server-side Node.js also respects the system timezone unless explicitly set to UTC.

**How to avoid:**
- Store ALL datetimes as UTC in the database. No exceptions. Use `timestamptz` in PostgreSQL or a UTC-forced column in SQLite.
- Display times converted to Europe/London using a proper timezone library (date-fns-tz or Luxon), never manual `+1` offsets.
- Server-side lockout check: compare UTC kickoff vs `Date.now()` (which is always UTC in Node) — no timezone conversion needed at enforcement time.
- Add a test fixture for a BST-period kickoff and a GMT-period kickoff to verify display and lockout behaviour both work correctly.

**Warning signs:**
- Kickoff times displayed as raw UTC without conversion
- A `+01:00` hardcoded anywhere in the codebase
- No test covering the BST/GMT boundary
- Lockout times appear wrong to UK users in summer months

**Phase to address:** Fixture loading and lockout phase — must be correct from day one; cannot be patched after real submissions are stored against wrong times

---

### Pitfall 5: Free Football API Rate Limits and Reliability Causing Silent Failures

**What goes wrong:**
Free tier APIs (football-data.org free plan: 10 calls/minute; API-Football free: 100 calls/day) are exhausted during a busy Saturday afternoon of polling for live results. The application silently stops updating results. Members see stale scores. George is unaware until someone messages the WhatsApp group asking why points haven't updated. Worse, if an error is swallowed, the system may mark a fixture as "no result" and skip point calculation entirely.

**Why it happens:**
- Polling is implemented with `setInterval` without tracking remaining quota.
- Errors from the API (429 Too Many Requests, 503) are caught and silenced to prevent UI crashes.
- No monitoring or alerting means George never knows the sync has stopped.

**How to avoid:**
- Implement a dedicated result-sync service that tracks the last successful fetch per fixture and respects explicit backoff on 429 responses.
- Log every API call result (success, failure, status code) to a persistent table George can inspect.
- Surface a visible "Last updated: X minutes ago" indicator in the admin panel — George will notice if it stops updating.
- Distinguish between "no result yet" and "API error — result unknown" in the database. Never auto-score a fixture with an API error result.
- Manual override must always be available and obvious to George — not buried in an admin menu.
- Design polling frequency to fit within free tier limits across a full gameweek: 10 live fixtures × polling every 5 min = 2 calls/min — within football-data.org's free tier.

**Warning signs:**
- API errors are caught with empty catch blocks
- No "last fetched" timestamp displayed anywhere in the admin UI
- Application polls all fixtures at the same interval regardless of whether they are live or not

**Phase to address:** API integration and result-sync phase — reliability must be proven before any scoring logic is wired to it

---

### Pitfall 6: Postponed or Rescheduled Match Handling

**What goes wrong:**
A fixture is postponed (common: weather, cup replays, European nights, COVID protocols historically). The member who predicted that fixture has their prediction locked in. The fixture gets replayed on a different date — sometimes weeks later. The system does not know what to do: does the old prediction count? Does it expire? Is that gameweek now perpetually "in progress"? If the gameweek cannot close, predictions for it remain hidden from all members indefinitely, and George cannot produce the weekly report.

**Why it happens:**
- The gameweek model assumes all fixtures complete within a few days. Postponement is treated as an edge case to handle "later."
- The API changes the fixture status to "PPD" (postponed) or reschedules to a new date. Applications that only poll for FT/AET status never process this.

**How to avoid:**
- Model fixture status explicitly: Scheduled, Live, FullTime, Postponed, Cancelled, Rescheduled. Store and display the current status.
- A gameweek is closeable when all non-postponed fixtures have results. Postponed fixtures within a gameweek should be flagged, and George should decide whether to: (a) close the gameweek excluding the postponed fixture, (b) wait for the replay, or (c) void the fixture.
- When a fixture is rescheduled to a new date, the existing prediction should remain valid but the lockout resets to the new kickoff time. The admin panel should surface this clearly.
- George must receive an alert (email) when a fixture status changes to PPD so he can communicate it to the WhatsApp group.
- Never let a postponed fixture silently block the entire gameweek report.

**Warning signs:**
- Fixture status never read or stored — only kickoff time and score
- No admin mechanism to void or reassign a fixture
- A gameweek with a PPD fixture cannot be closed
- Test suite has no postponed match scenario

**Phase to address:** Fixture management phase and admin tools phase — needs both API handling and George's control panel

---

### Pitfall 7: Bonus System Complexity Causing Silent Miscalculation

**What goes wrong:**
The bonus system has multiple variants (Golden Glory = score doubling, Double Bubble = gameweek doubling, standard 20pt bonuses, H2H Steal detection, pre-season predictions). Each interacts with base scoring differently. A naive implementation applies bonuses sequentially in whatever order code was written. Golden Glory + Double Bubble in the same gameweek produces 4× the base score — is that correct? If not, the order of operations must be explicitly defined. Incorrect bonus application on a high-stakes gameweek directly affects prize money.

**Why it happens:**
- Bonuses are implemented one at a time as features, each modifying a score variable. The interaction between bonuses is never formally specified.
- "George confirms bonuses" is interpreted as a UI approval button, not as a mathematical specification document.

**How to avoid:**
- Write an explicit scoring specification document (not in code — in plain language George approves) that defines: base points, each bonus type, interaction rules, and worked examples for edge cases (Golden Glory + Double Bubble, H2H Steal in a Double Bubble week).
- Implement scoring as a pure function: `calculatePoints(prediction, result, bonuses[]) => breakdown`. The breakdown shows each component separately. George can audit any score by seeing the calculation chain.
- Store the full calculation breakdown in the database, not just the final point total. This is the paper trail.
- Bonus application must be idempotent — applying a bonus twice produces the same result as applying it once.
- Unit test every bonus combination, including interaction cases. These tests are the specification.

**Warning signs:**
- Points are stored as a single integer with no breakdown of how they were reached
- "Apply bonus" mutates the stored points total directly
- No test for Golden Glory + Double Bubble interaction
- George cannot explain to a member exactly why they received a particular score

**Phase to address:** Scoring engine phase — specification and breakdown storage must precede any UI or admin feature that exposes scores

---

### Pitfall 8: Mid-Season Data Import Corrupting Live Season

**What goes wrong:**
The app is being built mid-season (2025/26) with 48 existing members and partial standings. Importing existing data risks: (a) duplicate members if the import creates new accounts that members later register separately with different emails, (b) wrong starting point totals that silently compound, (c) pre-season predictions that are not linked to the correct member accounts after they register. If a member disputes their running total mid-season and the import is the source of error, it is very hard to unwind.

**Why it happens:**
- Import is treated as a one-off data migration task done quickly. The mapping between "George's spreadsheet row" and "a registered member account" is assumed to be straightforward.
- Members register with email addresses that differ from what George has in his spreadsheet.
- The import does not include a verification step where George confirms each row is correctly matched before committing.

**How to avoid:**
- Treat the mid-season import as a first-class admin workflow, not a migration script. Build a dedicated import UI: George uploads/pastes standings, the system shows him the proposed import row-by-row, he confirms each, then commits.
- Create "ghost" accounts (name + imported points, no login) that get "claimed" when a member registers with a matching email or via a claim code George distributes.
- The import must be atomic — either all rows import successfully or none do. No partial imports that leave the database in a mixed state.
- After import, display the full standings to George for sign-off before any member can see them.
- Store a separate "imported_starting_points" column so the source of every member's current total is always auditable.

**Warning signs:**
- Import is a one-time script with no UI or confirmation step
- No mechanism to link an imported row to a registered account
- Starting points are added directly to the live running total with no separate column

**Phase to address:** Data import and member management phase (early — must be complete before any real member registers)

---

### Pitfall 9: "Gameweek Complete" Logic Is Ambiguous

**What goes wrong:**
The system uses "gameweek complete" to trigger three different things: unlock predictions for all members, allow George to generate the weekly report, and prevent further edits. If "complete" is defined differently in different parts of the code (e.g., "all fixtures have a result" in one place vs "admin has confirmed closure" in another), these three things fire at different times. Members see each other's predictions before George has confirmed the results. Or the report can be generated while a fixture is still disputed.

**Why it happens:**
- "Gameweek complete" feels like a simple boolean but is actually a state machine: Collecting → In Progress → Awaiting Confirmation → Closed. Each state transition has different rules and different user-visible effects.
- The state is computed on-the-fly from fixture statuses rather than stored explicitly, so different query paths reach different conclusions.

**How to avoid:**
- Model gameweek state explicitly as an enum stored in the database: `collecting | in_progress | pending_close | closed`. Never compute it from fixture statuses alone.
- George's "confirm and close" action is the only trigger for `pending_close → closed`. Predictions become visible at `closed`, not before.
- The weekly report can only be generated in `closed` state.
- Transition rules are enforced server-side, not in the UI.

**Warning signs:**
- Gameweek "completeness" is computed from a join across fixture statuses rather than from a dedicated status column
- Predictions become visible automatically without George's action
- Report generation is available before George confirms closure

**Phase to address:** Core data model phase — this state machine must be in the schema before any feature is built on top of it

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Client-side lockout only | Faster to build | Late submissions possible; real-money disputes | Never — server-side enforcement is non-negotiable |
| Single points column (no breakdown) | Simpler schema | Cannot audit or explain any score; bonus errors undetectable | Never — paper trail is a stated requirement |
| Compute gameweek state on the fly | No migration needed | Inconsistent behaviour across code paths; visibility bugs | Never — store it explicitly |
| Hardcode UTC offset as +1 | Quick fix | Breaks on DST change; wrong lockouts for half the season | Never — use proper timezone library |
| Poll API on a fixed interval without quota tracking | Simple implementation | API quota exhaustion; silent result staleness | MVP only if polling frequency is calculated to stay within free tier limits and manual override is always available |
| Soft-delete predictions (mark as late) | Easier to implement | Members can dispute what "counts"; ambiguous data | Never — reject late submissions outright and log the rejection |
| Email via SMTP without queue/retry | Quick to ship | Lost emails on provider downtime; no record of what was sent | Acceptable for MVP if email is non-critical; NOT acceptable for weekly report (George's primary record) |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| football-data.org free tier | Polling all fixtures every minute, hitting 10 req/min limit | Poll only live fixtures (status: IN_PLAY, HT) every 2–3 min; poll scheduled fixtures hourly |
| football-data.org / API-Football | Treating "FINISHED" status as final on first occurrence | Double-poll: confirm same scoreline on second request 5–10 min later before committing |
| football-data.org | Using team names from API directly in UI | Normalise to a local team table with canonical names and badge URLs; API names change format |
| football-data.org | Assuming gameweek numbers match across seasons | Premier League rounds are not consistently numbered; link by fixture date range + season, not by round number alone |
| API-Football free tier | Assuming 100 calls/day is enough for live polling on a Saturday | A full Saturday (10 fixtures, 5-min polling, 90 min each) = 10 × 18 × 10 = 1800 calls — far over free limit |
| Any free football API | No fallback when API is down | George's manual entry is the fallback — make it accessible on mobile, reachable in under 30 seconds |
| Email (Resend / SendGrid free) | Generating PDF report inline in the request | Generate report async in a background job; email delivery can take time and should not block the UI |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Recalculating all season points on every page load | Standings page slow; database hammered on Saturday afternoons | Cache calculated standings; invalidate only when a result is confirmed | ~20 members simultaneously loading results |
| Loading all predictions for all members to check visibility | Slow prediction fetch; potential data leak in response | Filter at query level: `WHERE gameweek.status = 'closed' OR member_id = current_user` | 50+ members, 10+ fixtures per gameweek |
| Generating PDF report synchronously in web request | Request timeout; George sees error instead of report | Queue PDF generation as background job; email when complete | Every time — PDF generation is always slow |
| N+1 queries for standings page (member → predictions → fixtures) | Standings page unusably slow | Eager load with joins; consider a denormalised standings table updated on result confirmation | ~10 concurrent users |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Admin check only in UI, not on API endpoints | Regular member can call admin endpoints (manual result entry, bonus application) directly | Every admin endpoint checks session role server-side; no trust in client-supplied role flags |
| Prediction visibility enforced only in UI | Member inspects network tab and reads other members' predictions before gameweek closes | API endpoint for predictions always filters by gameweek closed status; test with HTTP client not browser |
| Submission time from client | Member adjusts browser clock to submit "before" kickoff | Always use server timestamp for submission time; never trust client-supplied `submitted_at` |
| Predictable member IDs in URLs | Member can enumerate predictions for other members by changing ID in URL | Use opaque IDs (UUID or CUID) not sequential integers for member and prediction records |
| No rate limit on prediction submission | Member submits 1000 predictions in a loop to test lockout behaviour or cause load | Rate limit prediction endpoint per member per fixture; reject after first valid submission for that fixture (or allow edit until kickoff) |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No confirmation of saved prediction | Members unsure if their prediction was recorded; submit multiple times | Show an explicit "Saved" state per fixture, with the saved score displayed back to them |
| Showing all fixtures at once with no grouping | Members overwhelmed; miss fixtures in long scroll | Group by date/time band (Saturday 3pm, Tuesday 7:45pm); show kickoff time prominently |
| Lockout with no explanation | Member tries to edit, nothing happens, no error message | Show "Locked — kicked off at 3:00pm" per fixture after lockout, not just a disabled form |
| Points displayed without breakdown | Members cannot verify their own score; disputes escalate | Show per-fixture breakdown: base points + bonus label, not just a number |
| Late joiner sees same interface as full-season member | Confusing — why do I have no predictions for GW1? | Late joiners see a "You joined in GW[X]" message; no empty prediction rows for prior gameweeks |
| Bonus submission without confirming what the bonus is | Member selects bonus pick without understanding what it means this week | Display the active bonus description and its points value above the bonus selection field |

---

## "Looks Done But Isn't" Checklist

- [ ] **Per-fixture lockout:** Looks done in UI — verify that a direct POST to the prediction endpoint after kickoff returns an error response, not a 200
- [ ] **Prediction visibility:** Looks done in the members view — verify with a network request that the API endpoint returns no predictions for other members on an open gameweek
- [ ] **Point calculation:** Looks done in the standings table — verify the calculation breakdown is stored in the database, not just the total
- [ ] **BST/GMT handling:** Looks done with UTC storage — verify a Saturday 3pm fixture in April (BST) locks out at the correct UK time, not one hour early or late
- [ ] **Postponed fixture:** Looks done with "no action needed" — verify the gameweek can still be closed and a report generated when one fixture is PPD
- [ ] **Golden Glory bonus:** Looks done with bonus confirmation — verify that applying Golden Glory to a 1-0 correct score prediction gives 60pts (not 30pts or 40pts)
- [ ] **Double Bubble + Golden Glory:** Looks done because each bonus works individually — verify the interaction: correct score on Golden Glory game in a Double Bubble week gives 120pts (or document explicitly if it should not)
- [ ] **Manual result override:** Looks done because George can enter scores — verify that a manual entry overrides the API value and re-triggers point calculation for all predictions on that fixture
- [ ] **Mid-season import:** Looks done when records appear — verify that a member who registers after import can claim their imported record and their points are not double-counted
- [ ] **Email report:** Looks done because emails send in testing — verify the email sends after a real gameweek close and the PDF attachment is the complete report, not a blank or partial one

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Points calculated from wrong API result | HIGH — members may have screenshot standings | Re-run scoring from stored predictions + corrected result; generate diff report for George to share with group; stored breakdown makes diff clear |
| Late submission accepted (no server-side check) | HIGH — trust issue in real-money context | Audit log of submission timestamps allows George to show proof; add server-side check immediately; void or honour at George's discretion |
| Prediction visibility leak | HIGH — trust issue | Rotate API authentication if needed; add server-side filter; George communicates transparently to group |
| Timezone error causing wrong lockout | MEDIUM — affects one or two fixtures before detected | Correct stored kickoff times via admin override; recalculate affected submissions |
| API quota exhausted, results stale | LOW — George enters manually | Manual override path; add quota tracking and alerting to prevent recurrence |
| Mid-season import with wrong point totals | HIGH — affects prize money | Stored `imported_starting_points` column allows auditing back to source; George can export and verify against his spreadsheet |
| Gameweek stuck open due to postponed fixture | MEDIUM — report delayed | Admin UI to force-close gameweek with PPD fixtures marked as voided; George notifies group |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Race condition on live results | Core scoring engine | Test: same fixture, two API results with same score → points applied once; different score → points held pending |
| No server-side lockout | Prediction submission | Test: HTTP POST to prediction endpoint 1 minute after stored kickoff time → expect 400/403 |
| Prediction visibility leak | Prediction submission + visibility | Test: authenticated as member B, request member A's predictions on open gameweek → expect empty/403 |
| Timezone / BST error | Fixture loading and lockout | Test: fixture in April (BST) and December (GMT) both display and lock at correct UK local time |
| API rate limit / reliability | API integration and result sync | Test: mock API returning 429 → system does not score the fixture; Last Updated indicator updates correctly |
| Postponed fixture blocking gameweek | Fixture management and admin tools | Test: gameweek with one PPD fixture can be closed and report generated |
| Bonus miscalculation | Scoring engine (specification and unit tests) | Test: all bonus combinations including Golden Glory + Double Bubble produce expected totals matching George's agreed spec |
| Mid-season import data corruption | Data import and member management | Test: import → member registers → standings show correct combined total, no duplication |
| Ambiguous gameweek complete state | Core data model | Test: state transitions only via correct triggers; predictions not visible until `closed` state confirmed by George |

---

## Sources

- football-data.org API documentation and free tier limits (known from training data — HIGH confidence)
- API-Football free tier limits: 100 calls/day (HIGH confidence from documented limits)
- Premier League postponement patterns: COVID era, European competition calendar, weather (HIGH confidence — historical record)
- UK DST (BST) schedule: last Sunday March → last Sunday October (HIGH confidence — statutory)
- Prediction competition trust failure modes: derived from general real-money competition platform analysis (MEDIUM confidence — no single authoritative source; pattern matches known community platform failures)
- Bonus system interaction failures: derived from sports scoring platform post-mortems (MEDIUM confidence — pattern-based)
- Mid-season import failure modes: derived from general SaaS migration and community platform experience (MEDIUM confidence)

**Note:** WebSearch and Bash were unavailable during this research session. All findings are based on training data and domain knowledge. Confidence is HIGH for technical facts (API limits, DST rules, API status codes) and MEDIUM for pattern-based failure analysis. No external verification was possible — recommend spot-checking API-Football current free tier limits before committing to that provider.

---
*Pitfalls research for: Private real-money Premier League score prediction competition*
*Researched: 2026-04-11*
