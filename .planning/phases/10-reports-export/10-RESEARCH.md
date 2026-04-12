# Phase 10: Reports & Export - Research

**Researched:** 2026-04-12
**Domain:** PDF rendering + XLSX export + transactional email + Vercel Hobby serverless constraints
**Confidence:** HIGH (libraries), MEDIUM (serverless timing/concurrency edge cases)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Email provider**
- Resend for all transactional email (3,000/month free, 100/day soft limit)
- React Email templates (Resend-native)
- Resend shared sender — no custom domain, no SPF/DKIM setup
- FROM display name: "George's Predictor"
- Existing Phase 1 auth emails (approval, password reset) ALSO move onto Resend for consistency

**Unsubscribe / preferences**
- Member self-opt-out via `/profile` toggle (NEW route)
- Members can disable: weekly personal PDF, weekly group PDF
- Members CANNOT disable: approval + password reset (critical auth emails always fire)
- Admin-side `EmailNotificationToggles` (Phase 5) is the global gate — admin disable overrides member opt-in
- Defaults: all member-controllable emails opt-IN on registration

**Public standings page**
- Route `/standings`, no auth required, also doubles as the unauth home page
- Visible: league table (display_name, total points, rank), latest closed GW fixture scores, top-3 GW scorers
- NOT visible: predictions, LOS picks, bonus picks, H2H details, per-member breakdowns
- `display_name` only — never real names
- Server-rendered, revalidates after GW close

**Group weekly PDF (RPT-01, RPT-04)**
- Renders at `closeGameweek`, emailed to all members (subject to member toggle)
- Contents: league table, GW results (fixtures+scores), top-3 weekly, H2H detections, bonus summary, LOS status, Double Bubble notice
- Single-page where possible, two pages max
- Links to `/standings` and `/gameweeks/[N]`

**Personal weekly PDF (RPT-02, RPT-05)**
- Rich per-fixture depth — their prediction vs actual, points (0/10/30), bonus applied on this fixture, LOS pick+result
- GW total at top, season total + current rank at bottom
- H2H steal status callout if member is in one
- "View full details" button → `/gameweeks/[N]`
- Batch render all ~50 sequentially at closeGameweek, fire-and-forget
- Idempotent — `member_report_log` row per (member, gameweek, report_type) prevents double-send
- If render fails for one member, log to `admin_notifications`, continue with the rest

**Admin detailed XLSX (RPT-03, RPT-04)**
- One file emailed to George + Dave (redundancy), not members
- Sheets: Standings, Predictions, Scores (with calc breakdown), Bonuses (pending+confirmed), LOS, H2H, Pre-Season (end of season), Admin audit log
- Includes "double-check API scores weekly; you can edit them" reminder note per George's PDF note memory
- xlsx v0.18.x pinned (v0.19+ is paid)

**Kickoff-time backup email (NEW)**
- Fires when first fixture of current GW transitions SCHEDULED → IN_PLAY/FINISHED (detected by existing sync pipeline)
- Recipients: George AND Dave (both admins for redundancy)
- Subject: `Backup — GW{N} all predictions as of kickoff`
- Attachments: BOTH XLSX and PDF
- Contents: every member's predictions, LOS picks, bonus picks as locked at kickoff
- Trigger: new `kickoff_backup_sent_at` flag on `gameweeks` + check in existing sync pipeline
- Idempotent — if render fails, log admin_notifications and leave flag null so next sync retries
- NO new cron (piggybacks on existing 5-10min sync-fixtures cron)

**Full data export (RPT-07, DATA-04)**
- Admin-only "Download full data export" button on admin dashboard
- Format: single XLSX — every weekly-admin sheet expanded to all GWs of the season + pre-season + awards + members + fixtures + H2H/LOS history
- Includes README sheet explaining columns and manual-run instructions
- Regenerated on-demand (not stored) — keeps Supabase storage empty

**Render timing summary**
- Group PDF, Personal PDFs, Admin XLSX: at `closeGameweek`
- Kickoff backup: via sync pipeline on first-fixture kickoff detection
- Full export: on-demand admin download

### Claude's Discretion

- Exact PDF layout/styling (fonts, colour palette, header graphics)
- PDF library choice (planner to confirm `@react-pdf/renderer` vs alternatives against Vercel serverless size limits)
- XLSX column order within sheets
- How "unsubscribed" state is visually indicated in profile page
- Supabase keep-alive cron co-location (Phase 10 OR stay Phase 5's responsibility — currently Phase 5 owns it)
- Batch render concurrency (sequential vs `Promise.all`)
- Whether public standings page is also the unauth home page or a separate route
- Error handling on partial send failures (which members get retry)

### Deferred Ideas (OUT OF SCOPE)
- Custom domain + SPF/DKIM (ship with Resend shared sender; one-line switch later)
- Real-time live scores on standings page
- Historical cross-season report archive (DATA-02, Phase 11)
- In-app HTML report viewer
- Member-facing stats / analytics page (v2 ANLYT-*)
- Push notifications on report ready
- SMS reports
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RPT-01 | Weekly PDF summary for the group (standings, results, H2H, bonuses) | `@react-pdf/renderer` server-side render → base64 attachment → Resend single-send loop per member |
| RPT-02 | Personal weekly PDF with per-member breakdown | Batch sequential sends (not `batch.send` — batch API disallows attachments); render N PDFs, N `resend.emails.send()` calls with rate-limit pacing |
| RPT-03 | Detailed weekly XLSX for George's records | xlsx v0.18.5 `XLSX.write({ type: 'buffer' })` → base64 attachment → Resend send to George+Dave |
| RPT-04 | Reports auto-emailed on GW complete | Hook into existing `closeGameweek` server action; fire-and-forget after DB close; log per-send to `member_report_log` for idempotency + admin_notifications for failures |
| RPT-05 | Personal PDF emailed after GW complete | Same batch flow as RPT-02; member opt-out honoured via `members.email_weekly_personal` flag + admin global gate |
| RPT-06 | Updated standings + GW report viewable on website | New `/standings` public route (server component, admin client for read, `display_name` only); existing `/gameweeks/[N]` already exists |
| RPT-07 | Full data export for manual continuation | On-demand admin action returns XLSX blob as HTTP response (Content-Disposition attachment); regenerated every request, not stored |
| DATA-04 | Local fallback — George can run manually | Full export + kickoff backup email together cover this — XLSX is editable, PDF is readable offline, both contain the full snapshot |
</phase_requirements>

## Summary

Phase 10 is a four-artifact pipeline (group PDF, personal PDFs, admin XLSX, kickoff-backup email) plus two read routes (`/standings`, `/profile`) plus a full-export on-demand action. All four write artifacts reuse the same pure calc primitives already shipped (Phases 4, 6, 8, 9). The only net-new infra concern is Vercel Hobby's 60-second function timeout vs batch-rendering ~50 personal PDFs at `closeGameweek`.

The library stack is essentially forced by what's already installed (`resend ^6.10.0`, `react-email ^5.2.10`) plus two additions (`@react-pdf/renderer` for PDF, `xlsx` v0.18.x for spreadsheets — currently **not** installed, despite Phase 2 decision claiming otherwise). A critical Resend constraint the planner must design around: **`resend.batch.send()` does not support attachments**, so the 50-member personal-PDF send loop MUST use single `resend.emails.send()` calls respecting Resend's 2 req/sec rate limit (min ~25 seconds sequential, risk of hitting the 60s function timeout).

**Primary recommendation:** `@react-pdf/renderer` (v4.x) for all PDFs + `xlsx` v0.18.5 for spreadsheets + `resend.emails.send()` (NOT batch) for per-member attachment sends + React Email templates for the HTML email bodies. Personal-PDF batch render MUST happen in an async "don't await" background pattern inside closeGameweek — the close action must return to admin in <5s while the 50-member loop runs asynchronously — or move the batch to a dedicated cron-triggered endpoint to avoid the 60s ceiling.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `resend` | ^6.10.0 (already installed) | Transactional email send | Already in package.json + already used in `src/lib/email.ts` for admin signup notification |
| `react-email` | ^5.2.10 (already installed) | React → HTML email template composition | Already installed; native pairing with Resend; unifies all email body layouts |
| `@react-pdf/renderer` | ^4.3.x | Server-side PDF rendering (React components → PDF Buffer) | Actively maintained (491+ dependents), React-component DX matches React Email for consistent layout idiom, `renderToBuffer` returns a Node Buffer ideal for Resend attachment payload |
| `xlsx` | 0.18.5 (NOT yet installed) | XLSX write (multi-sheet workbooks → Buffer) | Phase 2 decision pinned v0.18.x (last free-license version); v0.19+ is paid. **Must be installed in Phase 10** — not yet in package.json despite earlier assumption |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@react-email/components` | bundled with `react-email` | Layout primitives (`<Container>`, `<Heading>`, `<Button>`, etc.) | All email bodies (group, personal, admin XLSX, kickoff backup, Phase 1 auth emails migrated for consistency) |
| `date-fns-tz` | ^3.2.0 (already installed) | Europe/London timezone formatting for PDFs/XLSX | Reuse same timezone helpers already used for fixtures display |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@react-pdf/renderer` | `pdfkit` | Smaller bundle (~200KB vs ~1MB gzipped) but imperative drawing API — bad DX for multi-section layouts, zero shared idiom with React Email; not worth the size win on Hobby 250MB limit |
| `@react-pdf/renderer` | `pdf-lib` | Low-level (can modify existing PDFs) — overkill here; inactive since 2021, higher risk |
| `@react-pdf/renderer` | `puppeteer` / `@sparticuz/chromium` | Renders any HTML to PDF (highest layout fidelity) but **Chromium binary bundle size (~80MB compressed) risks Vercel 250MB serverless limit**, slow cold starts. Reject. |
| `@react-pdf/renderer` | `jsPDF` | Tiny (~150KB) but browser-oriented; awkward for server-side React-component idiom |
| `xlsx` 0.18.x | `exceljs` | Fully free, still maintained, richer styling API. Viable alternative IF xlsx hits issues, but Phase 2 already locked xlsx. Keep xlsx to avoid re-validation churn |
| `resend.emails.send()` loop | `resend.batch.send()` | **Batch API does NOT support attachments** — non-starter for personal-PDF batch. Can ONLY be used for non-attachment emails (e.g. a hypothetical "GW closed, link-only" notification, which is NOT the spec) |

**Installation (to add):**
```bash
npm install @react-pdf/renderer@^4.3.0 xlsx@0.18.5
```

(Note: xlsx pin uses exact version because v0.19+ is paid. Alternative install via CDN tarball per SheetJS docs also works and avoids npm-registry stale copies.)

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── email/
│   │   ├── client.ts                  # Existing Resend wrapper — extend, don't replace
│   │   └── send-attachments.ts        # NEW: helper that takes PDF+XLSX Buffers → base64 → resend call
│   ├── reports/
│   │   ├── group-pdf.tsx              # NEW: <GroupWeeklyReport /> → renderToBuffer
│   │   ├── personal-pdf.tsx           # NEW: <PersonalWeeklyReport /> → renderToBuffer (takes member+gw context)
│   │   ├── kickoff-backup-pdf.tsx     # NEW: <KickoffBackupReport /> (all predictions + LOS + bonus)
│   │   ├── weekly-xlsx.ts             # NEW: builds 7-sheet workbook Buffer for admin weekly
│   │   ├── full-export-xlsx.ts        # NEW: builds full-season workbook Buffer for RPT-07
│   │   ├── kickoff-backup-xlsx.ts     # NEW: builds single-GW predictions-snapshot workbook
│   │   └── orchestrate.ts             # NEW: top-level sendGroupReports(gw), sendPersonalReports(gw), sendAdminWeekly(gw), sendKickoffBackup(gw)
│   └── reports/_data/
│       └── gather-gameweek-data.ts    # NEW: single DB fetch that aggregates everything the PDFs/XLSX need (1 query round-trip, not N)
├── emails/                              # NEW top-level dir per Resend convention
│   ├── group-weekly.tsx                # React Email template — HTML body for group email
│   ├── personal-weekly.tsx             # HTML body for personal email
│   ├── admin-weekly.tsx                # HTML body for admin XLSX email
│   ├── kickoff-backup.tsx              # HTML body for kickoff backup
│   └── _shared/Layout.tsx              # shared header/footer
├── app/
│   ├── (public)/
│   │   └── standings/
│   │       └── page.tsx                # NEW: public league table — no auth
│   ├── (member)/
│   │   └── profile/
│   │       └── page.tsx                # NEW: self opt-out toggles + account info
│   ├── (admin)/admin/
│   │   └── (dashboard)/
│   │       └── _components/DownloadFullExport.tsx  # NEW button
│   └── api/
│       └── reports/
│           └── full-export/route.ts    # NEW: GET → returns XLSX blob with Content-Disposition
└── actions/
    └── admin/
        └── reports.ts                  # NEW: downloadFullExport, (closeGameweek extended in actions/admin/gameweeks.ts)
```

### Pattern 1: React Component → PDF Buffer (@react-pdf/renderer)
**What:** Use `renderToBuffer(<Component />)` to turn a server-only React tree into a PDF `Buffer` suitable for Resend attachments.
**When to use:** Every PDF artifact in this phase.
**Example:**
```typescript
// src/lib/reports/group-pdf.tsx
// Source: https://react-pdf.org/node
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import type { GameweekReportData } from './_data/gather-gameweek-data'

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 11 },
  h1: { fontSize: 18, marginBottom: 12 },
  row: { flexDirection: 'row', borderBottom: 1, paddingVertical: 4 },
  cell: { flex: 1 },
})

export function GroupWeeklyReport({ data }: { data: GameweekReportData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>George's Predictor — GW{data.gwNumber} Summary</Text>
        {data.standings.map((row) => (
          <View key={row.memberId} style={styles.row}>
            <Text style={styles.cell}>{row.rank}. {row.displayName}</Text>
            <Text style={styles.cell}>{row.totalPoints} pts</Text>
          </View>
        ))}
      </Page>
    </Document>
  )
}

export async function renderGroupWeeklyPdf(data: GameweekReportData): Promise<Buffer> {
  return renderToBuffer(<GroupWeeklyReport data={data} />)
}
```

**Next.js App Router caveat:** Before Next.js 14.1.1 there was a server-crash bug. This project is on Next.js 16.2.3 — **safe**. If ANY `renderToBuffer`/`renderToStream` error surfaces, add to `next.config.ts`:
```typescript
// next.config.ts
const nextConfig = {
  experimental: { serverComponentsExternalPackages: ['@react-pdf/renderer'] },
}
```
(In Next 15+ this has moved to the top-level `serverExternalPackages: ['@react-pdf/renderer']`.)

### Pattern 2: XLSX Multi-Sheet Workbook → Buffer
**What:** Build a workbook in memory, append sheets, write to Buffer.
**When to use:** Weekly admin XLSX, kickoff backup XLSX, full export.
**Example:**
```typescript
// src/lib/reports/weekly-xlsx.ts
// Source: https://docs.sheetjs.com/docs/solutions/output/
import * as XLSX from 'xlsx'
import type { GameweekReportData } from './_data/gather-gameweek-data'

export function buildWeeklyAdminXlsx(data: GameweekReportData): Buffer {
  const wb = XLSX.utils.book_new()

  // Sheet 1: README/note
  const readme = XLSX.utils.aoa_to_sheet([
    ['George\'s Predictor — Weekly Admin Report'],
    [`Gameweek ${data.gwNumber}, closed ${data.closedAtIso}`],
    [],
    ['⚠ Double-check API scores weekly — you can edit any score in /admin/fixtures.'],
  ])
  XLSX.utils.book_append_sheet(wb, readme, 'README')

  // Sheet 2: Standings
  const standings = XLSX.utils.json_to_sheet(data.standings)
  XLSX.utils.book_append_sheet(wb, standings, 'Standings')

  // Sheet 3: Predictions (every member × every fixture)
  const preds = XLSX.utils.json_to_sheet(data.predictions)
  XLSX.utils.book_append_sheet(wb, preds, 'Predictions')

  // … Scores, Bonuses, LOS, H2H, Pre-Season (if season-end)

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}
```

### Pattern 3: Resend Single-Send With Attachments
**What:** Convert Buffers to base64, pass as `attachments[]` in `resend.emails.send()`.
**When to use:** All attachment-bearing emails (personal PDF, admin XLSX, kickoff backup). CANNOT use batch API here — batch disallows attachments.
**Example:**
```typescript
// src/lib/email/send-attachments.ts
// Source: https://resend.com/docs/api-reference/emails/send-email
import { Resend } from 'resend'
import { render } from '@react-email/components'
import GroupWeekly from '@/emails/group-weekly'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendPersonalReport({
  to, memberDisplayName, gwNumber, pdfBuffer,
}: {
  to: string; memberDisplayName: string; gwNumber: number; pdfBuffer: Buffer
}) {
  const html = await render(<GroupWeekly name={memberDisplayName} gwNumber={gwNumber} />)

  return resend.emails.send({
    from: process.env.EMAIL_FROM ?? "George's Predictor <onboarding@resend.dev>",
    to,
    subject: `GW${gwNumber} — your weekly breakdown`,
    html,
    attachments: [
      {
        filename: `gw${gwNumber}-${memberDisplayName.replace(/\s+/g, '-')}.pdf`,
        content: pdfBuffer.toString('base64'),
      },
    ],
  })
}
```

### Pattern 4: Sequential Batch Send With Rate-Limit Pacing
**What:** Resend caps at 2 requests/second. 50 members → ~25 seconds sequential at the rate limit. Use an explicit delay loop.
**When to use:** Personal PDF batch at `closeGameweek`.
**Example:**
```typescript
// src/lib/reports/orchestrate.ts
async function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

export async function sendPersonalReports(gwId: string): Promise<SendSummary> {
  const members = await fetchOptedInMembers(gwId)                 // respects members.email_weekly_personal
  const reportData = await gatherGameweekData(gwId)                // single DB round-trip
  const summary: SendSummary = { sent: 0, failed: 0, skipped: 0 }

  for (const member of members) {
    const alreadySent = await isReportLogged(member.id, gwId, 'personal')
    if (alreadySent) { summary.skipped++; continue }

    try {
      const buf = await renderPersonalWeeklyPdf({ ...reportData, memberId: member.id })
      await sendPersonalReport({ to: member.email, memberDisplayName: member.display_name, gwNumber: reportData.gwNumber, pdfBuffer: buf })
      await logReportSent(member.id, gwId, 'personal')
      summary.sent++
    } catch (err) {
      await insertAdminNotification({ type: 'system', title: `Personal PDF failed for ${member.display_name}`, message: String(err) })
      summary.failed++
    }
    await sleep(550) // stays under 2 req/sec with 50ms safety margin
  }

  return summary
}
```

### Pattern 5: Fire-and-Forget From closeGameweek (Vercel 60s Timeout Workaround)
**What:** `closeGameweek` must return to admin within a few seconds. The 50-member render+send loop takes ~30-60s, which risks hitting the 60s Hobby function timeout AND blocks the admin UI.
**When to use:** This is the critical architecture decision for Phase 10.
**Two viable patterns:**

**Option A — Don't-await background (simplest):**
```typescript
// inside closeGameweek, after successful DB close
// NOT awaited — continues after response is sent
void sendPersonalReports(gameweek_id).catch((err) => {
  console.error('[closeGameweek] Personal reports batch failed:', err)
})
return { success: true }
```
⚠ On Vercel serverless, background work after `return` is **NOT guaranteed** to complete — the function instance may be suspended. Acceptable if failures log to `admin_notifications` and each member's send is idempotent (log checked before each send) so a future manual trigger finishes the batch.

**Option B — Trigger a dedicated endpoint (reliable):**
```typescript
// after DB close, fire-and-forget POST to a separate route
fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/reports/send-weekly`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  body: JSON.stringify({ gameweek_id }),
}).catch(() => { /* ignore */ })
return { success: true }
```
The `/api/reports/send-weekly` handler gets its own 60s budget AND can use `export const maxDuration = 60` to max it out. Still risky for 50 members at 2 req/sec. **Further mitigation:** render all 50 PDFs in parallel (`Promise.all`) but pace the SENDS sequentially — render is fast (~200ms per PDF), sends are the bottleneck.

**Recommended:** Option B + parallel render + paced send + idempotent `member_report_log`. If the 60s timeout is hit mid-batch, the log tracks what's sent; George can click "Resume report send" (or the next `closeGameweek` reopen+close cycle handles it) and un-logged members get their PDFs.

### Anti-Patterns to Avoid

- **Using `resend.batch.send()` for personal PDFs** — batch API rejects attachments. The spec requires attached PDFs. Anti-pattern: trying to inline PDFs as HTML data-URIs or links to avoid the attachment limit. Links defeat the "works offline / works on mobile without internet" intent of the kickoff backup.
- **Awaiting the batch inside closeGameweek** — risks 60s timeout AND blocks George clicking Close. Always fire-and-forget or hand off to a dedicated endpoint.
- **Storing PDFs/XLSX in Supabase storage for later download** — CONTEXT.md explicitly says "regenerated on-demand, not stored" to keep free-tier storage empty.
- **Letting one failed member render halt the batch** — `admin_notifications` logs per-member failure, loop continues. Spec demands this.
- **Using `Promise.all` for all 50 Resend sends** — will get rate-limited (HTTP 429) past the 2 req/sec cap. Pace with `sleep`.
- **Bundling `@react-pdf/renderer` into client components** — it's a Node-only renderer. Import only from server components / server actions / API routes. Mark parent files `import 'server-only'` if ambiguous.
- **Forgetting `serverExternalPackages` in next.config.ts** — even on Next 16, tree-shaking sometimes fights native module resolution. Set it preemptively.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF layout engine | Custom PDF byte-stream writer | `@react-pdf/renderer` | Unicode, font embedding, multi-page flow, CSS flexbox subset — all free |
| HTML email templating | Hand-written `<table>` HTML strings | React Email + `render()` | Cross-client CSS inlining, Gmail/Outlook quirk handling, preview mode |
| XLSX generation | CSV + rename `.xlsx` | `xlsx` library | Real XLSX is a zipped XML tree, not CSV; opens badly in Excel if faked; multi-sheet impossible without real library |
| Email rate limiting | `Promise.all` and hope | Explicit `sleep()` loop pacing | Resend returns 429 past 2 req/sec; retry-with-backoff complexity explodes |
| Base64 encoding | Manual btoa chains | `buffer.toString('base64')` | Node Buffer handles this correctly on all byte lengths; browser `btoa` corrupts binary |
| Preference storage | Ad-hoc JSON column | Boolean columns `email_weekly_personal`, `email_weekly_group` on `members` | Indexed, queryable from the send loop's `WHERE` clause, per CONTEXT migration 011 spec |

**Key insight:** All four artifact types (group PDF, personal PDF, admin XLSX, kickoff backup) share the SAME upstream data (fixtures + predictions + scores + bonuses + LOS + H2H for a given gameweek). Build ONE `gatherGameweekData(gwId)` function that returns the full snapshot; all renderers consume from it. Saves both DB round-trips and test surface.

## Common Pitfalls

### Pitfall 1: Vercel Hobby 60-second function timeout vs 50-member batch
**What goes wrong:** `closeGameweek` action includes render+send loop → exceeds 60s → admin sees generic 500 → PDFs half-sent → database closed but reports incomplete.
**Why it happens:** Vercel Hobby caps serverless functions at 60s. 50 × 2 req/sec rate limit = ~25s MINIMUM for sends alone, plus render time, plus DB queries.
**How to avoid:** (1) Move batch out of `closeGameweek` into a dedicated endpoint (`/api/reports/send-weekly`) triggered by fire-and-forget HTTP call. (2) Use idempotent `member_report_log` so a partial batch can resume. (3) Add admin "Resume report send" button backed by same endpoint with only-missing-members filter.
**Warning signs:** Function invocation time >50s in Vercel dashboard, occasional "Gateway timeout" errors, `member_report_log` missing rows after closeGameweek.

### Pitfall 2: Resend batch API silently rejecting attachments
**What goes wrong:** Dev uses `resend.batch.send([...50 members...])` to "batch send personal PDFs" — API returns validation error OR drops attachments silently, members get emails with no PDF attached.
**Why it happens:** Batch API explicitly documents "attachments and tags fields are not supported yet" — only body+subject+to+from+html/react.
**How to avoid:** ALWAYS use `resend.emails.send()` (single-send) when attachments are required. Only batch API option is link-only notifications (not spec).
**Warning signs:** Validation error on batch call, OR members receiving emails with just HTML body no PDF.

### Pitfall 3: @react-pdf/renderer server-context errors on Next.js App Router
**What goes wrong:** `renderToBuffer` throws `TypeError: PDFDocument is not a constructor` or `ba.Component is not a constructor` — React tree fails to render on server.
**Why it happens:** Pre-14.1.1 Next.js bug (we're on 16.2.3 so fixed), OR importing client components / React Context inside the PDF tree (the lib uses its own context system incompatible with React DOM context).
**How to avoid:** (1) Mark PDF component files `import 'server-only'`. (2) Don't use `useContext` or client-only hooks inside the PDF tree. (3) Set `serverExternalPackages: ['@react-pdf/renderer']` in `next.config.ts` preemptively. (4) Pass ALL data as props — no context, no theming providers.
**Warning signs:** Cryptic minified constructor errors in server logs, PDFs rendering fine locally but failing on Vercel.

### Pitfall 4: xlsx v0.18.x not published to npm (license change)
**What goes wrong:** `npm install xlsx@0.18.5` succeeds but `npm install xlsx` pulls a v0.19+ tarball from the paid-license registry OR pulls a stale 0.18.5 that subtly breaks.
**Why it happens:** Post-license-change, SheetJS recommends installing from their CDN tarball (`https://cdn.sheetjs.com/xlsx-0.20.x/xlsx-0.20.x.tgz`). The npm registry still serves 0.18.5 (the last free version), but verify what's actually installed.
**How to avoid:** Exact version pin `"xlsx": "0.18.5"` (no caret) in package.json. Verify `node_modules/xlsx/package.json` shows 0.18.5 after install. Document in migration README that upgrading is a paid-license event.
**Warning signs:** Bundle audit flags xlsx as paid, unexpected licensing prompts, version drift in lockfile.

### Pitfall 5: Resend shared sender deliverability & "via resend.dev" label
**What goes wrong:** Gmail/Outlook show "via resend.dev" next to sender name, spam scores higher, some users miss emails entirely.
**Why it happens:** No custom domain means no DKIM alignment between From address and sending server. Gmail in particular flags this visibly.
**How to avoid:** Accept for MVP (CONTEXT.md locked: no custom domain). Mitigations: (1) Strong FROM display name "George's Predictor" so user sees that first, (2) Clear instruction to members on first signup email: "add to contacts, check spam for approval email," (3) Defer custom-domain migration to Phase 10+ v2 per deferred list.
**Warning signs:** Members reporting "never got the email," high bounce/spam complaints in Resend dashboard.

### Pitfall 6: Server action payload size and PDF buffer response
**What goes wrong:** Full-export download returns XLSX via server action — server action response size capped at 4.5MB (undocumented Next.js limit), full export may exceed for 30+ gameweek seasons.
**Why it happens:** Next.js server actions serialise their return over the wire; large blobs corrupt or truncate.
**How to avoid:** Full export download MUST be a Route Handler (`app/api/reports/full-export/route.ts`) returning a `Response` with `Content-Disposition: attachment`, NOT a server action. Authenticate inside the route handler via session cookie.
**Warning signs:** Downloaded file is 0 bytes or corrupted, "FetchError: body used already" in logs.

### Pitfall 7: Idempotency race — closeGameweek called twice, double emails
**What goes wrong:** George clicks Close, tab hangs, clicks again → two concurrent batches → members get duplicate emails.
**Why it happens:** closeGameweek is slow (large write), browser retries, no lock.
**How to avoid:** (1) `member_report_log` UNIQUE constraint on `(member_id, gameweek_id, report_type)` — second insert fails, skips send. (2) `gameweeks.reports_sent_at` flag set once per GW; closeGameweek returns success immediately if flag is set and no members are un-logged.
**Warning signs:** Members complain of 2 identical emails same minute.

### Pitfall 8: Kickoff-backup trigger misfiring mid-gameweek
**What goes wrong:** Sync pipeline detects "first fixture of GW flipped to IN_PLAY" correctly at GW start, but later in the week a POSTPONED fixture gets rescheduled to earlier and flips first → backup re-sends.
**Why it happens:** "First fixture" changes if kickoff times change. Detection logic must be based on the flag, not on a moving target.
**How to avoid:** Trigger is purely `WHERE kickoff_backup_sent_at IS NULL AND EXISTS (fixture in this GW with status != SCHEDULED)`. Once sent, flag is set, irrevocable. Fixture reorder cannot re-trigger because flag persists.
**Warning signs:** Two "backup" emails per GW.

### Pitfall 9: Public standings page leaking private data via relationship embeds
**What goes wrong:** `/standings` uses session client, Supabase PostgREST auto-embeds related rows from RLS-protected tables (predictions, los_picks), someone inspects the response and gets private data.
**Why it happens:** PostgREST embed via `select('*, predictions(*)')` bypasses column-level filtering; RLS policies must be audited for anon role access.
**How to avoid:** (1) Use a dedicated admin-client read on the standings page limited to only the columns needed (`display_name, total_points, rank`). (2) Verify RLS for anon role on `members`, `predictions`, `los_picks`, `bonus_picks` — anon should have ZERO access to the prediction-adjacent tables. (3) Never embed; run separate queries.
**Warning signs:** Network tab shows prediction/LOS data in standings response.

## Code Examples

### gatherGameweekData — one-query data aggregator
```typescript
// Source: pattern-shaped (composes existing phase primitives)
// src/lib/reports/_data/gather-gameweek-data.ts
import { createAdminClient } from '@/lib/supabase/admin'

export interface GameweekReportData {
  gwNumber: number
  gwId: string
  closedAtIso: string
  standings: Array<{ memberId: string; displayName: string; totalPoints: number; rank: number }>
  fixtures: Array<{ id: string; home: string; away: string; homeScore: number|null; awayScore: number|null; status: string }>
  predictionsByMember: Record<string, Array<{ fixtureId: string; home: number; away: number; points: number; bonusApplied: boolean }>>
  bonusConfig: { type: string; fixtureIdByMember: Record<string, string|null>; awarded: Record<string, boolean|null> }
  losStatus: Array<{ memberId: string; teamPicked: string|null; survived: boolean|null }>
  h2hSteals: Array<{ members: string[]; position: number }>
  topWeekly: Array<{ memberId: string; displayName: string; weeklyPoints: number }>
  doubleBubbleActive: boolean
}

export async function gatherGameweekData(gwId: string): Promise<GameweekReportData> {
  const s = createAdminClient()
  // Parallel fetch all the primitives the renderers need
  const [gw, fixtures, predictions, scores, bonusAwards, losPicks, h2h, members] = await Promise.all([
    s.from('gameweeks').select('*').eq('id', gwId).single(),
    s.from('fixtures').select('*').eq('gameweek_id', gwId),
    s.from('predictions').select('*').eq('gameweek_id', gwId),
    s.from('prediction_scores').select('*').eq('gameweek_id', gwId),
    s.from('bonus_awards').select('*').eq('gameweek_id', gwId),
    s.from('los_picks').select('*').eq('gameweek_id', gwId),
    s.from('h2h_steals').select('*').or(`detected_in_gw_id.eq.${gwId},resolves_in_gw_id.eq.${gwId}`),
    s.from('members').select('id, display_name, total_points'),
  ])
  // shape into GameweekReportData (pure transform, testable)
  return shapeData({ gw: gw.data!, fixtures: fixtures.data!, predictions: predictions.data!, scores: scores.data!, bonusAwards: bonusAwards.data!, losPicks: losPicks.data!, h2h: h2h.data!, members: members.data! })
}
```

### Route Handler for full-export (bypasses server action 4.5MB limit)
```typescript
// Source: Next.js App Router docs — Response with Content-Disposition
// src/app/api/reports/full-export/route.ts
import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { buildFullExportXlsx } from '@/lib/reports/full-export-xlsx'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Hobby max

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const buf = await buildFullExportXlsx()   // returns Buffer
  const filename = `georges-predictor-full-export-${new Date().toISOString().slice(0, 10)}.xlsx`
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
```

### Kickoff-backup hook inside existing sync pipeline
```typescript
// Source: pattern matches Phase 8 H2H integration into closeGameweek
// Added to src/lib/fixtures/sync.ts tail (or a new sync-hook module)
export async function maybeSendKickoffBackup(supabase: AdminClient): Promise<void> {
  const { data: gws } = await supabase
    .from('gameweeks')
    .select('id, number, kickoff_backup_sent_at, deadline_at')
    .is('kickoff_backup_sent_at', null)
    .order('number')
  if (!gws || !gws.length) return

  for (const gw of gws) {
    const { data: anyKickedOff } = await supabase
      .from('fixtures')
      .select('id')
      .eq('gameweek_id', gw.id)
      .neq('status', 'SCHEDULED')
      .limit(1)
    if (!anyKickedOff || !anyKickedOff.length) continue

    try {
      await sendKickoffBackupEmail(gw.id) // renders XLSX+PDF, emails George+Dave
      await supabase.from('gameweeks').update({ kickoff_backup_sent_at: new Date().toISOString() }).eq('id', gw.id)
    } catch (err) {
      await supabase.from('admin_notifications').insert({
        type: 'system',
        title: `Kickoff backup failed for GW${gw.number}`,
        message: String(err),
      })
      // leave flag null so next sync retries
    }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SendGrid / Mailgun shared senders | Resend + React Email | 2023+ | Cleaner DX, native React integration, simpler free tier |
| Puppeteer-in-Lambda for PDFs | `@react-pdf/renderer` or `@sparticuz/chromium` | 2022+ | Puppeteer bundle (~80MB Chromium) barely fits Vercel 250MB limit; component-based PDF libs bundle at ~1MB |
| `xlsx` npm free latest | Pin v0.18.5 (last free) OR switch to `exceljs` | Jan 2023 (SheetJS Pro license) | v0.19+ requires paid license — most projects pin v0.18.5 or migrate to exceljs |
| Next.js `experimental.serverComponentsExternalPackages` | `serverExternalPackages` (stable top-level) | Next 15+ | Rename. This project is on Next 16.2.3 so use the new key |
| Server action returns file Buffer | Route handler returns Response | Next 14+ | Server actions have undocumented ~4.5MB payload ceiling; Route handlers have no such limit |
| `resend.batch.send` for mass email | Single-send loop with pacing when attachments needed | 2024+ | Batch API added 2023 but still doesn't support attachments as of 2026 |

**Deprecated/outdated:**
- `experimental.serverComponentsExternalPackages` → `serverExternalPackages` in Next 15+
- xlsx paid versions (v0.19+) unless licensed
- Puppeteer on Vercel Hobby for PDFs (bundle size + cold start killers)

## Open Questions

1. **Can closeGameweek reliably hand off to /api/reports/send-weekly via fire-and-forget fetch on Vercel Hobby?**
   - What we know: Vercel serverless instances may suspend after response; not-awaited work is unreliable. Route-to-route fetch should create a NEW invocation with its own 60s budget.
   - What's unclear: Empirical reliability on Hobby specifically; Edge vs Node runtime behaviour.
   - Recommendation: Implement Option B (dedicated endpoint) but also add a manual "Resume report send" admin button backed by the same endpoint. The button covers the failure case regardless of background-work semantics. Test on preview deploy before shipping.

2. **Should the personal PDF batch run in parallel render / sequential send, or fully sequential?**
   - What we know: render is CPU-bound (~200ms), send is network-bound + rate-limit bound (500ms min between calls). Doing render in parallel while sends queue serially would overlap work.
   - What's unclear: Whether `@react-pdf/renderer` Node layout engine handles 50 concurrent `renderToBuffer` calls cleanly on 1 CPU core without starving.
   - Recommendation: Start sequential (simplest, works). Optimise to parallel-render-serial-send only if total time hits 55s+ on real data.

3. **Where does the Supabase keep-alive cron live after Phase 10?**
   - What we know: vercel.json already has 2 crons (keep-alive @ 9am, sync-fixtures @ 7am), Hobby caps at 2 daily crons.
   - What's unclear: Nothing unclear — keep as-is. Phase 10 adds NO new crons because kickoff-backup piggybacks on sync-fixtures. CONTEXT.md Discretion item is a non-issue.
   - Recommendation: Confirm in planning — Phase 10 does not touch vercel.json crons.

4. **Batch-send failure recovery UX — does George see a list of members who failed?**
   - What we know: CONTEXT.md says "log to admin_notifications, continue" — so failures surface in the existing notifications bell.
   - What's unclear: Whether there should be a "Retry failed report sends for GW{N}" button next to the notification, or just manual click-through.
   - Recommendation: Minimum viable: log each failure individually with member_id in message, add a "Resume report send" button on the closed GW page that re-runs only-missing-members. Planner's call on UI depth.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest v4.1.4 (already installed) |
| Config file | `vitest.config.ts` (exists) |
| Quick run command | `npm run test:run -- tests/reports` |
| Full suite command | `npm run test:run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| RPT-01 | Group weekly PDF contents match spec (standings, results, H2H, bonuses) | unit | `npm run test:run tests/reports/group-pdf.test.ts` | ❌ Wave 0 |
| RPT-02 | Personal PDF per-fixture rendering + totals + rank | unit | `npm run test:run tests/reports/personal-pdf.test.ts` | ❌ Wave 0 |
| RPT-03 | Admin XLSX multi-sheet structure + readme note + bonuses section | unit | `npm run test:run tests/reports/weekly-xlsx.test.ts` | ❌ Wave 0 |
| RPT-04 | closeGameweek triggers orchestration + idempotent `member_report_log` inserts | integration | `npm run test:run tests/reports/orchestrate.test.ts` | ❌ Wave 0 |
| RPT-04 | Respects `members.email_weekly_personal` + admin global gate | integration | same file | ❌ Wave 0 |
| RPT-05 | Personal PDF attached correctly in Resend send payload | unit | `npm run test:run tests/reports/send-personal.test.ts` (mocked Resend) | ❌ Wave 0 |
| RPT-06 | `/standings` renders without auth, shows only public columns | integration | `npm run test:run tests/app/standings.test.tsx` | ❌ Wave 0 |
| RPT-07 | Full export XLSX contains every expected sheet; README present | unit | `npm run test:run tests/reports/full-export.test.ts` | ❌ Wave 0 |
| DATA-04 | Full export opens in Excel (smoke: buffer is a valid XLSX, parseable) | smoke | same file; asserts `XLSX.read(buffer)` round-trip | ❌ Wave 0 |
| DATA-04 | Kickoff backup idempotent — flag prevents re-send | integration | `npm run test:run tests/reports/kickoff-backup.test.ts` | ❌ Wave 0 |
| — | gatherGameweekData shapes data correctly from fixtures across statuses | unit | `npm run test:run tests/reports/gather-data.test.ts` | ❌ Wave 0 |
| — | Rate-limit pacing sleep respected in batch loop | unit (fake timers) | same as orchestrate test | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test:run tests/reports` (scoped subtree)
- **Per wave merge:** `npm run test:run` (full 439-test suite — must stay green)
- **Phase gate:** Full suite green + manual QA checklist before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/reports/` directory — create
- [ ] `tests/reports/fixtures/` — shared mock GameweekReportData fixture + mock Resend client
- [ ] `tests/reports/gather-data.test.ts` — covers shape + empty/missing rows
- [ ] `tests/reports/group-pdf.test.ts` — snapshot of PDF structure (can use `@react-pdf/renderer` `renderToString` for test output)
- [ ] `tests/reports/personal-pdf.test.ts` — covers per-fixture rendering, H2H callout, opt-out skip
- [ ] `tests/reports/weekly-xlsx.test.ts` — round-trip via `XLSX.read` verifies sheet names + row counts
- [ ] `tests/reports/full-export.test.ts` — verifies every expected sheet + README
- [ ] `tests/reports/kickoff-backup.test.ts` — flag idempotency + both recipients present
- [ ] `tests/reports/send-personal.test.ts` — Resend mock asserts attachment array shape + base64 encoding
- [ ] `tests/reports/orchestrate.test.ts` — end-to-end with mocked DB + mocked Resend, verifies member_report_log writes and admin_notifications on failure
- [ ] `tests/app/standings.test.tsx` — smoke: renders without auth, column allowlist enforced
- [ ] Framework install: `npm install @react-pdf/renderer@^4.3.0 xlsx@0.18.5`

*(No new testing framework needed — Vitest covers both pure unit and React rendering via `@testing-library/react` already installed.)*

## Sources

### Primary (HIGH confidence)
- [@react-pdf/renderer npm](https://www.npmjs.com/package/@react-pdf/renderer) — v4.3.x current, React component PDF render
- [React-pdf Node compatibility](https://react-pdf.org/compatibility) — Next.js App Router support confirmed post 14.1.1
- [React-pdf Node usage](https://react-pdf.org/node) — `renderToBuffer` signature
- [Resend — Send emails with Next.js](https://resend.com/docs/send-with-nextjs) — official Next.js integration guide
- [Resend — Send Batch Emails API](https://resend.com/docs/api-reference/emails/send-batch-emails) — **confirms attachments NOT supported in batch**
- [Resend account quotas and limits](https://resend.com/docs/knowledge-base/account-quotas-and-limits) — 2 req/sec rate, 3k/month + 100/day free tier
- [SheetJS Data Export docs](https://docs.sheetjs.com/docs/solutions/output/) — `XLSX.write({ type: 'buffer' })` produces Node Buffer
- [SheetJS Node.js install](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/) — v0.18.5 npm route + CDN tarball alternative
- [Vercel Functions Duration](https://vercel.com/docs/functions/configuring-functions/duration) — Hobby 60s max (Fluid Compute 300s on Hobby)
- [Vercel Serverless Function 250MB Limit](https://vercel.com/kb/guide/troubleshooting-function-250mb-limit) — unzipped max
- Phase 4/6/8/9 RESEARCH.md files in `.planning/phases/` — existing pure-calc primitives reusable here

### Secondary (MEDIUM confidence)
- [Sending Emails with Attachments in Next.js Using ReSend and TypeScript — Medium](https://medium.com/@leon.maxime/sending-emails-with-attachments-in-next-js-using-resend-and-typescript-1e6db055e24e) — base64 buffer pattern
- [Mastering Email Rate Limits — Dale Nguyen / Medium](https://dalenguyen.medium.com/mastering-email-rate-limits-a-deep-dive-into-resend-api-and-cloud-run-debugging-f1b97c995904) — 2 req/sec pacing strategies
- [diegomura/react-pdf issue #2460 — renderToBuffer on Next.js App Router](https://github.com/diegomura/react-pdf/issues/2460) — server-external-packages workaround
- [Nutrient blog — Best JS PDF libraries 2025](https://www.nutrient.io/blog/javascript-pdf-libraries/) — comparison matrix

### Tertiary (LOW confidence — verify before relying)
- [React-pdf bundle size issue #632](https://github.com/diegomura/react-pdf/issues/632) — "1MB gzipped" figure from community report, not official measurement
- [6 Open-Source PDF libraries DEV.to](https://dev.to/ansonch/6-open-source-pdf-generation-and-modification-libraries-every-react-dev-should-know-in-2025-13g0) — library comparison
- [Resend Pricing 2026 — UserJot](https://userjot.com/blog/resend-pricing-in-2025) — free-tier limits sanity check

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Resend + React Email already installed and working in codebase; @react-pdf/renderer + xlsx well-documented in official sources
- Architecture: HIGH — patterns match existing phase idioms (non-blocking admin_notifications, idempotent flags, pure calc + render + email layers); orchestration strategy grounded in documented Vercel/Resend constraints
- Pitfalls: HIGH — Vercel limits and Resend batch-attachment limitation are officially documented (both confirmed via multiple sources); timing edge cases MEDIUM pending empirical preview-deploy validation

**Research date:** 2026-04-12
**Valid until:** 2026-05-12 (30 days — Resend/Vercel APIs stable, @react-pdf/renderer v4.x mature; re-validate xlsx license status before any v0.19+ upgrade)

---

**Key call-outs for the planner:**

1. **xlsx is NOT yet installed** (despite Phase 2 decision). Wave 0 task must `npm install xlsx@0.18.5` — exact pin.
2. **Resend batch API is off the table** — personal PDF loop MUST use single-send + pacing.
3. **Batch sits in a dedicated endpoint, not closeGameweek** — 60s Vercel Hobby ceiling demands it, or accept risk + idempotent recovery.
4. **Full export is a Route Handler, not a server action** — server action response size limit would truncate it.
5. **Add `serverExternalPackages: ['@react-pdf/renderer']` to next.config.ts** — preemptive insurance.
6. **All four artifacts share `gatherGameweekData(gwId)`** — build it once, consume four ways.
7. **Migration 011 per CONTEXT.md:** `gameweeks.kickoff_backup_sent_at`, `gameweeks.reports_sent_at`, `members.email_weekly_personal`, `members.email_weekly_group`, new `member_report_log(member_id, gameweek_id, report_type, sent_at, error?)` with UNIQUE(member_id, gameweek_id, report_type).
8. **No new Vercel cron** — Hobby cap of 2 daily crons already hit (keep-alive + sync-fixtures). Kickoff backup piggybacks sync-fixtures. Don't touch vercel.json.
