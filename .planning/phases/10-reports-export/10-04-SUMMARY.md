---
phase: 10-reports-export
plan: 04
subsystem: reports
tags: [public-standings, profile, email-opt-out, full-export, admin-download, route-handler, qa-checkpoint]

requires:
  - phase: 10-reports-export
    plan: 01
    provides: gatherGameweekData (reused for top-3 weekly scorers on /standings)
  - phase: 10-reports-export
    plan: 02
    provides: gatherFullExportData + buildFullExportXlsx (consumed by /api/reports/full-export)
  - phase: 10-reports-export
    plan: 03
    provides: closeGameweek fire-and-forget trigger + admin-auth CRON_SECRET pattern (reference idiom for 10-04 admin-session-guard)
  - phase: 05-admin-panel
    provides: EmailNotificationToggles auto-save idiom (mirrored by Profile toggles)
  - phase: 01-foundation
    provides: createServerSupabaseClient (session-scoped RLS) + createAdminClient (service-role for unauth standings + admin XLSX stream)

provides:
  - src/app/(public)/standings/page.tsx — unauth league table + latest-GW results + top-3 weekly scorers
  - src/app/(public)/page.tsx — home re-export of standings view (RPT-06 public-facing surface)
  - src/app/(member)/profile/page.tsx — member account info + email opt-out toggles
  - src/app/(member)/profile/_components/email-preference-toggles.tsx — auto-saving toggle client component
  - src/actions/profile.ts — updateEmailPreferences server action (session-scoped, partial update)
  - src/app/api/reports/full-export/route.ts — GET handler returning XLSX blob, admin-session-guarded
  - src/app/(admin)/admin/_components/DownloadFullExport.tsx — client anchor with download attribute
  - src/app/(admin)/admin/page.tsx — new 'Tools' card row hosting the download button
  - src/app/(member)/layout.tsx — Profile nav link added

affects:
  - Phase 11 (polish + branding) — standings page hero/CTA and profile visuals are the main public touchpoints that Phase 11 will theme
  - Phase 12 (launch) — full-export download is George's disaster-recovery hatch; must be proven in production launch rehearsal

tech-stack:
  added: []
  patterns:
    - Column-allowlist projection on public RSC fetch — `.select('id, display_name, total_points')` explicitly, NEVER `*` — prevents PostgREST relationship embed leaks even with row-level read enabled
    - Home page re-exports `/standings` via `export { default } from './standings/page'` — single-source-of-truth for the public league view
    - Route handler streaming for >4.5MB payloads — bypasses Next.js server-action response limit that would truncate the full XLSX export
    - Admin session guard via `user.app_metadata?.role === 'admin'` in route handler (not `requireAdmin()` helper) — handler context has no action helper; check is inlined
    - Auto-saving checkbox form pattern (EmailNotificationToggles idiom) — client component onChange → requestSubmit() → server action → revalidatePath; no submit button
    - Anchor `download` attribute + filename in Content-Disposition — browser downloads file natively, no fetch+blob dance

key-files:
  created:
    - src/app/(public)/standings/page.tsx
    - src/app/(member)/profile/page.tsx
    - src/app/(member)/profile/_components/email-preference-toggles.tsx
    - src/actions/profile.ts
    - src/app/api/reports/full-export/route.ts
    - src/app/(admin)/admin/_components/DownloadFullExport.tsx
    - tests/app/standings.test.tsx
    - tests/app/api-export.test.ts
    - tests/actions/profile.test.ts
  modified:
    - src/app/(public)/page.tsx (reduced to re-export of standings; was 221-line marketing page)
    - src/app/(admin)/admin/page.tsx (+ Tools card row)
    - src/app/(member)/layout.tsx (+ Profile nav link)
    - src/actions/admin/gameweeks.ts (closeGameweek now revalidatePath('/standings') + '/')

key-decisions:
  - Home page (/) is a thin `export { default } from './standings/page'` re-export — the 221-line marketing landing was replaced; the competition is private/inviteonly so a marketing page is dead weight, and George wanted the table as the landing
  - /standings uses `createAdminClient()` (service-role) with explicit column allowlist rather than anon client + public-read RLS — keeps RLS locked down everywhere else; the ONE public surface is bounded by the SELECT projection, not by RLS policy
  - /standings top-3 reuses `gatherGameweekData` from Plan 01 — guarantees the number on the public page matches the number in the group PDF email (single source of truth for "weekly scorers")
  - Empty-state copy on /standings reads "Awaiting first closed gameweek…" — graceful pre-season render with no fixtures/predictions to leak
  - Profile page read-only info panel shows display_name + email — both are identity-locked (display_name set at signup; email tied to auth user) so editing them is out-of-scope for this plan and a deliberate Phase 11 decision
  - Email preferences encoded as `'true' | 'false'` strings in FormData (Zod literal union) — form checkbox serialisation quirk; server action coerces to boolean before DB update
  - Partial-update semantics: updateEmailPreferences updates ONLY provided fields — supports per-toggle auto-save without round-tripping the other flag and risking stale-value overwrites
  - /api/reports/full-export uses inline admin check (`app_metadata?.role === 'admin'`) rather than importing `requireAdmin()` — route handler context + consistent with Plan 03's /api/reports/send-weekly auth pattern
  - Full-export filename format: `georges-predictor-full-export-YYYY-MM-DD.xlsx` — sortable, self-describing, unambiguous when George archives monthly snapshots
  - Download button is a plain `<a href download>` not a fetch+blob — one HTTP roundtrip, no memory bloat, no progress-bar UX wanted for a ~1-2MB XLSX
  - closeGameweek revalidates both `/standings` AND `/` (the re-export home) — Next 16 revalidatePath is per-path, not recursive; both paths cached independently
  - Manual QA (Task 4) "approved" — George approved blanket deferral of the 6-scenario QA script to `docs/FINAL_QA_CHECKLIST.md` §12 (Reports) expanded here to cover all Phase 10 end-to-end flows; approved 2026-04-12

requirements-completed:
  - RPT-06 (public standings page — league table, latest GW results, top-3 weekly, no private data leak)
  - RPT-07 (admin full-season XLSX download — covers every sheet George needs to run manually)
  - DATA-04 (disaster-recovery export — enough to run the competition from the XLSX alone if the site dies)

patterns-established:
  - Unauth public RSC fetch via admin-client + column allowlist — reusable pattern for any future public surface (stats, prize leaderboards, season archive) without loosening RLS
  - Route-handler XLSX streaming — reusable for any admin download > 4.5MB (future: raw-DB dump, audit log export)
  - Auto-saving toggle pair (personal + group email) — ready to extend with additional preferences (notification types, frequency) in a single component

duration: 28min
completed_date: 2026-04-12
---

# Phase 10 Plan 04: Member Profile + Full Export Route Summary

Ship Phase 10's four user-facing surfaces: the public `/standings` page (RPT-06), the member `/profile` email opt-out page, the admin "Download full data export" button + `/api/reports/full-export` route handler (RPT-07, DATA-04), and a manual QA checkpoint covering the full Phase 10 email + backup + standings + export pipeline end-to-end.

## One-liner

Public standings page + member email opt-out profile + admin full-season XLSX download streaming through a route handler — Phase 10's visible product layer on top of Plans 01-03's invisible orchestration.

## What Shipped

**Task 1 — Public /standings + home re-export (RPT-06)**
- `src/app/(public)/standings/page.tsx` server component renders unauth: league table (display_name, total_points, rank), latest closed GW fixture results, top-3 weekly scorers.
- Column allowlist (`'id, display_name, total_points'`) enforced at fetch — NO predictions, NO LOS picks, NO bonus picks exposed.
- Empty state "Awaiting first closed gameweek…" when no GWs closed yet — pre-season safe.
- Home page reduced from 221-line marketing landing to thin `export { default }` re-export.
- `closeGameweek` now `revalidatePath('/standings')` + `revalidatePath('/')`.
- 6 TDD tests pass (unauth render, allowlist enforcement, latest-GW results, top-3, empty state, rank derivation).
- Commits: 7424552 (RED), 3b6f573 (GREEN).

**Task 2 — Member /profile + updateEmailPreferences (email opt-out)**
- `src/app/(member)/profile/page.tsx` RSC fetches member row via session client, shows read-only display_name + email plus two auto-saving toggles.
- `src/app/(member)/profile/_components/email-preference-toggles.tsx` client component — onChange triggers form.requestSubmit(); no submit button (matches Phase 5 EmailNotificationToggles idiom).
- `src/actions/profile.ts` `updateEmailPreferences`: session-scoped auth, Zod `'true' | 'false'` literal union, partial update, `revalidatePath('/profile')`.
- Greyed-out "Not receiving" indicator when a toggle is off.
- Explanatory copy: "Critical emails (approval, password reset) always fire regardless of these toggles."
- Profile nav link added to `(member)/layout.tsx`.
- 5 TDD tests pass (unauth rejected, single-flag update, string-to-boolean coercion, other-column untouched, revalidation fires).
- Commits: 4c02a36 (RED), 8eae335 (GREEN).

**Task 3 — /api/reports/full-export + admin download button (RPT-07, DATA-04)**
- `src/app/api/reports/full-export/route.ts` GET handler: admin-session check via `user.app_metadata?.role === 'admin'`; on pass, calls `gatherFullExportData` + `buildFullExportXlsx` and streams bytes with `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` + `Content-Disposition: attachment; filename="georges-predictor-full-export-YYYY-MM-DD.xlsx"`.
- `dynamic = 'force-dynamic'`, `maxDuration = 60` — matches Plan 03 pattern; never cached.
- Sidesteps Next.js 4.5MB server-action response limit by streaming through route handler.
- `DownloadFullExport` client component: plain `<a href download>` anchor with filename (browser-native download, no fetch+blob dance).
- Wired into admin dashboard under a new "Tools" section card.
- 5 TDD tests pass (no-session 401, non-admin 401, admin headers correct, XLSX.read round-trip, non-empty body).
- Full suite 536/536 green (+16 from 520 baseline).
- Commits: 563167a (RED), 0ebac65 (GREEN).

**Task 4 — Manual QA checkpoint (APPROVED, deferred to master QA sheet)**
- User response: "approved" on 2026-04-12.
- All 6 Phase 10 QA scenarios (email send E2E, kickoff backup, public standings, profile opt-out, full export, failure handling) deferred to master end-of-project QA sheet at `docs/FINAL_QA_CHECKLIST.md` §12 (Reports).
- §12 expanded by this plan to cover the full Phase 10 surface — no manual work lost, simply rolled up to be executed in a single pass before launch (matches Phase 8 §7-8 and Phase 9 §10 deferral precedent).
- No code commits; no automated tests (human-only verification for deliverability + mobile PDF + unauth privacy + idempotency).

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written. All 3 autonomous tasks landed green on first iteration after RED→GREEN cycle.

### Checkpoint Deferrals

**Task 4 (checkpoint:human-verify):** User approved deferral to `docs/FINAL_QA_CHECKLIST.md` master sheet per established Phase 8 / Phase 9 precedent. §12 (Reports) expanded to cover:
- Email send end-to-end (personal PDF + group PDF + admin XLSX)
- Kickoff backup (first-fixture trigger + both attachments + idempotency)
- Public /standings (incognito visibility + column allowlist enforcement)
- Member /profile opt-out (toggle behavior + auto-save + critical-email override)
- Full data export (admin download + Excel round-trip)
- Failure handling (broken Resend key + admin resume button)
- Mobile PDF rendering (iOS + Android email clients)

## Metrics

- **Tasks completed:** 3 autonomous + 1 deferred checkpoint = 4/4
- **Tests added:** 16 (standings 6, profile 5, api-export 5)
- **Test suite:** 520 → 536 passing (baseline from Plan 03 + 16 new)
- **Files created:** 9 (4 page/route files, 2 client components, 3 test files)
- **Files modified:** 4 (home page, admin dashboard, member layout, closeGameweek action)
- **Duration:** ~28 minutes
- **Commits (this plan):** 6 (3 RED, 3 GREEN) + 1 docs = 7

## Self-Check: PASSED

Verified file existence:
- FOUND: src/app/(public)/standings/page.tsx
- FOUND: src/app/(public)/page.tsx
- FOUND: src/app/(member)/profile/page.tsx
- FOUND: src/app/(member)/profile/_components/email-preference-toggles.tsx
- FOUND: src/actions/profile.ts
- FOUND: src/app/api/reports/full-export/route.ts
- FOUND: src/app/(admin)/admin/_components/DownloadFullExport.tsx
- FOUND: tests/app/standings.test.tsx
- FOUND: tests/app/api-export.test.ts
- FOUND: tests/actions/profile.test.ts

Verified commits:
- FOUND: 7424552 (test: standings RED)
- FOUND: 3b6f573 (feat: standings GREEN)
- FOUND: 4c02a36 (test: profile RED)
- FOUND: 8eae335 (feat: profile GREEN)
- FOUND: 563167a (test: api-export RED)
- FOUND: 0ebac65 (feat: api-export GREEN)
