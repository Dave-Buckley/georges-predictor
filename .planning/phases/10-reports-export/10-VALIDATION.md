---
phase: 10
slug: reports-export
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-12
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.4 + jsdom + @testing-library/react 16 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test:run -- tests/reports` |
| **Full suite command** | `npm run test:run` |
| **Estimated runtime** | ~45 seconds (full suite with PDF rendering) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:run -- <file-being-modified>`
- **After every plan wave:** Run `npm run test:run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | infra | install | node regex check package.json deps | ❌ W0 | ⬜ pending |
| 10-01-02 | 01 | 1 | RPT-01..07, DATA-04 schema | migration | node regex check 011 SQL | ❌ W0 | ⬜ pending |
| 10-01-03 | 01 | 1 | — | unit | `npm run test:run -- tests/reports/gather-data.test.ts` | ❌ W0 | ⬜ pending |
| 10-02-01 | 02 | 2 | RPT-01 | unit | `npm run test:run -- tests/reports/group-pdf.test.ts` | ❌ W0 | ⬜ pending |
| 10-02-02 | 02 | 2 | RPT-02 | unit | `npm run test:run -- tests/reports/personal-pdf.test.ts` | ❌ W0 | ⬜ pending |
| 10-02-03 | 02 | 2 | RPT-03, RPT-07, DATA-04 | unit | `npm run test:run -- tests/reports/weekly-xlsx.test.ts tests/reports/full-export.test.ts` | ❌ W0 | ⬜ pending |
| 10-03-01 | 03 | 3 | RPT-04, RPT-05 | integration | `npm run test:run -- tests/reports/orchestrate.test.ts tests/reports/send-personal.test.ts` | ❌ W0 | ⬜ pending |
| 10-03-02 | 03 | 3 | DATA-04 (kickoff) | integration | `npm run test:run -- tests/reports/kickoff-backup.test.ts` | ❌ W0 | ⬜ pending |
| 10-04-01 | 04 | 4 | RPT-06 | integration | `npm run test:run -- tests/app/standings.test.tsx` | ❌ W0 | ⬜ pending |
| 10-04-02 | 04 | 4 | RPT-07 | integration | `npm run test:run -- tests/app/api-export.test.ts` | ❌ W0 | ⬜ pending |
| 10-04-03 | 04 | 4 | profile opt-out | integration | `npm run test:run -- tests/actions/profile.test.ts` | ❌ W0 | ⬜ pending |
| 10-04-04 | 04 | 4 | RPT-01..07 | manual | Browser QA on dev server | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `npm install @react-pdf/renderer@^4.3.0 xlsx@0.18.5` — new deps
- [ ] Add `serverExternalPackages: ['@react-pdf/renderer']` to `next.config.ts`
- [ ] Add `RESEND_API_KEY` env var to local + Vercel
- [ ] `supabase/migrations/011_reports.sql` — gameweeks columns, member_report_log table, members email preference flags
- [ ] `tests/reports/` directory + shared fixtures
- [ ] `tests/reports/fixtures/gameweek-data.ts` — mock GameweekReportData
- [ ] `tests/reports/fixtures/resend-mock.ts` — mock Resend client (asserts attachment shape)
- [ ] `tests/reports/gather-data.test.ts` — aggregator shape
- [ ] `tests/reports/group-pdf.test.ts` — group PDF content
- [ ] `tests/reports/personal-pdf.test.ts` — personal PDF content + opt-out skip
- [ ] `tests/reports/weekly-xlsx.test.ts` — XLSX round-trip (sheet names, row counts)
- [ ] `tests/reports/full-export.test.ts` — full season XLSX + README sheet
- [ ] `tests/reports/kickoff-backup.test.ts` — idempotency flag + both recipients
- [ ] `tests/reports/send-personal.test.ts` — Resend attachment payload shape
- [ ] `tests/reports/orchestrate.test.ts` — closeGameweek → batch send → member_report_log
- [ ] `tests/app/standings.test.tsx` — unauth render + column allowlist
- [ ] `tests/app/api-export.test.ts` — route handler response is a valid XLSX buffer
- [ ] `tests/actions/profile.test.ts` — member can toggle personal/group email flags

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Resend live send deliverability | RPT-04, RPT-05 | Deliverability depends on inbox/spam filter rules that unit tests can't simulate | Send a real weekly PDF to a test inbox (Gmail + Outlook), verify it lands in Inbox not Spam, verify attachments open |
| PDF visual layout on mobile viewer | RPT-01, RPT-02 | Visual regression on mobile PDF apps (iOS Mail preview, Android Drive) | Open received PDF on phone, check readability, badge rendering |
| XLSX opens in Excel + Sheets + Numbers | RPT-03, RPT-07 | File format compatibility | Download full export, open in all 3 apps, verify no format errors |
| Kickoff backup lands before kickoff chaos | DATA-04 (kickoff variant) | Real-time detection depends on sync-fixtures cron timing | Wait for a real gameweek first-fixture kickoff, verify email arrived within 10 min of kickoff |
| Public /standings without login | RPT-06 | Visual + privacy check (no leak of predictions) | Open `/standings` in incognito, verify league table + GW results display, no prediction data exposed |
| Full export manual-run usability | RPT-07, DATA-04 | Subjective usability — "could George actually run the competition from this?" | George opens full export, can he find all predictions for a GW? Calculate scores by hand? |
| Member self-opt-out flow | email preferences | Cross-session + cross-page interaction | Member toggles off on `/profile`, closes GW, verifies no personal email received |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
