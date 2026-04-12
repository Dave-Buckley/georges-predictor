# George's Predictor — Final QA Checklist

Use this once every phase is built. Walk through each section with `npm run dev` running (and a separate prod deploy check at the end). Tick each box as you go. Anything that doesn't work → note the symptom in a bug log and come back to it.

**Two accounts you'll need for testing:**
- George (admin + participant)
- Dave (admin only — no predictions)
- A test member (regular player — use a disposable email or one of your own)

**Pro tip:** Use Chrome DevTools' phone emulation (iPhone 13 + Pixel 5) for mobile checks. Real phone check comes at the very end.

---

## 1. Sign up, login, approval

- [ ] Visit `/signup` → fill in email + password + pick a name from the existing member list
- [ ] Account created but blocked until George approves
- [ ] Log in as George → `/admin/approvals` shows the pending signup
- [ ] Approve → member gets in
- [ ] Reject another test signup → member can't log in
- [ ] `/admin` and `/` redirect correctly based on role (admin vs member)
- [ ] Reset password via "forgot password" email link → works end to end
- [ ] Dave can log in and reach admin panel but can't submit predictions (he's admin-only)
- [ ] George can log in and submit his OWN predictions (admin + participant)

---

## 2. Fixtures

- [ ] `/admin/fixtures` shows the current season's PL fixtures grouped by gameweek
- [ ] Midweek vs weekend fixtures visually distinct
- [ ] Team badges all load (no broken images)
- [ ] Kickoff times show in UK time (GMT or BST correctly)
- [ ] Hit "Sync fixtures" → pulls latest from football-data.org without errors
- [ ] Edit a fixture's kickoff time (admin override) → saves
- [ ] Mark a fixture as postponed → member sees it as postponed
- [ ] Manually add a one-off fixture → appears in the right gameweek

---

## 3. Predictions (as a member)

- [ ] Log in as test member → `/gameweeks/[current]` loads all fixtures
- [ ] Enter score predictions for every fixture
- [ ] Submit → predictions saved
- [ ] Refresh page → predictions still there
- [ ] Edit a prediction before that fixture kicks off → saves
- [ ] Try to edit a prediction AFTER kickoff → blocked (server-side, not just UI)
- [ ] Submit a partial gameweek (only future fixtures) → accepted as late submission
- [ ] Try to edit a fixture that's already kicked off → rejected with a clear message

---

## 4. Predictions visibility

- [ ] Before gameweek is finished, other members' predictions are hidden
- [ ] After each fixture kicks off, THAT fixture's predictions visible to everyone
- [ ] George can see ALL predictions at any time via `/admin/predictions`

---

## 5. Scoring

- [ ] Sync results after fixtures finish → scores update automatically
- [ ] 10 pts for correct result (W/D/L)
- [ ] 30 pts for correct exact score
- [ ] Members see points appear next to each prediction as results come in
- [ ] Gameweek total at the bottom updates correctly
- [ ] George can override a match result from `/admin/fixtures` → points recalculate

---

## 6. Bonuses

- [ ] George sets the active bonus type for the gameweek BEFORE kickoff
- [ ] Member sees the bonus name on the gameweek page
- [ ] Member picks which fixture to apply the bonus to (star appears on chosen fixture)
- [ ] Submit with bonus pick → saved
- [ ] After gameweek finishes, George confirms bonuses on `/admin/bonuses`
- [ ] Confirmed bonus → 20 pts applied (or Golden Glory formula: 20/60)
- [ ] Rejected bonus → no points applied
- [ ] Member can see pending vs confirmed bonus clearly

### Double Bubble

- [ ] George toggles Double Bubble for GW10/20/30 from `/admin/bonuses`
- [ ] On a Double Bubble week, member total shows `(base + bonus) × 2`
- [ ] Non-DB weeks: normal totals, no doubling

---

## 7. H2H Steals

- [ ] After a gameweek closes, if two members tied on weekly points → H2H steal flagged for NEXT gameweek
- [ ] Admin dashboard shows `h2h_steal_detected` notification
- [ ] Tied members see an amber banner on the next gameweek page: "You're in an H2H steal"
- [ ] When the next gameweek closes, the higher scorer among tied members wins the jackpot
- [ ] If still tied, banner says "split" and amounts are halved
- [ ] Runner-up (£10) position ties get the same treatment
- [ ] Unconfirmed bonuses are NOT counted when detecting the tie

---

## 8. Last One Standing (LOS)

### As a member

- [ ] `/gameweeks/[current]` shows LOS team picker (dropdown with PL team list)
- [ ] Only unused teams shown (teams you've already used are filtered out)
- [ ] Can't submit the gameweek without an LOS pick (when you're still in)
- [ ] If eliminated, LOS section shows "You've been eliminated" instead of a picker
- [ ] `/los` shows your status (in/out), current pick with crest, teams used count, teams remaining count
- [ ] Standings on `/los` sort: active first (by teams used ascending), eliminated last — you are marked `(you)`

### As George

- [ ] `/admin/los` in sidebar (Crown icon) between Prizes and Import Data
- [ ] Table shows every member: status, current pick, teams used, eliminated gameweek, actions
- [ ] Override eliminate a member → status flips to eliminated, reason logged
- [ ] Reinstate an eliminated member → status back to active
- [ ] Reset the whole competition → fresh competition, all 20 teams available, all members back in

### Lifecycle

- [ ] If a member's team wins → they progress
- [ ] If their team loses or draws → eliminated automatically
- [ ] If they submit no pick → eliminated automatically
- [ ] Once only one member remains → winner notification fires, competition resets
- [ ] After reset, all 20 teams are available again

---

## 9. Prizes & additional awards

- [ ] `/admin/prizes` shows each additional prize
- [ ] George can award a prize to a specific member + gameweek
- [ ] Member sees confirmed prizes on their bonuses page
- [ ] Unconfirmed prizes hidden from members

---

## 10. Pre-season predictions (Phase 9)

Run through this as George on desktop. You'll need a member who has imported 2025-26 picks (via the Phase 7 import) and at least one non-submitted member.

**10.1 Member read-only view** (log in as a submitted member)
- [ ] `/pre-season` shows a "Locked since GW1" banner once GW1 has kicked off
- [ ] All 5 category sections render: Top 4, 10th, Relegated, Promoted, Playoff Winner
- [ ] Team names match the imported spreadsheet data
- [ ] Team badges render for PL teams (top 4, 10th, relegated); plain coloured name badges OK for Championship (promoted, playoff)
- [ ] "Pre-Season" link appears in member nav

**10.2 Admin monitoring** (log in as George)
- [ ] `/admin/pre-season` table shows all ~48 members with submission status
- [ ] Submitted members show their 12 picks inline
- [ ] Non-submitted members show a "Set picks" trigger button
- [ ] "Pre-Season" link appears in admin sidebar (with Crown icon)

**10.3 Late-joiner flow** (as George)
- [ ] Click "Set picks" for a non-submitted member → dialog opens with 12 pickers
- [ ] PL team picker shows 20 teams; Championship picker shows 24 teams
- [ ] Picking "Arsenal" in a promoted slot is blocked (client-side filter)
- [ ] Submit applies successfully, table updates, "admin-entered" badge appears

**10.4 Actuals entry**
- [ ] On `/admin/pre-season`, scroll to "Season-end actuals" section (only visible after GW1 kickoff)
- [ ] 12 team pickers (same PL/Championship split as member form)
- [ ] Enter season-end actuals → click "Lock actuals"
- [ ] "Actuals locked {timestamp}" badge appears
- [ ] "Calculate pre-season awards" button becomes visible

**10.5 Calculation**
- [ ] Click "Calculate pre-season awards" → success toast with count
- [ ] Awards confirmation section now shows per-member rows
- [ ] Flags chips ("All Top 4 ✓", "All Relegated ✓", "All Promoted ✓", "ALL 12 CORRECT 🏆") visible where earned
- [ ] Admin notification badge (bell icon) increments with `pre_season_awards_ready` / `pre_season_all_correct` / `pre_season_category_correct` entries

**10.6 Confirmation**
- [ ] Edit one member's awarded_points (e.g., override 240 → 250) → per-row "Apply" makes that row disappear with success toast
- [ ] Click "Apply all" on remaining rows → all disappear, toast shows count confirmed
- [ ] Re-running "Calculate pre-season awards" does NOT reset confirmed rows' confirmed flag (idempotency)

**10.7 Championship list + end-of-season rollover**
- [ ] Championship management section on `/admin/pre-season` lists current-season Championship teams
- [ ] Add a team → appears in list; duplicate (case-insensitive) is rejected
- [ ] Rename a team → reflected; remove a team → disappears
- [ ] "End of season rollover" button is disabled when actuals not locked OR awards not confirmed (with a clear reason message)
- [ ] Once enabled, clicking it shows a preview dialog: "Will move X, Y, Z from Premier League to Championship / Will move A, B, C from Championship to Premier League"
- [ ] Confirm → teams swap between `teams` and `championship_teams`; admin notification `season_rollover_complete` logged
- [ ] Running rollover twice is idempotent (no duplicate swaps)

**10.8 Dashboard card**
- [ ] `/admin/dashboard` shows the appropriate pre-season card based on state (submissions open / actuals pending / awards pending)
- [ ] Clicking the card navigates to `/admin/pre-season`

**10.9 Mobile (use Chrome DevTools iPhone 13 emulator)**
- [ ] `/pre-season` form dropdowns are full-width, no horizontal scroll
- [ ] All 12 slots accessible via vertical scroll
- [ ] Submit bar sticks to the bottom and remains tappable

After QA, reset any test data (delete test `pre_season_awards` rows, unlock actuals) if needed.

---

## 11. Admin panel essentials

- [ ] `/admin` dashboard shows all urgent action cards in order: approvals → set bonus → confirm bonuses → close gameweek → prizes → LOS
- [ ] Each card links to the right page
- [ ] George can close a gameweek manually from the dashboard
- [ ] Closing a gameweek with postponed fixtures → handles voided fixtures cleanly
- [ ] Member management page: add, remove, edit starting points for late joiners
- [ ] Email notification toggles work (George can turn each type on/off)

---

## 12. Reports (Phase 10)

Run through these as George on desktop with `npm run dev` running, `RESEND_API_KEY` set to a real Resend account, `ADMIN_EMAIL_GEORGE` + `ADMIN_EMAIL_DAVE` pointed at test inboxes you control, `NEXT_PUBLIC_APP_URL=http://localhost:3000`, migration 011 applied, and a test gameweek with every fixture FINISHED + bonus awards confirmed ready to close.

**12.1 Weekly email send end-to-end (RPT-01, RPT-02, RPT-03, RPT-04, RPT-05)**
- [ ] Click "Close gameweek" in `/admin` — admin UI returns in under 5s (fire-and-forget trigger does NOT block)
- [ ] Within 30-60s, every opted-in member's inbox receives a "GW{N} — your weekly breakdown" email with a personal PDF attachment
- [ ] Every opted-in member also receives the group PDF email (group standings, results, H2H, bonuses)
- [ ] George + Dave each receive the admin XLSX email with an .xlsx attachment
- [ ] Personal PDF contains the member's own predictions, scores, rank, H2H callout (if applicable)
- [ ] Group PDF contains league standings, fixture results, H2H steals, bonus summary
- [ ] Admin XLSX opens cleanly in Excel / Numbers / Sheets (no corruption warnings, all sheets present)
- [ ] PDF includes the note: "George — double-check API scores weekly, you can edit them"
- [ ] Click "Close gameweek" a second time on the same closed GW — NO duplicate emails (member_report_log UNIQUE + reports_sent_at sentinel enforce idempotency)

**12.2 Kickoff backup (DATA-04 kickoff variant)**
- [ ] Manually transition one fixture's status from SCHEDULED → IN_PLAY via admin fixtures page
- [ ] Wait for the next `/api/sync-fixtures` cron tick (or trigger manually via curl with `CRON_SECRET`)
- [ ] George + Dave each receive ONE email with subject "Backup — GW{N} all predictions as of kickoff"
- [ ] Email contains BOTH a .pdf AND a .xlsx attachment
- [ ] Trigger sync again → NO second email fires (kickoff_backup_sent_at sentinel persists)
- [ ] `admin_notifications` table shows no `kickoff_backup_failed` rows for this gameweek

**12.3 Public /standings (RPT-06)**
- [ ] Open an incognito window (no session cookie), visit `http://localhost:3000/standings`
- [ ] Page renders WITHOUT redirecting to /login
- [ ] League table displays every member: display_name, total_points, derived rank (1, 2, 3…)
- [ ] Latest closed GW fixture results shown (home team, away team, home score, away score)
- [ ] Top-3 weekly scorers section shows 3 display_names
- [ ] If no gameweeks are closed yet, page shows "Awaiting first closed gameweek…" instead of crashing
- [ ] Open DevTools Network tab, inspect the /standings HTML response — NO prediction score numbers leaked, NO LOS team names leaked, NO bonus data leaked, NO H2H details leaked (column allowlist enforced)
- [ ] Visit `http://localhost:3000/` — home page renders the same standings view (re-export)

**12.4 Member /profile email opt-out**
- [ ] Log in as a test member, visit `/profile`
- [ ] Display name + email shown as read-only info panels (NOT editable)
- [ ] Toggle "Weekly personal PDF email" OFF → auto-saves with no submit button → greyed-out "Not receiving" label appears
- [ ] Toggle "Weekly group PDF email" OFF → same behaviour
- [ ] Close a gameweek as admin → verify this member receives NO weekly personal / group email (while other opted-in members still do)
- [ ] Toggle both back ON → next gameweek close delivers both emails as normal
- [ ] Verify a critical email path (request password reset) STILL fires regardless of these toggles
- [ ] "Profile" link visible in member nav

**12.5 Full data export (RPT-07, DATA-04)**
- [ ] On `/admin` dashboard, scroll to the "Tools" section and click "Download full data export"
- [ ] File downloads as `georges-predictor-full-export-{YYYY-MM-DD}.xlsx`
- [ ] File size is reasonable (typically 0.5-2 MB, well above any empty-response threshold)
- [ ] Open in Excel — no corruption warnings
- [ ] Every expected sheet is present: Members, Gameweeks, Fixtures, Predictions, Scores, Bonuses, Prizes, LOS, Pre-Season, README
- [ ] README sheet has manual-run instructions George can follow if the site is down
- [ ] Scroll through one Predictions sheet — George can read every prediction for every GW for every member
- [ ] Log out, hit `/api/reports/full-export` directly in an incognito tab → returns 401 JSON (admin-guard enforced)
- [ ] Log in as a non-admin member, hit the same URL → also 401 (role check, not just session check)

**12.6 Failure handling + resume**
- [ ] Intentionally break `RESEND_API_KEY` (set to `re_invalid_test`) and click "Close gameweek" on a fresh test GW
- [ ] `closeGameweek` itself still returns success (fire-and-forget decouples the trigger from the send)
- [ ] `admin_notifications` table gets rows with type `report_send_failed` or `report_render_failed` per-member
- [ ] Fix `RESEND_API_KEY` back to the real value
- [ ] On the closed GW's admin page, click "Resume report send" → endpoint re-runs the orchestrator
- [ ] ONLY the members who never got an email receive one this time (member_report_log UNIQUE guards against duplicate sends to already-delivered members)
- [ ] Double-click the Resume button (click-spam) → still no duplicate sends

**12.7 Mobile PDF + email rendering**
- [ ] Forward the personal PDF email to your phone
- [ ] Open the attached PDF on iOS Mail (Safari preview) → readable, no clipping, predictions visible
- [ ] Open the attached PDF on Android Gmail (Chrome preview) → readable, no clipping
- [ ] Group PDF same two checks on both platforms
- [ ] Email body (the text before the attachment) renders correctly on both — no broken CSS, no missing images
- [ ] H2H callout banner (if applicable for the test member) is visible and readable on phone
- [ ] Reports are also viewable on the website (link back to /gameweeks/[n] from the email body)

After Phase 10 QA, reset any test data: clear `member_report_log` rows, reset `reports_sent_at` and `kickoff_backup_sent_at` sentinels on the test gameweek, and delete any test rows in `admin_notifications` generated during the failure-handling step.

---

## 13. League table & historical data

- [ ] League table sorted by points descending (positions derived on the fly)
- [ ] Ties shown correctly
- [ ] Previous season archive accessible
- [ ] Member profile page shows total points + season history

---

## 14. Mobile (real phone check)

Use YOUR actual phone, not just DevTools. iOS Safari AND Android Chrome.

- [ ] Sign up on mobile → works
- [ ] Login persists after closing + reopening browser
- [ ] Prediction form: score inputs open the number keypad (not full QWERTY)
- [ ] LOS team picker opens full-width, easy to tap
- [ ] Bonus star tap targets big enough
- [ ] No horizontal scrolling anywhere
- [ ] Tables don't overflow (league, LOS admin, etc.)
- [ ] Fixed footer (gameweek totals) doesn't cover content
- [ ] All pages load in under 3 seconds on 4G

---

## 15. Polish & branding (Phase 11)

- [ ] Team badges consistent everywhere
- [ ] Fonts/colours match PL aesthetic (or whatever final brand was chosen)
- [ ] "How It Works" page explains rules, scoring, bonuses, LOS, prizes in plain English
- [ ] No placeholder text, no "Lorem ipsum", no console errors
- [ ] Favicon + page titles set
- [ ] 404 and error pages exist and look intentional

---

## 16. Infrastructure & costs

- [ ] Supabase project still on free tier
- [ ] Vercel project still on Hobby tier (no overage)
- [ ] Football-data.org free tier hasn't been exceeded
- [ ] Email sending is on the free plan
- [ ] Supabase keep-alive cron is running (`sync-fixtures` hits the DB regularly)
- [ ] Database doesn't auto-pause (check Supabase dashboard after 7 days idle)

---

## 17. Security sanity

- [ ] Logged out: can't access any `/admin/*` route
- [ ] Member: can't access any `/admin/*` route (gets 403 or redirect)
- [ ] Member: can't see other members' predictions before kickoff (check Network tab)
- [ ] Member: can't submit predictions for someone else (the API ignores any `member_id` sent from client)
- [ ] Member: can't pick an already-used LOS team (server rejects, not just UI)
- [ ] Member: can't edit a prediction after kickoff (server rejects)
- [ ] Security question for password reset works

---

## 18. The "shove it and see" test

With everything above passing, invite ONE real member (not yourself) to sign up and play through a full gameweek. Watch over their shoulder — every confused moment is a bug to note.

- [ ] They can sign up without asking you a question
- [ ] They can submit predictions without asking you a question
- [ ] They can find their points after the weekend
- [ ] They understand if they're still in LOS
- [ ] They read something confusing → note what, fix it

---

## Bug log template

Copy-paste for any issue you find:

```
SCENARIO: (section # + what you were doing)
EXPECTED: (what should happen)
ACTUAL: (what did happen)
DEVICE/BROWSER: (phone/desktop, Safari/Chrome/etc.)
SEVERITY: (blocker / annoying / cosmetic)
```

Paste each bug into a `docs/QA_BUGS.md` file as you find them, then work through them one by one.

---

## Sign-off

- [ ] All sections above complete
- [ ] Bug log addressed or triaged to v2
- [ ] George has done his own walkthrough on his phone
- [ ] Dave has done his own walkthrough as backup admin
- [ ] One real member has signed up + played a gameweek successfully

**Ready for launch:** ☐ yes  ☐ not yet

Date: _______________
Signed: _______________
