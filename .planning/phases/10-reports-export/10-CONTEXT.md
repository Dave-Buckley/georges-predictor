# Phase 10: Reports & Export - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

After each gameweek completes, the system renders three report artefacts automatically: (1) a group-wide weekly PDF summary emailed to everyone, (2) a personal PDF for each member emailed individually, and (3) a detailed XLSX emailed to George. A public standings page (no login required) shows the current league table and latest gameweek results. George can download a full disaster-recovery export at any time. In addition, a kickoff-time backup email fires to George and Dave the moment the first fixture of each gameweek kicks off, attaching both XLSX and PDF copies of all submitted predictions / LOS picks / bonus picks as a manual-run fallback.

</domain>

<decisions>
## Implementation Decisions

### Email provider
- **Resend** for all transactional email (3,000/month free tier, 100/day soft limit)
- React Email templates (Resend-native) for consistent layout across group PDF email body, personal PDF email body, admin XLSX email body, kickoff-backup email body, and password reset / approval emails (existing Phase 1 flows moved to Resend for consistency)
- Resend shared sender — no custom domain needed (uses `onboarding@resend.dev` or similar resend-managed address)
- FROM display name: "George's Predictor" so inbox preview is clear
- No SPF/DKIM setup required (Resend handles it for their shared sender)

### Unsubscribe / preferences
- **Member self-opt-out** via a toggle on their profile page (NOT admin-only)
- Members can disable: weekly personal PDF email, group PDF email
- Members CANNOT disable: critical admin emails (approval, password reset) — those always fire
- Existing admin-side `EmailNotificationToggles` (Phase 5) still controls what categories exist globally — if George disables "Weekly personal PDFs" at system level, no member gets one regardless of their own toggle
- Profile page lives at `/profile` (new route — doesn't currently exist)
- Defaults: all member-controllable emails opt-IN on registration

### Public standings page
- Route: `/standings` (no auth required) — also the site's marketing/landing destination
- Visible data: full league table (display_name, total points, rank), latest closed gameweek results (fixture scores only), names of gameweek winners (top 3 by weekly points)
- NOT visible: individual predictions, LOS picks, bonus picks, H2H steal details, anyone's personal breakdown
- **display_name only** — real names stay private to George's admin panel
- Updates: server-renders from current DB state; revalidates after gameweek close
- Same page layout works as unauth home page — members see same data + a "Sign in" link

### Group weekly PDF (RPT-01, RPT-04)
- Renders at gameweek close, emailed to all members (via their personal Resend API call loop, subject to their own toggle)
- Contents: league table after this GW, GW results (all fixtures + scores), top 3 weekly scorers, H2H steal detections, bonus confirmation summary, LOS status (who's in/out), Double Bubble notice if active
- Page size: single-page where possible, two pages max for busy weeks
- Links to `/standings` and to their own `/gameweeks/[N]`

### Personal weekly PDF (RPT-02, RPT-05)
- **Rich depth** — per-fixture row with their prediction vs actual, points earned (0/10/30), bonus applied on this fixture, LOS pick + result for the week
- Gameweek total at top, running season total + current rank at bottom
- H2H steal status callout if member is in one
- "View full details on the site" button linking to their `/gameweeks/[N]` page
- Renders in a single batch at gameweek close — all ~50 rendered sequentially (~30-60s total), fire-and-forget
- Idempotent — `report_sent_at` flag on a `gameweek_reports` row per member prevents double-send
- If render fails for a member, log to admin_notifications, continue with the rest

### Admin detailed XLSX (RPT-03, RPT-04)
- One file emailed to George (+ Dave for redundancy), not members
- Sheets: Standings, Predictions (every member × every fixture in the GW), Scores (with calculation breakdown), Bonuses (pending + confirmed), LOS, H2H, Pre-Season awards (end of season), Admin audit log
- Includes the pre-existing "double-check API scores weekly" reminder note per George's PDF note memory
- Uses xlsx v0.18.x (pinned per Phase 2 decision — v0.19+ is paid)

### Kickoff-time backup email (NEW — user-requested in Phase 9 session)
- Fires the moment the first fixture of the current gameweek transitions from SCHEDULED to IN_PLAY/FINISHED (detected by sync pipeline)
- Recipients: George AND Dave (both admins for disaster recovery redundancy)
- Subject: "Backup — GW{N} all predictions as of kickoff"
- Attachments: **both XLSX and PDF** (XLSX so they can edit/run manually, PDF so they can read on mobile even without a spreadsheet app)
- Contents: every member's predictions for each fixture, LOS picks, bonus picks, as locked at kickoff
- Trigger mechanism: a new `kickoff_backup_sent_at` flag on the `gameweeks` row + a check in the existing sync pipeline; when the first fixture becomes non-scheduled and the flag is null, render + send + set the flag. Idempotent. No new cron (piggybacks on the existing sync-fixtures cron that runs every 5-10 min).
- If render fails, log admin_notifications and leave the flag null so next sync retries

### Full data export (RPT-07, DATA-04)
- Admin-only download button on admin dashboard: "Download full data export"
- Format: single XLSX file with every sheet from the weekly admin XLSX, expanded to all gameweeks of the season + pre-season picks + awards + all members + fixtures + historic h2h/LOS data
- Goal: if the site dies, George can open this file and continue running the competition manually in Excel
- Regenerated on-demand (not stored) — keeps Supabase storage empty
- Includes a README sheet explaining column meanings and how to continue manually

### Render timing summary
- Group PDF: at closeGameweek
- Personal PDFs: at closeGameweek (batch, all members)
- Admin XLSX: at closeGameweek
- Kickoff backup: at first-fixture-kickoff detection (via sync pipeline)
- Full export: on-demand admin download

### Claude's Discretion
- Exact PDF layout/styling (fonts, colour palette, header graphics)
- Which PDF library (likely @react-pdf/renderer for React Email + PDF consistency — planner to confirm against Vercel serverless size limits)
- XLSX column order within sheets (planner to pick sensible grouping)
- How the "unsubscribed" state is visually indicated in the profile page
- Cron setup for Supabase keep-alive merge (INFRA-03) — can coexist with Phase 10 OR stay Phase 5's responsibility
- Batch render concurrency (sequential vs `Promise.all` — likely sequential to stay under Resend 100/day if all 50 fire)
- Whether the public standings page is also the unauth home page or a separate route
- Error handling on partial send failures (which members get retry)

</decisions>

<specifics>
## Specific Ideas

- The admin XLSX pack must include the "double-check API scores weekly; you can edit them" reminder note per memory (PDF note memory)
- Use Resend because it handles DNS/SPF/DKIM automatically for the shared sender and integrates natively with Vercel, matching INFRA-01 zero-cost principle
- The kickoff-time backup is a real-stakes feature: if the site dies Friday evening, George needs to run Saturday's gameweek from the attachments alone
- The public standings page doubles as the site's front door — keeps engagement high, lets members check scores without logging in
- React Email templates unify the look: group email, personal email, admin email, kickoff backup, auth emails all feel like one product
- On-demand full export keeps Supabase free-tier storage completely unused

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `closeGameweek` admin action (Phase 5) — the natural hook point for report triggers
- `sync-fixtures` cron (Phase 2) — the natural hook point for kickoff-backup detection
- `getPreSeasonExportRows` (Phase 9) — drop-in shape for the pre-season sheet in the admin XLSX and full export
- Pure calc libs (`calculatePoints`, `calculateBonusPoints`, `calculatePreSeasonPoints`) — all deterministic, reusable in PDF/XLSX renderers with no side effects
- H2H detect + LOS evaluate libs (Phase 8) — status data for reports
- `EmailNotificationToggles` admin UI (Phase 5) — existing settings shape, extend with Phase 10 toggle categories
- `admin_notifications` table — extend with render-failure notification types
- `members.display_name` — already the canonical name field for public display
- xlsx v0.18.x (Phase 7 import) — already installed and working for admin writes

### Established Patterns
- Server actions with `requireAdmin()` for admin-only artefacts (full export download)
- Idempotent flags on DB rows for "has this been sent" tracking — same pattern as bonus `awarded` tri-state
- Admin notification on non-blocking failures — don't halt the pipeline on one bad render
- Session client for member-facing routes (standings page uses session client OR admin client since unauth)
- Pure calc → UI/render layer → email layer separation

### Integration Points
- New Resend setup: `RESEND_API_KEY` env var, `src/lib/email/client.ts` wrapper
- New PDF renderer: `src/lib/reports/group-pdf.tsx`, `src/lib/reports/personal-pdf.tsx`, `src/lib/reports/kickoff-backup-pdf.tsx`
- New XLSX renderer: `src/lib/reports/weekly-xlsx.ts`, `src/lib/reports/full-export-xlsx.ts`, `src/lib/reports/kickoff-backup-xlsx.ts`
- New React Email templates: `src/emails/group-weekly.tsx`, `src/emails/personal-weekly.tsx`, `src/emails/admin-weekly.tsx`, `src/emails/kickoff-backup.tsx`
- Migration 011: new columns on `gameweeks` (`kickoff_backup_sent_at`, `reports_sent_at`), new table `member_report_log` (member_id, gameweek_id, report_type, sent_at, error?) for per-member personal PDF idempotency + error tracking, new columns on `members` (`email_weekly_personal`, `email_weekly_group` booleans default true)
- Profile page: new route `/profile` for member self-toggle + account info
- Public standings page: new route `/standings` (rendered from session client or anon)
- Admin dashboard: new "Download full data export" button
- Admin sidebar: new `/admin/reports` link to view sent-report audit log (optional)

</code_context>

<deferred>
## Deferred Ideas

- Custom domain + SPF/DKIM setup — when the app graduates beyond friends, switch from shared sender to owned domain (one-line config change in Resend)
- Real-time live scores on standings page — Phase 10 ships server-rendered revalidate-on-close snapshot only (real-time is v2 per Out of Scope)
- Historical cross-season report archive — DATA-02 (future phase)
- In-app report viewer (HTML version of the PDF) — not a hard requirement, members can click the site link for live data
- Member-facing stats / analytics page — v2 ANLYT-*
- Push notifications on report ready — project Out of Scope (email only)
- SMS reports — never (out of scope)

</deferred>

---

*Phase: 10-reports-export*
*Context gathered: 2026-04-12*
