# Resume Here

**Paused:** 2026-04-16 ~01:00 (late Weds night / early Thurs morning)
**Status:** Live — real members signing up and using the site

---

## Site is live and in use

- Production URL: https://georges-predictor.vercel.app
- Admin: https://georges-predictor.vercel.app/admin
- 48 members in DB · 5 real signups flowing in · 38 gameweeks synced with football-data.org
- Fixture/score sync runs every 15 minutes (Vercel cron)
- Members PDF guide + Admin PDF guide both served from the site and downloadable

---

## Admin access (don't lose this)

- **Dave / Bucks** — dave.john.buckley@gmail.com / `Launch2026!`
- **George** — king_gegz@aol.com / `GeorgePredictor2026!`
- Both should change their passwords via `/admin/reset-password` or Settings on first login

---

## Real members who've signed up

| Display name | Email | Points | Status |
|---|---|---|---|
| Liam | ldac323@hotmail.com | 2340 | pending approval |
| Anna | fitzgerald.anna@gmail.com | 2170 | pending approval |
| Papa Spam | will.wijngaard@zen.co.uk | 2300 | pending approval |
| Stu (was "Stuart Lenton") | stuart.lenton@ntlworld.com | 2520 | approved + merged |
| Dave (was "Kingy") | mrdavidkingrobert@gmail.com | 2460 | approved + merged |

The three "pending approval" members above should be approved by George via `/admin/members?filter=pending` — the magic-link email will land automatically once approved.

---

## Open items for next session

### Data

1. **GW32-inclusive points tally** — Dan said he'd update the starting_points to include GW32 (current tally is through GW30). When Dan hands over the updated list, bulk-update all 48 rows via the REST API (same pattern as the original import).
2. **Bucks (Dave's) starting_points** — currently set to 13,250 (5× league leader) as an obvious placeholder since Dan isn't actually playing. Keep or drop depending on Dan's preference.

### Launch checklist leftovers

- **Step 8** — Master QA walk-through (`docs/FINAL_QA_CHECKLIST.md`). Big file, lots of items. Block of uninterrupted time, 20–30 min.
- **Step 9** — Re-shoot `/how-it-works` screenshots. Public-page shots are real; private-page shots (predictions, admin panels, LOS, bonuses) are still placeholder purple boxes in `/public/how-it-works/`. Would need Edge headless with a logged-in session cookie, or just manual screenshots by Dan.
- **Step 10** — Test-fire a gameweek close. Need to close GW32 to verify the weekly-email report pipeline works end to end. Will send real emails to George + Bucks (and any approved real members). Do it when we have ~5 min to watch for failures.
- **Step 11** — Real WhatsApp invite blast. Can happen anytime — PDF + link is ready.

### Known future issues

- **Admin-close workflow doesn't update `gameweeks.status`** — the closeGameweek action sets `closed_at` but doesn't change `status`. Not critical since most pages now use fixture-based detection, but the predictions admin page still reads gameweeks.status. Manual backfill was used to set GW1-32 = 'complete'; GW33-38 = 'scheduled'. Will drift again over time.
- **Public page.tsx still uses `getTopStandings` function name** — now returns the full table (Infinity limit). Name is a minor lie but not worth renaming until someone else reads it.

---

## How today's session went

Massive launch-night session — fixed ~15 bugs discovered live, seeded the full league, wrote + shipped two PDF guides, changed the sync cadence to 15 min, added password login + duplicate-name guard on signup, unblocked both admin accounts, merged Stuart→Stu and Kingy→Dave correctly. Site went from "nothing works" at step 2 of the launch checklist to "48 members, 5 real signups, PDF guides live" by end of session. Commit range: `b3437b5` → `4033bcf`.

---

## How to resume tomorrow

Open this session with:

```
continue from .planning/RESUME-HERE.md
```

Or just open the project and the memory system will carry the zero-cost constraint, the always-commit-push preference, George's PDF double-check note, and all the other context. Production is live and self-maintaining via the 15-min sync — nothing urgent blocks overnight. Wake up, approve the 3 pending members, and move on to Step 8.
