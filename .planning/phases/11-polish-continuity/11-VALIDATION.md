---
phase: 11
slug: polish-continuity
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-12
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.4 + jsdom + @testing-library/react 16 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test:run -- <path>` |
| **Full suite command** | `npm run test:run` |
| **Estimated runtime** | ~50 seconds (full suite with Phase 11 additions) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:run -- <file-being-modified>`
- **After every plan wave:** Run `npm run test:run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 50 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | UI-01 schema | migration | node regex check on 012 SQL | ❌ W0 | ⬜ pending |
| 11-01-02 | 01 | 1 | UI-01, UI-04 | unit | `npm run test:run -- tests/components/team-badge.test.tsx tests/components/prediction-card.test.tsx` | ❌ W0 | ⬜ pending |
| 11-01-03 | 01 | 1 | — | unit | `npm run test:run -- tests/lib/slug.test.ts tests/components/member-link.test.tsx` | ❌ W0 | ⬜ pending |
| 11-01-04 | 01 | 1 | — | build | `npm run build` (site-wide MemberLink replacement smoke) | — | ⬜ pending |
| 11-02-01 | 02 | 2 | DATA-03 | unit | `npm run test:run -- tests/lib/profile-stats.test.ts` | ❌ W0 | ⬜ pending |
| 11-02-02 | 02 | 2 | DATA-03 | integration | `npm run test:run -- tests/app/member-profile.test.tsx` | ❌ W0 | ⬜ pending |
| 11-02-03 | 02 | 2 | UI-03 | unit | `npm run test:run -- tests/components/weekly-points-chart.test.tsx tests/components/home-rank-widget.test.tsx` | ❌ W0 | ⬜ pending |
| 11-03-01 | 03 | 3 | UI-05 | integration | `npm run test:run -- tests/app/how-it-works.test.tsx` | ❌ W0 | ⬜ pending |
| 11-03-02 | 03 | 3 | UI-01 | build | `npm run build` (hero SVGs render) | — | ⬜ pending |
| 11-03-03 | 03 | 3 | UI-02 | manual | Mobile audit — merged into FINAL_QA_CHECKLIST §13 | — | ⬜ pending |
| 11-04-01 | 04 | 4 | DATA-02 | unit | `npm run test:run -- tests/actions/season-rollover.test.ts` | ❌ W0 | ⬜ pending |
| 11-04-02 | 04 | 4 | DATA-02, UI-03 | integration | `npm run test:run -- tests/app/season-rollover.test.tsx tests/app/end-of-season.test.tsx` | ❌ W0 | ⬜ pending |
| 11-04-03 | 04 | 4 | UI-01..05, DATA-02, DATA-03 | manual | End-to-end polish + archive QA (FINAL_QA_CHECKLIST §13) | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `supabase/migrations/012_polish_continuity.sql` — teams.primary_color/secondary_color, members.favourite_team_id, seasons.ended_at, functional slug index on members.display_name
- [ ] `tests/components/team-badge.test.tsx`
- [ ] `tests/components/prediction-card.test.tsx`
- [ ] `tests/components/home-rank-widget.test.tsx`
- [ ] `tests/components/member-link.test.tsx`
- [ ] `tests/components/weekly-points-chart.test.tsx`
- [ ] `tests/lib/slug.test.ts`
- [ ] `tests/lib/profile-stats.test.ts`
- [ ] `tests/actions/season-rollover.test.ts`
- [ ] `tests/app/how-it-works.test.tsx`
- [ ] `tests/app/member-profile.test.tsx`
- [ ] `tests/app/season-rollover.test.tsx`
- [ ] `tests/app/end-of-season.test.tsx`
- [ ] No new deps — Tailwind v4 `@theme inline` in `src/app/globals.css` covers palette extension; SVG charts are pure React

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PL-feel visual polish (purple/green accents, team kit colours, hero SVGs) | UI-01 | Visual regression on real device + subjective "does it feel like a PL product" | Open `/` + `/standings` + `/gameweeks/[N]` + `/profile` on real phone + desktop, verify polished feel, consistent palette, crisp team crests |
| Full mobile audit across every core flow | UI-02 | Pixel-perfect responsive regression | iPhone 13 + Pixel 5 DevTools emulator THEN real phone: predictions, LOS picker, pre-season form, profile, admin LOS, admin pre-season, standings |
| How It Works page readability + screenshots | UI-05 | Subjective copy check + screenshot freshness | Read end-to-end as a new member. Verify screenshots match current UI. Check FAQ covers common questions |
| Season rollover wizard end-to-end | DATA-02 | Multi-step flow with confirmations — Claude can't judge UX friction | Run through all 8 wizard steps. Verify cancel-at-any-step works. Verify archive idempotent (run twice, same result) |
| End-of-season summary page emotional close | UI-01 | Subjective — does it celebrate the season | After archive, visit `/` unauth + as member. Verify champion spotlight, final table, LOS winners surface |
| Clickable usernames actually feel clickable | UI-01 | Hover states, tap targets, cursor affordance | Click every surface: league table, GW results, admin, H2H banner, LOS standings. All should navigate to /members/[slug] |
| Favourite-team picker works if shipped | UI-01 optional | Subjective | Toggle favourite team on profile, verify league table row accent matches |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 50s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
