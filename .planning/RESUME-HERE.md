# Resume Here

**Paused:** 2026-04-12 evening
**Context:** Mid-launch — code complete, deploying to production

---

## Where we are

**v1.0 is code-complete + pushed + tagged.** 11 phases, 37 plans, 614 tests green.

Currently walking the 11-step launch checklist. You're in the middle of **Step 2: Vercel env vars**. Steps 1 and 2 are critical — nothing works without them.

### ✅ Done today

- All 11 phases shipped (includes pre-launch audit fixes: bonus_awards CHECK + Double Bubble display)
- Master QA checklist saved to `docs/FINAL_QA_CHECKLIST.md` + copied to your Downloads
- Milestone v1.0 archived + git tagged + pushed to origin
- **Step 1 — Supabase migrations applied ✅** — all 12 migrations ran green against the production Supabase project (after a schema nuke + migration-002 fix for a broken `m.role` reference)
- Production URL confirmed: https://georges-predictor.vercel.app
- Clean-start SQL file in `C:\Users\David\Downloads\Georges-Predictor-MIGRATIONS.sql`
- Env template file in `C:\Users\David\Downloads\Georges-Predictor.env`

### ⏳ Currently mid-step: Step 2 — Vercel env vars

You pasted the env template file with `<PLACEHOLDER>` strings into Vercel. Those need to be replaced with real values.

**Tomorrow pick up here:**

1. **Delete** any placeholder env var entries from Vercel (Settings → Environment Variables)
2. **Get the 5 real values:**
   - **Supabase** → https://supabase.com/dashboard/project/_/settings/api — grab Project URL, anon public key, service_role key
   - **Resend** → https://resend.com (sign up free) → API Keys → create `georges-predictor` key → copy the `re_...` string
   - **football-data.org** → https://www.football-data.org/client/register (sign up free) → token comes in welcome email
3. **Pick a random string** for `CRON_SECRET` (mash keyboard for 30+ chars, or `openssl rand -hex 32`)
4. **Edit** `C:\Users\David\Downloads\Georges-Predictor.env` — replace every `<PLACEHOLDER>` with its real value
5. **Import into Vercel:** Settings → Environment Variables → "⋯" menu → Import .env → select file → Production → Save
6. **Redeploy:** Deployments tab → latest → "⋯" → Redeploy

---

## Remaining launch checklist (after Step 2)

3. **Verify site loads** — hit https://georges-predictor.vercel.app after redeploy, hard refresh, confirm purple hero shows
4. **Create George's + Dave's admin accounts** — sign up both via `/signup`, then in Supabase → Authentication → Users → each user → edit `app_metadata` → set `role: "admin"`
5. **Import mid-season data** via `/admin/import` — your existing spreadsheet of ~48 members + GW31 points tally
6. **Enter GW32–37 scores manually** via `/admin/fixtures` (the football-data.org sync takes over from GW38 onwards)
7. **Add Dave ("Bucks") as a member** via `/admin/members` with starting points matching the current league leader
8. **Walk the master QA sheet** (in Downloads) end-to-end
9. **Re-shoot the 5 `/how-it-works` screenshots** per the runbook at `docs/how-it-works-screenshot-runbook.md`
10. **Test-fire a gameweek close** — pick a test GW, click close, verify emails arrive
11. **Invite real members** — share https://georges-predictor.vercel.app in the WhatsApp group, approve signups via `/admin/approvals`

---

## Known post-launch nice-to-haves (not blockers)

- Free stock photos from Unsplash/Pexels on the landing hero (legal, unlike PL photos — which I declined to scrape)
- Custom domain swap (when/if you buy one) → one-line Resend + Vercel config change

---

## How to resume tomorrow

Open this session with:

```
continue from .planning/RESUME-HERE.md
```

Or just open the project and I'll pick up the launch checklist where we left off. Memory is saved — production URL, zero-cost constraint, non-technical user audience, feature ideas list, everything carries forward.

Good luck. Shout if anything breaks overnight.
