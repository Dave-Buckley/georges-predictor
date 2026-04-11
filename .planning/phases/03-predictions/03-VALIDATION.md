---
phase: 3
slug: predictions
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.4 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/actions/predictions.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/actions/predictions.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 0 | PRED-01 | unit | `npx vitest run tests/actions/predictions.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 0 | PRED-02 | unit | `npx vitest run tests/actions/predictions.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 0 | PRED-03 | unit | `npx vitest run tests/actions/predictions.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-04 | 01 | 0 | PRED-04 | unit | `npx vitest run tests/actions/predictions.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-05 | 01 | 0 | PRED-05 | unit | `npx vitest run tests/actions/predictions.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-06 | 01 | 0 | PRED-01 | unit | `npx vitest run tests/lib/predictions.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/actions/predictions.test.ts` — stubs for PRED-01 through PRED-05 (submitPredictions server action)
- [ ] `tests/lib/predictions.test.ts` — unit tests for predictionEntrySchema validation (score range, UUID format)

*Existing `tests/setup.ts` infrastructure covers all mocking needs — no framework changes required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Stepper +/- buttons work on mobile | PRED-01 | Touch interaction requires real device/emulator | Open gameweek page on mobile, tap +/- buttons, verify score increments/decrements |
| Prediction reveal at kick-off | PRED-03 | Time-dependent RLS policy requires real Supabase | Set fixture kick-off to past, verify other member predictions become visible |
| Admin "All Predictions" table renders correctly | PRED-04 | Layout/visual verification | Open admin panel > All Predictions, verify member rows × fixture columns grid |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
