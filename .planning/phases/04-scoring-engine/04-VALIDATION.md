---
phase: 04
slug: scoring-engine
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-12
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.4 |
| **Config file** | `vitest.config.ts` (exists) |
| **Quick run command** | `npx vitest run tests/lib/scoring.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/lib/scoring.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | SCORE-03 | unit | `npx vitest run tests/lib/scoring.test.ts` | W0 (created by task) | pending |
| 04-01-02 | 01 | 1 | SCORE-05 | unit | `npx vitest run tests/lib/scoring.test.ts` | W0 (created by task) | pending |
| 04-02-01 | 02 | 2 | SCORE-01 | unit | `npx vitest run tests/lib/sync-scoring.test.ts` | W0 (created by task) | pending |
| 04-02-02 | 02 | 2 | SCORE-02 | unit | `npx vitest run tests/actions/admin/scoring.test.ts` | W0 (created by task) | pending |
| 04-03-01 | 03 | 2 | SCORE-04 | manual | browser verification | N/A | pending |
| 04-03-02 | 03 | 2 | SCORE-06 | manual | browser verification | N/A | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

All test files are created by their respective tasks (TDD plan 01 creates test file first in RED phase; plan 02 tasks create their test files as part of the task action). No separate Wave 0 stub step needed.

- [x] `tests/lib/scoring.test.ts` — created by Plan 01 Task 1 (TDD RED phase, before implementation)
- [x] `tests/actions/admin/scoring.test.ts` — created by Plan 02 Task 2 (alongside server actions)
- [x] `tests/lib/sync-scoring.test.ts` — created by Plan 02 Task 1 (alongside sync extension)

*All test files are created within their respective tasks -- no orphan test gap.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Points display inline on fixture cards | SCORE-04 | UI rendering requires browser | Load gameweek page with finished fixtures, verify points shown per prediction |
| Fixed gameweek total footer | SCORE-04 | UI layout requires browser | Scroll gameweek page, verify total stays visible; check stacking with submit button on mobile |
| Members see calculated points after results | SCORE-06 | End-to-end requires Supabase + browser | Submit prediction, add result, refresh page, verify points appear |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or test files created within the task
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (all test files created by their tasks)
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
