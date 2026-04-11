---
phase: 6
slug: bonus-system
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-12
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.4 |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npx vitest run tests/lib/scoring-bonus.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/lib/scoring-bonus.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-xx-01 | 01 | 1 | BONUS-01 | unit (RLS) | `npx vitest run tests/lib/bonus-rls.test.ts` | ❌ W0 | ⬜ pending |
| 06-xx-02 | 01 | 1 | BONUS-02 | unit | `npx vitest run tests/actions/predictions.test.ts` | Extend | ⬜ pending |
| 06-xx-03 | 01 | 1 | BONUS-02 | unit | `npx vitest run tests/actions/predictions.test.ts` | ❌ W0 | ⬜ pending |
| 06-xx-04 | 02 | 1 | BONUS-03 | unit | `npx vitest run tests/lib/scoring-bonus.test.ts` | ❌ W0 | ⬜ pending |
| 06-xx-05 | 02 | 1 | BONUS-03 | unit | `npx vitest run tests/lib/scoring-bonus.test.ts` | ❌ W0 | ⬜ pending |
| 06-xx-06 | 02 | 1 | BONUS-03 | unit | `npx vitest run tests/lib/scoring-bonus.test.ts` | ❌ W0 | ⬜ pending |
| 06-xx-07 | 02 | 1 | BONUS-04 | unit | `npx vitest run tests/lib/scoring-bonus.test.ts` | ❌ W0 | ⬜ pending |
| 06-xx-08 | 02 | 1 | BONUS-04 | unit | `npx vitest run tests/lib/scoring-bonus.test.ts` | ❌ W0 | ⬜ pending |
| 06-xx-09 | 02 | 1 | BONUS-04 | unit | `npx vitest run tests/lib/scoring-bonus.test.ts` | ❌ W0 | ⬜ pending |
| 06-xx-10 | 02 | 1 | BONUS-05 | unit | `npx vitest run tests/lib/scoring-bonus.test.ts` | ❌ W0 | ⬜ pending |
| 06-xx-11 | 02 | 1 | BONUS-05 | unit | `npx vitest run tests/lib/scoring-bonus.test.ts` | ❌ W0 | ⬜ pending |
| 06-xx-12 | 02 | 1 | BONUS-06 | unit | `npx vitest run tests/lib/scoring-bonus.test.ts` | ❌ W0 | ⬜ pending |
| 06-xx-13 | 02 | 1 | BONUS-06 | unit | `npx vitest run tests/lib/scoring-bonus.test.ts` | ❌ W0 | ⬜ pending |
| 06-xx-14 | 03 | 2 | BONUS-07 | manual | visual check | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/lib/scoring-bonus.test.ts` — covers BONUS-03, BONUS-04, BONUS-05, BONUS-06 (pure function tests)
- [ ] `tests/actions/predictions.test.ts` — extend with bonus pick cases (BONUS-02)
- [ ] `tests/lib/bonus-rls.test.ts` — member RLS SELECT policy on bonus_schedule (BONUS-01)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sticky footer shows correct before/after bonus breakdown | BONUS-07 | UI render check | Submit predictions with bonus pick → wait for results → verify footer shows base + bonus + Double Bubble totals |
| Bonus pick star/highlight is obvious on mobile | BONUS-02 | UX check | Open gameweek page on phone → verify bonus pick interaction is clear and idiot-proof |
| Golden Glory visual distinction | BONUS-04 | Visual design | Open GW with Golden Glory bonus → verify it looks visually different from standard bonuses |
| Double Bubble week visual treatment | BONUS-05 | Visual design | Open a Double Bubble GW → verify doubling is clearly communicated |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
