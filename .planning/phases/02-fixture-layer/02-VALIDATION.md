---
phase: 2
slug: fixture-layer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.4 + @testing-library/react 16 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/lib/fixtures.test.ts tests/actions/admin/fixtures.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/lib/fixtures.test.ts tests/actions/admin/fixtures.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 0 | FIX-01 | unit | `npx vitest run tests/actions/admin/fixtures.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 0 | FIX-02 | unit | `npx vitest run tests/lib/fixtures.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | FIX-01 | unit | `npx vitest run tests/actions/admin/fixtures.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-04 | 01 | 1 | FIX-02 | unit | `npx vitest run tests/lib/fixtures.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-05 | 01 | 1 | FIX-03 | unit | `npx vitest run tests/actions/admin/fixtures.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-06 | 01 | 2 | FIX-04 | unit | `npx vitest run tests/actions/admin/fixtures.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-07 | 01 | 2 | FIX-05 | unit | `npx vitest run tests/actions/admin/fixtures.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/lib/fixtures.test.ts` — stubs for FIX-02 (formatKickoffTime, isMidweekFixture, timezone edge cases)
- [ ] `tests/actions/admin/fixtures.test.ts` — stubs for FIX-01 (sync upsert), FIX-03 (lockout), FIX-04 (reschedule), FIX-05 (edit action)
- [ ] `src/lib/fixtures/` directory — create module (football-data-client.ts, sync.ts, timezone.ts)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Team crests render correctly | FIX-01 | Visual rendering from external SVG/PNG URLs | Load fixture list, verify badges appear next to team names |
| BST/GMT label visually shown on every fixture | FIX-02 | Visual layout check | View gameweek page, confirm every kick-off shows timezone label |
| Gameweek navigation (prev/next/dropdown) | FIX-02 | UI interaction flow | Click prev/next arrows, use dropdown, verify correct gameweek loads |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
