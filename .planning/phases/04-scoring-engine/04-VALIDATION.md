---
phase: 04
slug: scoring-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| 04-01-01 | 01 | 1 | SCORE-03 | unit | `npx vitest run tests/lib/scoring.test.ts` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | SCORE-05 | unit | `npx vitest run tests/lib/scoring.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | SCORE-01 | unit | `npx vitest run tests/lib/fixtures.test.ts` | ✅ extend | ⬜ pending |
| 04-02-02 | 02 | 1 | SCORE-02 | unit | `npx vitest run tests/actions/admin/scoring.test.ts` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 2 | SCORE-04 | manual | browser verification | N/A | ⬜ pending |
| 04-03-02 | 03 | 2 | SCORE-06 | manual | browser verification | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/lib/scoring.test.ts` — stubs for SCORE-03 (pure scoring function) and SCORE-05 (recalculation with breakdown)
- [ ] `tests/actions/admin/scoring.test.ts` — stubs for SCORE-02 (override action auth + audit log)
- [ ] Extend `tests/lib/fixtures.test.ts` — add test for FINISHED-transition scoring trigger in sync pipeline

*Existing infrastructure covers framework setup — only test file stubs needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Points display inline on fixture cards | SCORE-04 | UI rendering requires browser | Load gameweek page with finished fixtures, verify points shown per prediction |
| Sticky gameweek total footer | SCORE-04 | UI layout requires browser | Scroll gameweek page, verify total stays visible |
| Members see calculated points after results | SCORE-06 | End-to-end requires Supabase + browser | Submit prediction, add result, refresh page, verify points appear |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
