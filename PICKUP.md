# Pickup — 29 July 2026

## ⚠️ ACTION REQUIRED — run two migrations in the Supabase SQL editor

Both are DDL, so they have to be pasted in by hand (see the migration workflow).
Paste the file contents into
https://supabase.com/dashboard/project/unpdsomipodadnlnbioq/sql

1. **`supabase/migrations/025_prize_awards_member_cascade.sql`**
   `prize_awards.member_id` has no ON DELETE rule, so the database refuses to
   delete any member who has ever won a prize. `removeMember` works around this
   in code, but the constraint should be fixed properly.

2. **`supabase/migrations/026_archived_members.sql`** — **required before George
   can remove anyone.** Creates the `archived_members` table that removal writes
   a member's full history into. Until it exists, removal deliberately refuses
   with *"Could not save this member's history, so nothing was removed"* rather
   than deleting an unarchived member.

---

## ⚠️ ACTION REQUIRED — update the Supabase login email template

**This is the one thing still outstanding.** It fixes the "asks for a 6-digit
code but sends 8" confusion *and* the old "George's Predictor" branding, at
zero cost. It takes 2 minutes and needs no deploy.

1. Open https://supabase.com/dashboard/project/unpdsomipodadnlnbioq/auth/templates
2. Click the **Magic Link** template
3. Replace the body with the HTML below
4. Save

```html
<div style="background:#0b0b14;padding:32px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:480px;margin:0 auto">
    <h1 style="color:#ffffff;font-size:22px;font-weight:800;margin:0 0 16px">
      Your King Predictor login code 👑
    </h1>
    <p style="color:#c7cbd8;font-size:16px;margin:0 0 20px">
      Hi — here is your login code:
    </p>
    <div style="background:#16161f;border:1px solid #2a2a3a;border-radius:12px;padding:20px;text-align:center;margin:0 0 20px">
      <span style="color:#ffffff;font-size:38px;font-weight:800;letter-spacing:10px;font-family:'Courier New',monospace">{{ .Token }}</span>
    </div>
    <p style="color:#c7cbd8;font-size:15px;margin:0">
      Type this into the login screen on King Predictor. The code expires in 1 hour.
    </p>
    <hr style="border:none;border-top:1px solid #2a2a3a;margin:28px 0" />
    <p style="color:#9aa0b4;font-size:14px;margin:0 0 6px">
      Or if you prefer, you can tap this link to log in:
    </p>
    <p style="margin:0">
      <a href="{{ .ConfirmationURL }}" style="color:#a855f7;font-size:16px;font-weight:600">Log me in</a>
    </p>
    <p style="color:#6b7086;font-size:12px;margin:28px 0 0">
      Didn't request this? You can safely ignore this email — your account is safe.
    </p>
  </div>
</div>
```

**Note the wording deliberately says "here is your login code" — not
"6-digit" or "8-digit".** That mismatch is what caused the original bug report:
the template said 6 while Supabase was configured to issue 8. Leaving the
number out of the email means the two can never disagree again.

The login *screen* still says "8-digit", which is correct for the current
Supabase setting. If you ever change the OTP length (Authentication →
Providers → Email → OTP Length), update `src/components/auth/login-form.tsx`
to match. The server now accepts anything from 6 to 8 digits either way.

---

## What happened yesterday (28 July) and what we did about it

**Yesterday's commit `7c62cef` broke login for every member except Dave.**
It has been reverted (`d4e695c`). Login is back to the flow that worked for
months. Do not re-apply it.

### Why it broke

It moved the login-code email off Supabase's template and onto our own Resend
email, to fix the branding + digit-count wording. Three things went wrong:

1. **Resend could not deliver to anyone.** The sender is
   `onboarding@resend.dev`, Resend's shared sandbox address, which is only
   allowed to send to the Resend account owner (`dave.john.buckley@gmail.com`).
   Every other member got a `403 validation_error`. Confirmed in the Vercel
   runtime logs.
2. **The fallback could not fire either.** On Resend failure the code fell back
   to Supabase's own OTP email — but `generateLink` one line earlier already
   counted as a code request for that email, so Supabase refused with
   *"you can only request this after 59 seconds"*. Members saw
   **"No account found with this email. Have you signed up?"**
3. **Codes that did arrive were dead on arrival.** `generateLink` minted a new
   token on *every* tap of "Email me a login code", and each new token
   invalidated the previous one — so the code sitting in the member's inbox had
   usually already been superseded. Hence *"That code is wrong or has expired"*
   on a code that was two minutes old.

### Also fixed in the same session

- **`5dee817` — rate-limit message.** Supabase allows one code per 60s per
  email. That error used to surface as "No account found with this email",
  which reads as *you do not exist* to a member who simply tapped the button
  twice. It now says the code is already on its way, check spam.
- **`5dee817` — code length tolerance.** Verify used to demand exactly 8
  digits. The OTP length lives in the Supabase dashboard, not the repo, so the
  two could silently drift. Now accepts 6–8.
- **`5dee817` — signup name list would not scroll on mobile.** The name picker
  was a Radix Select; it scrolls its own popup and its arrows only respond to a
  mouse hover, so on a phone you could not drag past the first screenful of
  names. Daddy Dave could not reach his name to select it. Now a native
  `<select>`, which uses the phone's own OS picker — always scrollable.
- **Signup is now a two-path chooser** — "I am a returning participant" (pick
  from the unclaimed names) or "I'm new" (type a name). A single combined list
  let a brand-new member pick a returning player's name and silently inherit
  their points. Only one control is mounted at a time, so the unused path can
  never block signup.
- **The pre-season picker's 12 team dropdowns are native selects too.** Same
  Radix scroll risk, 20–24 clubs per list, and picks close 1 August.
- **Removing a member now archives them first.** Every member-keyed table is
  snapshotted into `archived_members` and kept at least 10 years, so a removed
  player's history survives for the hall of fame and for rejoining later. If the
  snapshot fails, nothing is deleted.

---

## ℹ️ Known limitation — Resend can only email Dave

`onboarding@resend.dev` only delivers to `dave.john.buckley@gmail.com`. This
affects **every** Resend email the app sends, not just login:

- **New-signup notifications to George are silently failing.** The
  `admin_notifications` row (from the DB trigger) is still created, so pending
  approvals are visible at `/admin/members?filter=pending` — George just does
  not get the email nudge.
- Login codes are unaffected now — they come from Supabase, not Resend.

To fix properly, Resend requires a **verified domain**; a `.vercel.app`
subdomain cannot be verified. That means buying a cheap domain (~£10/yr) and
adding it at resend.com/domains, then setting `EMAIL_FROM` in Vercel. That is
the only way to send branded mail to other people from Resend — it is a real
cost, so it is your call. Everything else stays free.

---

## Tell George / the WhatsApp group

> "Login is fixed — sorry about that, it was my end, not yours. Try again now:
> put your email in, and you'll get a code to type in. If you tap the button
> twice you'll only get one code, so just use the most recent email. Also, if
> you're signing up and couldn't scroll the list of names to find yours, that's
> fixed too — the list now works properly on phones."

---

## Previous pickup — 24 April 2026 (historical, superseded above)

The login flow switched from magic links to a typed code (fixes Barny's login
loop — eliminates the whole class of prefetch/webview bugs). This required the
Supabase Magic Link template to include `{{ .Token }}`, which was done at the
time. That template is the one being replaced above; the `{{ .Token }}`
placeholder is still required and is present in the new HTML.

Also shipped that session:

1. **`9437645`** — fix(admin): close-gameweek dialog shows correct points total.
2. **`dbd859e`** — fix(predictions): WhatsApp share button opens WhatsApp with
   picks pre-filled.
3. **`f935521`** — feat(login): surface `?error=auth` with a diagnostic banner.
4. **`<that commit>`** — feat(login): magic link → typed OTP code flow.
