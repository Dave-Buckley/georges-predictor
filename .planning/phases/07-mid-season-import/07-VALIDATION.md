---
phase: 7
slug: mid-season-import
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-12
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.4 + jsdom |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npx vitest run tests/lib/import.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run the test file relevant to the changed code
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-xx-01 | 01 | 1 | DATA-01 | unit | `npx vitest run tests/lib/import.test.ts` | ❌ W0 | ⬜ pending |
| 07-xx-02 | 01 | 1 | DATA-01 | unit | `npx vitest run tests/lib/import.test.ts` | ❌ W0 | ⬜ pending |
| 07-xx-03 | 01 | 1 | DATA-01 | unit | `npx vitest run tests/lib/import.test.ts` | ❌ W0 | ⬜ pending |
| 07-xx-04 | 01 | 1 | DATA-01 | unit | `npx vitest run tests/lib/import.test.ts` | ❌ W0 | ⬜ pending |
| 07-xx-05 | 02 | 2 | ADMIN-08 | unit | `npx vitest run tests/actions/admin/import.test.ts` | ❌ W0 | ⬜ pending |
| 07-xx-06 | 02 | 2 | ADMIN-08 | unit | `npx vitest run tests/actions/admin/import.test.ts` | ❌ W0 | ⬜ pending |
| 07-xx-07 | 02 | 2 | ADMIN-08 | unit | `npx vitest run tests/actions/admin/import.test.ts` | ❌ W0 | ⬜ pending |
| 07-xx-08 | 02 | 2 | DATA-05 | unit | `npx vitest run tests/actions/admin/members.test.ts` | Extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/lib/import.test.ts` — covers parseImportText pure function (DATA-01)
- [ ] `tests/actions/admin/import.test.ts` — covers importMembers, clearImportedMembers (ADMIN-08)
- [ ] Extend `tests/actions/admin/members.test.ts` — DATA-05 regression check

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Imported names appear in signup dropdown | DATA-01 | E2E flow | Import members → open signup page → verify dropdown shows imported names |
| Registering member links to placeholder row | ADMIN-08 | E2E flow | Import → register with an imported name → verify starting_points inherited |
| Import preview shows correct data before confirming | ADMIN-08 | UI check | Paste CSV data → verify preview table is accurate |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
