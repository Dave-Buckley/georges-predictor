---
phase: 9
slug: pre-season-predictions
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-12
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.4 + jsdom + @testing-library/react 16 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test:run -- <pattern>` |
| **Full suite command** | `npm run test:run` |
| **Estimated runtime** | ~30 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:run -- <file-being-modified>`
- **After every plan wave:** Run `npm run test:run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 9-01-01 | 01 | 1 | PRE-01..05 schema | migration | node regex check on migration 009 | ❌ W0 | ⬜ pending |
| 9-01-02 | 01 | 1 | PRE-03 | unit | `npm run test:run -- tests/lib/pre-season-calculate.test.ts` | ❌ W0 | ⬜ pending |
| 9-01-03 | 01 | 1 | PRE-01 | unit | `npm run test:run -- tests/lib/pre-season-validators.test.ts` | ❌ W0 | ⬜ pending |
| 9-02-01 | 02 | 2 | PRE-01, PRE-02 | integration | `npm run test:run -- tests/actions/pre-season.test.ts` | ❌ W0 | ⬜ pending |
| 9-02-02 | 02 | 2 | PRE-01, PRE-02 | integration/UI | `npm run test:run -- tests/actions/pre-season.test.ts` + manual | — | ⬜ pending |
| 9-03-01 | 03 | 3 | PRE-02, PRE-04 | integration | `npm run test:run -- tests/actions/admin/pre-season.test.ts` | ❌ W0 | ⬜ pending |
| 9-03-02 | 03 | 3 | PRE-04, PRE-05 | integration + manual | `npm run test:run && npm run build` | — | ⬜ pending |
| 9-03-03 | 03 | 3 | PRE-01..05 | manual | Browser QA on dev server | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/lib/pre-season-calculate.test.ts` — pure-fn scoring (30pts/correct, set-equality, case-insensitive match, all-correct flags)
- [ ] `tests/lib/pre-season-validators.test.ts` — Zod schemas (12 picks, source validation: PL vs Championship)
- [ ] `tests/lib/pre-season-export.test.ts` — export row shape for PRE-05
- [ ] `tests/actions/pre-season.test.ts` — member submission (lockout, RLS, upsert, source-validation)
- [ ] `tests/actions/admin/pre-season.test.ts` — admin actions (late joiner override, calculate, confirm, guard)
- [ ] `supabase/migrations/009_pre_season.sql` — seasons table, pre_season_awards table, admin_notifications CHECK extension
- [ ] `src/lib/teams/championship-2025-26.ts` — hardcoded 24-team constant
- [ ] No framework install needed — Vitest already configured

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Mobile submission form layout | PRE-01 | Visual UX across iOS Safari + Android Chrome (most members on phone) | Open `/pre-season` on phone before GW1, verify all 12 picks fit, dropdowns open full-width |
| Read-only view for current-season imported picks | PRE-01 | Visual verification against known imported data | Member logs in after import, `/pre-season` shows their spreadsheet picks with correct categories |
| Admin monitoring table | PRE-01, PRE-05 | Visual info density across ~50 members | `/admin/pre-season` shows submission counts, member list, "not submitted" filter |
| End-of-season confirmation flow | PRE-03, PRE-04 | Visual + business logic (flag display, editable award) | After actuals entered, admin sees calc results per member, flags highlighted, can adjust + apply |
| Export downloads cleanly | PRE-05 | Format correctness across Excel/Sheets/Numbers | Download XLSX from admin page, open in Excel, verify all 12 picks + awards rendered |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
