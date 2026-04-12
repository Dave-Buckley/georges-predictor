---
phase: 8
slug: last-one-standing-h2h
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-12
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.4 + jsdom 29 + @testing-library/react 16 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test -- <pattern>` |
| **Full suite command** | `npm run test:run` |
| **Estimated runtime** | ~30 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- <file-being-modified>`
- **After every plan wave:** Run `npm run test:run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 8-01-01 | 01 | 0 | LOS-02, LOS-05 | unit | `npm run test -- tests/lib/los-evaluate.test.ts` | ❌ W0 | ⬜ pending |
| 8-01-02 | 01 | 0 | LOS-03 | unit | `npm run test -- tests/lib/los-team-usage.test.ts` | ❌ W0 | ⬜ pending |
| 8-01-03 | 01 | 0 | LOS-06 | unit | `npm run test -- tests/lib/los-competition.test.ts` | ❌ W0 | ⬜ pending |
| 8-01-04 | 01 | 0 | H2H-01 | unit | `npm run test -- tests/lib/h2h-detect-ties.test.ts` | ❌ W0 | ⬜ pending |
| 8-01-05 | 01 | 0 | H2H-03 | unit | `npm run test -- tests/lib/h2h-resolve.test.ts` | ❌ W0 | ⬜ pending |
| 8-01-06 | 01 | 0 | H2H-02 | integration | `npm run test -- tests/lib/sync-h2h.test.ts` | ❌ W0 | ⬜ pending |
| 8-02-01 | 02 | 2 | LOS-01 | integration | `npm run test -- tests/actions/predictions-los.test.ts` | ❌ W0 | ⬜ pending |
| 8-02-02 | 02 | 2 | LOS-04, LOS-07 | integration | `npm run test -- tests/actions/admin/los.test.ts` | ❌ W0 | ⬜ pending |
| 8-03-01 | 03 | 3 | LOS-01, LOS-04, LOS-07, H2H-01, H2H-02 | manual | Browser QA on dev server | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/lib/los-evaluate.test.ts` — covers LOS-02, LOS-05 (win/draw/loss + missing submission = eliminated)
- [ ] `tests/lib/los-team-usage.test.ts` — covers LOS-03 (20-team cycle tracking)
- [ ] `tests/lib/los-competition.test.ts` — covers LOS-06 (winner detection + reset)
- [ ] `tests/lib/h2h-detect-ties.test.ts` — covers H2H-01 (weekly tie detection, excl. unconfirmed bonuses)
- [ ] `tests/lib/h2h-resolve.test.ts` — covers H2H-03 (highest scorer wins / split on re-tie)
- [ ] `tests/lib/sync-h2h.test.ts` — covers H2H-02 (sync pipeline flags steal for next GW)
- [ ] `tests/actions/predictions-los.test.ts` — covers LOS-01 (submission + mandatory + already-used rejection)
- [ ] `tests/actions/admin/los.test.ts` — covers LOS-04, LOS-07 (admin view + override + reinstate + reset)
- [ ] `supabase/migrations/008_los_h2h.sql` — four new tables + RLS + admin_notifications CHECK extension
- [ ] No framework install needed — Vitest already configured

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| LOS team picker on mobile (Radix Select) | LOS-01 | Visual UX across iOS Safari + Android Chrome; Radix ships its own regression coverage | Open gameweek page on phone, verify picker opens, used teams filtered out, selection persists |
| Admin LOS table layout | LOS-04, LOS-07 | Visual info density across member counts (~50) | Open `/admin/los`, verify sortable columns, override buttons work |
| H2H steal banner on member GW page | H2H-01, H2H-02 | Visual treatment + copy clarity | Trigger tie in test data, verify next GW page shows banner to tied members |
| Admin notification for LOS winner + steal | LOS-06, H2H-02 | Dashboard integration visual | Simulate winner, verify notification appears on admin dashboard action cards |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
