---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + React Testing Library |
| **Config file** | `vitest.config.ts` (Wave 0 installs) |
| **Quick run command** | `npx vitest run --reporter=dot` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=dot`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | 01 | 0 | INFRA-03 | unit | `npx vitest run tests/api/keep-alive.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | AUTH-01 | unit | `npx vitest run tests/actions/auth.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | AUTH-02 | integration | `npx vitest run tests/middleware.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | AUTH-03 | smoke | manual (E2E browser) | manual-only | ⬜ pending |
| TBD | 01 | 1 | AUTH-04 | unit | `npx vitest run tests/actions/auth.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | AUTH-06 | unit | `npx vitest run tests/middleware.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | AUTH-07 | integration | `npx vitest run tests/routing.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 01 | 2 | ADMIN-01 | unit | `npx vitest run tests/actions/admin/members.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 01 | 2 | ADMIN-01 | unit | `npx vitest run tests/actions/admin/members.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | INFRA-01 | manual | — | manual-only | ⬜ pending |
| TBD | 01 | 1 | INFRA-02 | smoke | manual | manual-only | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — framework config
- [ ] `tests/setup.ts` — shared mocks (supabase client factory, Resend mock)
- [ ] `tests/actions/auth.test.ts` — covers AUTH-01, AUTH-04 (mock supabase client)
- [ ] `tests/actions/admin/members.test.ts` — covers ADMIN-01 (mock supabase admin client + Resend)
- [ ] `tests/middleware.test.ts` — covers AUTH-02, AUTH-06 (mock NextRequest with JWT fixtures)
- [ ] `tests/api/keep-alive.test.ts` — covers INFRA-03
- [ ] `tests/routing.test.ts` — covers AUTH-07
- [ ] Framework install: `npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Session persists across page refresh | AUTH-03 | Requires real browser cookie/session lifecycle | 1. Log in via magic link 2. Refresh page 3. Verify still logged in |
| All external deps are free tier | INFRA-01 | Configuration audit, not runtime behavior | Review Supabase plan, Vercel plan, Resend plan — confirm all free |
| App loads with 100 member rows | INFRA-02 | Requires seeded data + browser smoke test | Seed 100 profiles, load league table, verify render time < 3s |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
