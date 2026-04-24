# Pickup — 24 April 2026

## ⚠️ ACTION REQUIRED — update Supabase email template

The login flow just shipped now uses a **6-digit code** instead of a magic
link (fixes Barny's login loop — eliminates the whole class of
prefetch/webview bugs). For this to work, the Supabase "Magic Link" email
template must include `{{ .Token }}`. The default template only includes
the link.

**Do this now:**

1. Open https://supabase.com/dashboard/project/unpdsomipodadnlnbioq/auth/templates
2. Click the **Magic Link** template
3. Replace the body with the HTML below
4. Save

```html
<h2>Your George's Predictor login code</h2>

<p>Hi — your 6-digit login code is:</p>

<p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; font-family: monospace; margin: 24px 0; padding: 16px 24px; background: #f4f4f4; border-radius: 8px; display: inline-block;">
  {{ .Token }}
</p>

<p>Type this into the login screen on George's Predictor. The code expires in 1 hour.</p>

<hr style="margin: 32px 0; border: none; border-top: 1px solid #e5e5e5;" />

<p style="color: #666; font-size: 14px;">
  Or if you prefer, you can click this link to log in:
  <br />
  <a href="{{ .ConfirmationURL }}">Log me in</a>
</p>

<p style="color: #999; font-size: 12px; margin-top: 24px;">
  Didn't request this? Ignore this email — your account is safe.
</p>
```

After saving, test by logging in fresh. Any existing users requesting a
code from the old template will just see the link (no code) — they'll
need to request a new code after the template is updated. No harm done.

## ⚠️ Also — forward to Barny

Once the template is updated, tell Barny:

> "Login works differently now — enter your email, check your inbox for
> a 6-digit code, type it into the app. No more link clicking needed.
> If you don't see a code in the email, George needs to save the new
> template (ping Dave if this happens)."

## What shipped this session

Three fixes pushed to master:

1. **`9437645`** — fix(admin): close-gameweek dialog shows correct points
   total. Was displaying 0 because `prediction_scores` query filtered on
   a non-existent `gameweek_id` column; now filters by fixture IDs.
   GW33 shows the real ~1,190 point total.

2. **`dbd859e`** — fix(predictions): WhatsApp share button now opens
   WhatsApp with picks pre-filled instead of only copying to clipboard.
   George's "nothing happens" report.

3. **`f935521`** — feat(login): surface `?error=auth` with diagnostic
   banner on the login page, explaining prefetch/webview issues.

4. **`<this commit>`** — feat(login): switch from magic link flow to
   6-digit OTP code flow. Members now enter a code instead of clicking
   a link. Magic link still works as fallback for users whose email
   clients handle it cleanly.

## Tell George (when ready)

> "Two fixes live: (1) Close Gameweek 33 now shows the real points
> total (was a display bug — click it when you're ready, everyone's
> season totals will update automatically). (2) WhatsApp share button
> now opens WhatsApp with your picks pre-filled — tell the group.
> Also: Barny and anyone else hitting login issues should retry —
> they'll now get a 6-digit code to type in instead of a link to click."
