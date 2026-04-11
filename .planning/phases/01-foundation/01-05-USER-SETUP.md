# Plan 01-05: User Setup Guide — External Services

This plan deploys the application to production. Before Claude can run the deployment,
you need to set up three free external services and create a `.env.local` file.

Estimated time: **20-30 minutes**

---

## Step 1: Create Supabase Project (Free Tier)

1. Go to https://supabase.com/dashboard
2. Click **New Project**
3. Fill in:
   - **Name:** `georges-predictor` (or similar)
   - **Database Password:** Choose a strong password (save it somewhere)
   - **Region:** Pick the closest to you (e.g., EU West 1 — Ireland)
   - **Plan:** Free
4. Click **Create new project** and wait ~2 minutes for it to spin up

5. **Get your API keys:**
   - Go to **Settings → API**
   - Copy these three values:
     - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
     - **anon/public key** → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
     - **service_role key** (click "Reveal") → `SUPABASE_SERVICE_ROLE_KEY`

6. **Run the database migration:**
   - Go to **SQL Editor** in the sidebar
   - Click **New query**
   - Open the file `supabase/migrations/001_initial_schema.sql` in this project
   - Paste the full contents into the SQL Editor
   - Click **Run** (green button)
   - You should see "Success. No rows returned." — that's correct.

7. **Disable email confirmation** (members use the approval flow instead):
   - Go to **Authentication → Providers → Email**
   - Turn OFF **"Confirm email"**
   - Click **Save**

---

## Step 2: Create Resend Account (Free Tier)

1. Go to https://resend.com/signup
2. Sign up with your email
3. Go to **API Keys → Create API Key**
   - Name: `georges-predictor`
   - Permission: **Sending access**
4. Copy the key → `RESEND_API_KEY`

5. **Sending domain (choose one):**
   - **Easiest for testing:** Use `onboarding@resend.dev` (no domain verification needed, but George won't see real emails — only the registered Resend account email receives them on the free tier)
   - **For production:** Go to **Domains → Add Domain**, follow the DNS instructions for your domain

   > Note: On Resend's free tier, all outgoing emails go to the verified email address only, until you verify a custom domain. For real use, you'll want to verify a domain.

---

## Step 3: Set Up Vercel (Free Hobby Tier)

1. Go to https://vercel.com/new
2. **Import your Git Repository**
   - Connect GitHub if not already connected
   - Find and import the `Georges Predictor` repository
3. On the **Configure Project** screen:
   - Framework: **Next.js** (should auto-detect)
   - Root Directory: leave as `.` (project root)
   - **Do NOT add env vars here yet** — Claude will do this via CLI
4. Click **Deploy** — this first deploy will likely fail (no env vars yet), that's fine
5. Note your **Vercel project name** and **domain URL** (e.g., `georges-predictor-xyz.vercel.app`)

---

## Step 4: Generate CRON_SECRET

Run this command in your terminal to generate a secure random secret:

```bash
openssl rand -hex 32
```

Copy the output → `CRON_SECRET`

If you don't have `openssl`, you can use any random string generator (at least 32 characters).

---

## Step 5: Create `.env.local`

In the project root (`C:/Users/David/AI Projects/GSD Sessions/Georges Predictor/`),
create a file called `.env.local` with these contents (fill in your real values):

```env
# Supabase — from Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Resend — from API Keys
RESEND_API_KEY=re_...

# Vercel — your live URL (update after deployment)
NEXT_PUBLIC_APP_URL=https://your-project.vercel.app

# Cron security (generated above)
CRON_SECRET=your-hex-string-here

# Admin emails (George and Dave's real email addresses)
ADMIN_EMAIL_GEORGE=george@example.com
ADMIN_EMAIL_DAVE=dave@example.com
```

> **IMPORTANT:** `.env.local` is git-ignored. Never commit it. The service role key is a secret.

---

## Step 6: Push to GitHub (if not already done)

The project needs to be on GitHub for Vercel to deploy it. If it's not already:

```bash
cd "C:/Users/David/AI Projects/GSD Sessions/Georges Predictor"
git remote add origin https://github.com/YOUR_USERNAME/georges-predictor.git
git push -u origin main
```

---

## Ready to Continue

Once you have:
- [ ] Supabase project created with migration applied
- [ ] Resend account with API key
- [ ] Vercel project imported (initial deploy attempted)
- [ ] `.env.local` created with all values filled in
- [ ] Project pushed to GitHub

Tell Claude: **"Setup complete, ready to deploy"**

Claude will then:
1. Set all environment variables on Vercel via CLI
2. Seed George and Dave's admin accounts
3. Trigger the production deployment
4. Verify the live URL responds
