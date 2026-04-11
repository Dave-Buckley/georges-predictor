# Stack Research

**Domain:** Football score prediction competition platform
**Researched:** 2026-04-11
**Confidence:** MEDIUM (external services verified from training knowledge up to Aug 2025; free tier limits flagged where unverified)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 15.x (App Router) | Full-stack framework | Single deployment unit covering frontend + API routes; App Router enables server components for fast page loads without client JS overhead; Vercel-native so zero config deploy |
| TypeScript | 5.x | Type safety | Prediction scoring logic is real-money critical — types catch point calculation bugs at compile time, not in prod |
| Supabase | latest JS client (`@supabase/supabase-js` ^2) | Database, auth, real-time | PostgreSQL with Row-Level Security means predictions-hidden-until-gameweek-complete is enforced at DB level, not just app level; free tier handles 100 users with room to spare; built-in auth removes a separate service |
| Tailwind CSS | 4.x | Styling | Fastest path to polished UI; Premier League branding with custom colours trivial via CSS variables; no runtime CSS-in-JS overhead |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@react-pdf/renderer` | ^3.4 | PDF generation (weekly reports) | Server-side PDF generation in Next.js API routes; declarative React components map naturally to the structured weekly report layout; runs in Node runtime (not Edge) |
| `xlsx` (SheetJS community edition) | ^0.18 | Spreadsheet export (.xlsx) | George's detailed weekly spreadsheet export; handles complex multi-sheet workbooks; community edition is MIT licensed and free |
| `resend` | ^4.x | Transactional email | 3,000 emails/month on free tier — enough for ~48 weekly gameweek emails with headroom; React Email templates give consistent PDF-attachment emails; best DX of free-tier options in 2025 |
| `react-email` | ^3.x | Email templating | Works with Resend; write emails as React components so the weekly report email matches the PDF visually |
| `zod` | ^3.x | Schema validation | Validate prediction submissions server-side before writing to DB; validates imported season data format on mid-season import |
| `date-fns` | ^3.x | Date/time handling | Fixture kickoff times, lockout logic, gameweek grouping (midweek vs weekend); timezone-aware with `date-fns-tz` |
| `date-fns-tz` | ^3.x | Timezone handling | All kickoffs in UK time (BST/GMT); critical for lockout accuracy — a prediction submitted at 14:59 on a 15:00 kickoff must be blocked |
| `next-auth` / Supabase Auth | via Supabase | Authentication | Use Supabase Auth directly (email/password); ~50 members, no OAuth complexity needed; Supabase free tier includes unlimited auth users |
| `@supabase/ssr` | ^0.5 | Supabase + Next.js App Router | Official package for cookie-based auth in App Router; replaces deprecated `@supabase/auth-helpers-nextjs` |
| `sharp` | latest | Image optimisation | Team badge images for the polished UI; Next.js Image component uses it automatically on Vercel |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| ESLint + `eslint-config-next` | Linting | Ships with `create-next-app`; catches common Next.js mistakes |
| Prettier | Code formatting | Consistent codebase for a multi-phase build |
| Supabase CLI | Local DB dev, migrations | `supabase db diff` generates migration files; critical for managing schema changes safely in production |
| Supabase local dev | Local Postgres + Auth + Studio | `supabase start` spins up full local stack; develop without touching prod DB |

---

## Football Results API

This is the highest-risk dependency. Documented separately because free tier constraints are strict.

### Recommended: football-data.org (free tier)

| Attribute | Value | Confidence |
|-----------|-------|------------|
| Free tier | Yes — "Tier Free" plan | HIGH |
| Premier League coverage | Yes — Competition ID PL | HIGH |
| Rate limit (free) | 10 requests per minute | HIGH |
| Fixtures endpoint | `GET /competitions/PL/matches` | HIGH |
| Results (live + FT scores) | Yes | HIGH |
| API key required | Yes — free registration | HIGH |
| Historical data | Yes — multiple seasons | MEDIUM |
| Cost | £0 forever (free tier is permanent) | MEDIUM — verify at football-data.org/pricing |

**Why football-data.org over alternatives:**

- `api-football.com` (RapidAPI): Free tier is 100 requests/day hard cap — insufficient for polling live scores during a gameweek with 10 matches. Do not use.
- `OpenLigaDB`: German-focused, PL coverage is community-maintained and unreliable.
- `TheSportsDB`: Free tier covers basic data but live scores require paid plan.
- `football-data.org` is purpose-built for this exact use case; well-maintained; widely used in hobby projects; PL is a tier-1 competition in their free plan.

**Rate limit strategy for 10 req/min:**

With 10 Premier League matches in a gameweek, polling every 5 minutes during live matches uses ~2 req/min — well within limits. Implement a cron job (Vercel Cron on free tier: 2 jobs, daily minimum interval on free plan — **CRITICAL: verify Vercel Cron free tier limits**, as this may require an alternative like a Supabase Edge Function scheduled job or a free cron service like cron-job.org hitting a Next.js API route).

---

## Free Tier Adequacy Assessment

| Service | Free Tier | Limit | 100-User Assessment | Confidence |
|---------|-----------|-------|---------------------|------------|
| **Vercel** (Hobby) | Bandwidth: 100 GB/month | Serverless: 100 GB-hours compute | Adequate — 100 casual users browsing a prediction site is minimal traffic | MEDIUM — verify current Hobby limits at vercel.com/pricing |
| **Supabase** (Free) | DB: 500 MB | Auth: unlimited MAUs | Adequate — 100 users, 38 gameweeks × ~10 fixtures × 100 predictions = ~38,000 rows in predictions table; well within 500 MB | MEDIUM — verify at supabase.com/pricing |
| **Supabase** (Free) | Bandwidth: 5 GB/month | Edge Functions: 500,000 invocations/month | Adequate | MEDIUM |
| **Resend** (Free) | 3,000 emails/month | 100 emails/day | Adequate — weekly gameweek email to George = ~38 emails/season; member notifications minimal | MEDIUM — verify at resend.com/pricing |
| **football-data.org** | 10 req/min | No monthly cap stated | Adequate with polling strategy | MEDIUM — verify at football-data.org |

**CRITICAL FLAGS — verify before committing to stack:**
1. Vercel Cron Jobs: Free Hobby plan may restrict cron to daily minimum interval. If polling live scores requires sub-hourly triggers, use Supabase Edge Functions with `pg_cron` (available on free tier) as the scheduler instead.
2. Supabase pausing: Free tier projects pause after 7 days of inactivity. A competition running 38 gameweeks is active enough to avoid this, but confirm with Supabase docs.
3. Vercel serverless function timeout: Default 10s on Hobby plan. PDF generation and bulk data export must complete within this limit. `@react-pdf/renderer` for a weekly report should be well under 10s.

---

## Installation

```bash
# Bootstrap
npx create-next-app@latest georges-predictor --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

# Supabase
npm install @supabase/supabase-js @supabase/ssr

# PDF generation
npm install @react-pdf/renderer

# Spreadsheet export
npm install xlsx

# Email
npm install resend react-email @react-email/components

# Validation & utilities
npm install zod date-fns date-fns-tz

# Football API (no npm package — use native fetch with API key)
# Register at football-data.org for free API key

# Dev dependencies
npm install -D supabase @types/node
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Supabase (PostgreSQL) | Turso (libSQL/SQLite) | Only if edge-distributed reads are critical; Turso lacks native RLS — prediction visibility rules would need app-level enforcement, which is riskier for a money competition |
| Supabase (PostgreSQL) | PlanetScale (MySQL) | PlanetScale removed free tier in 2024 — do not use |
| Supabase (PostgreSQL) | Neon (serverless Postgres) | Viable alternative with generous free tier; lacks Supabase's built-in auth + real-time; would require adding separate auth service |
| Vercel | Netlify | Netlify free tier is comparable; use if Vercel Cron limits are insufficient — Netlify has scheduled functions on free tier |
| Resend | Brevo (formerly Sendinblue) | Brevo free = 300 emails/day, 9,000/month; use if Resend's 100/day limit becomes a concern (unlikely for this use case) |
| Resend | SendGrid | SendGrid free = 100 emails/day; fine for this volume but Resend has better React Email DX |
| `@react-pdf/renderer` | Puppeteer/Playwright (headless PDF) | Never on serverless — 300MB+ browser binary will exceed Vercel function size limits; only viable if self-hosting |
| `@react-pdf/renderer` | `jsPDF` + `html2canvas` | Client-side only; can't generate PDFs server-side for email attachments |
| `xlsx` (SheetJS) | `exceljs` | ExcelJS has better streaming for huge files; overkill here — SheetJS community edition handles 100 members × 38 GWs trivially |
| Next.js App Router | Next.js Pages Router | Pages Router is not deprecated but App Router is the standard for new projects in 2025; server components reduce client bundle for members on mobile |
| Next.js | Remix / SvelteKit | Both valid; Next.js chosen for ecosystem consistency with David's existing workspace (CLAUDE.md confirms Next.js as default stack) |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| PlanetScale | Removed free tier in March 2024 | Supabase or Neon |
| Puppeteer / Playwright for PDF | Binary too large for Vercel serverless (300 MB+); cold starts unacceptable | `@react-pdf/renderer` in Node runtime |
| Prisma ORM | Adds cold-start latency on serverless due to query engine binary; unnecessary complexity when Supabase's typed client is available | Supabase JS client + generated types (`supabase gen types`) |
| Firebase (Firestore) | NoSQL makes complex scoring queries (running totals, H2H detection, standings) painful; no free-tier row-level security equivalent | Supabase (PostgreSQL) |
| Pusher / Ably for real-time | Both have free tier limits; Supabase Realtime is already included for free | Supabase Realtime subscriptions |
| `nodemailer` with Gmail SMTP | Gmail SMTP has strict sending limits and requires App Password workaround; breaks if Google changes policy | Resend |
| SendGrid legacy API | 100 emails/day free; adequate but worse DX than Resend; owned by Twilio (pricing history is unstable) | Resend |
| `moment.js` | Deprecated, huge bundle (232KB); timezone handling for lockout logic needs a maintained library | `date-fns` + `date-fns-tz` |
| api-football.com (free tier) | Hard cap of 100 requests/day on free plan — insufficient for polling live scores on a 10-match gameweek | football-data.org |

---

## Stack Patterns by Variant

**If Vercel Cron free tier is too restrictive for live score polling:**
- Use Supabase Edge Functions with pg_cron as the scheduler
- Schedule `poll-live-scores` function to run every 5 minutes during active match windows
- pg_cron is available on Supabase free tier
- This keeps polling off Vercel entirely

**If George wants to self-host later (to avoid free tier concerns):**
- The Next.js + Supabase stack deploys to any VPS with Docker Compose
- Supabase is fully open-source and self-hostable
- No vendor lock-in at the application layer

**If email attachment size becomes a problem (PDF + XLSX per email):**
- Store generated files in Supabase Storage (free: 1 GB)
- Send email with a download link instead of attachment
- Supabase Storage is already in the stack

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `next@15` | `react@19`, `react-dom@19` | Next.js 15 ships with React 19 by default via `create-next-app` |
| `@supabase/ssr@^0.5` | `next@14+` | Replaces deprecated `@supabase/auth-helpers-nextjs`; required for App Router cookie handling |
| `@react-pdf/renderer@^3` | `react@18+` | Runs in Node runtime only; do NOT use in Edge runtime or client components |
| `xlsx@^0.18` | Node.js 18+ | SheetJS community edition; do not upgrade to ^0.19+ (changed to paid XLSX Pro); pin at 0.18.x |
| `date-fns@^3` | `date-fns-tz@^3` | Must match major versions — date-fns v2 and date-fns-tz v3 are incompatible |
| `tailwindcss@^4` | `next@15` | Tailwind v4 requires PostCSS config change vs v3; `create-next-app` with `--tailwind` sets this up correctly |

---

## Sources

- football-data.org documentation — coverage and rate limits (training knowledge, Aug 2025 cutoff; **MEDIUM confidence — verify free tier PL coverage at football-data.org/coverage**)
- Supabase pricing page — free tier limits (training knowledge; **MEDIUM confidence — verify at supabase.com/pricing**)
- Vercel pricing page — Hobby plan limits (training knowledge; **MEDIUM confidence — verify at vercel.com/pricing, especially Cron Job free tier**)
- Resend pricing page — free email tier (training knowledge; **MEDIUM confidence — verify at resend.com/pricing**)
- SheetJS changelog — version 0.18.x is last MIT-licensed community edition (**HIGH confidence — widely documented in community**)
- Next.js 15 release notes — React 19 requirement (**HIGH confidence**)
- `@supabase/ssr` GitHub — replaces `auth-helpers-nextjs` (**HIGH confidence**)
- PlanetScale free tier removal (March 2024) — (**HIGH confidence — widely reported across community**)

---
*Stack research for: Premier League Score Predictor (Georges Predictor)*
*Researched: 2026-04-11*
