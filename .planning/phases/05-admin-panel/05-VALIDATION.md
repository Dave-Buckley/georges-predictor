---
phase: 5
slug: admin-panel
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-12
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.4 + jsdom |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npx vitest run tests/actions/admin/bonuses.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run the test file relevant to the changed action
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-xx-01 | 01 | 1 | ADMIN-02 | unit | `npx vitest run tests/actions/admin/bonuses.test.ts` | ❌ W0 | ⬜ pending |
| 05-xx-02 | 01 | 1 | ADMIN-02 | unit | `npx vitest run tests/actions/admin/bonuses.test.ts` | ❌ W0 | ⬜ pending |
| 05-xx-03 | 01 | 1 | ADMIN-03 | unit | `npx vitest run tests/actions/admin/bonuses.test.ts` | ❌ W0 | ⬜ pending |
| 05-xx-04 | 01 | 1 | ADMIN-05 | unit | `npx vitest run tests/actions/admin/bonuses.test.ts` | ❌ W0 | ⬜ pending |
| 05-xx-05 | 02 | 1 | ADMIN-07 | unit | `npx vitest run tests/actions/admin/prizes.test.ts` | ❌ W0 | ⬜ pending |
| 05-xx-06 | 03 | 2 | ADMIN-09 | unit | `npx vitest run tests/actions/admin/gameweeks.test.ts` | ❌ W0 | ⬜ pending |
| 05-xx-07 | 03 | 2 | ADMIN-09 | unit | `npx vitest run tests/actions/admin/gameweeks.test.ts` | ❌ W0 | ⬜ pending |
| 05-xx-08 | 03 | 2 | ADMIN-09 | unit | `npx vitest run tests/actions/admin/gameweeks.test.ts` | ❌ W0 | ⬜ pending |
| 05-xx-09 | — | — | ADMIN-04 | unit | `npx vitest run tests/actions/admin/scoring.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/actions/admin/bonuses.test.ts` — stubs for ADMIN-02, ADMIN-03, ADMIN-05
- [ ] `tests/actions/admin/prizes.test.ts` — stubs for ADMIN-07
- [ ] `tests/actions/admin/gameweeks.test.ts` — stubs for ADMIN-09

*Existing `tests/actions/admin/scoring.test.ts` covers ADMIN-04 — no gap there.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Bonus visible to members immediately after George confirms | ADMIN-02 | UI render check | Set bonus → open member GW page → verify bonus type shown |
| Dashboard action cards appear at correct times | ADMIN-02/09 | UI integration | Check dashboard shows correct action items based on GW state |
| Pre-close summary displays correct totals | ADMIN-09 | UI render check | Close GW → verify summary shows correct fixture/points/bonus counts |
| Email notifications sent on triggers | ADMIN-02/07/09 | External service | Trigger events → check Resend logs for correct emails |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
