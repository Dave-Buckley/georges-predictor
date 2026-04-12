# Milestones

## v1.0 MVP (Shipped: 2026-04-12)

**Delivered:** George's Predictor — a full-stack Premier League prediction competition platform for George and his ~50 WhatsApp friends, replacing a decade of manual spreadsheet admin. Zero ongoing cost (Vercel Hobby + Supabase free + Resend free + football-data.org free).

**Timeline:** 2026-04-11 → 2026-04-12 (~30 hours)
**Phases:** 11 of 11 complete
**Plans:** 37 of 37 shipped
**Commits:** 233 total (78 feat, 28 test, rest docs/chore)
**Code:** ~29,000 LOC TypeScript/TSX + ~15,800 LOC tests + 12 Supabase migrations
**Tests:** 614/614 passing at ship

### Key accomplishments by phase

1. **Foundation (Phase 1)** — Next.js 16 App Router scaffold, Supabase auth (browser/server/admin clients), RLS-secured schema, Resend notifications on signup, two-admin setup (George + Dave).
2. **Fixture Layer (Phase 2)** — football-data.org sync, server-side per-fixture kickoff lockout, admin overrides, timezone-correct BST/GMT handling, postponed-match workflow.
3. **Predictions (Phase 3)** — Member submission flow, two-layer lockout, visibility gating at kickoff per fixture, admin all-predictions view with RLS bypass.
4. **Scoring Engine (Phase 4)** — Pure `calculatePoints` (0/10/30), idempotent recalculation on FINISHED transition, DB CHECK-enforced point range, scored-fixture gate for provisional points.
5. **Admin Panel (Phase 5)** — Approvals queue, bonus-type picker, Double Bubble toggle, email notification toggles, prize management, urgency-ordered dashboard cards.
6. **Bonus System (Phase 6)** — Extensible bonus evaluator (Golden Glory 20/60, Jose Park the Bus 0-0/1-0/0-1), two-phase confirmation (member to George), Double Bubble ×2 display formula, pending bonuses excluded.
7. **Mid-Season Import (Phase 7)** — Spreadsheet import (starting points + pre-season picks), case-insensitive linking on registration, late-joiner flow, placeholder-member trigger.
8. **Last One Standing & H2H (Phase 8)** — LOS picker + elimination + 20-team cycle + reset, H2H tie detection + following-week resolution + split, admin override pages, partial unique index for one-active-competition.
9. **Pre-Season Predictions (Phase 9)** — 12-pick form, 30pt/correct flat scoring, flag-only bonuses (George decides), DB-backed Championship list with one-button end-of-season rollover, guided admin flow.
10. **Reports & Export (Phase 10)** — Weekly group/personal PDF + admin XLSX via Resend, public `/standings` page, member `/profile` opt-out, full-season XLSX export as Route Handler, kickoff-time backup email to both admins (disaster recovery).
11. **Polish & Continuity (Phase 11)** — PL purple/green palette + team kit colour accents, clickable usernames site-wide (MemberLink), member profile with cross-season stats + SVG chart, public `/how-it-works` explainer, season-rollover wizard (8 steps), end-of-season summary page, mobile-safe across all flows.

### Pre-launch audit fixes (included in v1.0)

- `bonus_awards.points_awarded` DB CHECK constraint (0, 20, 60) — prevents bad manual edits via Supabase direct
- Double Bubble ×2 display multiplier inside `gather-gameweek-data.ts` — PDFs + XLSX now agree on weekly totals for GW10/20/30

### Key decisions

- **Stack:** Next.js 16 App Router + Supabase (Postgres + Auth + RLS) + Vercel Hobby + Resend — all free tier
- **Lockout everywhere** server-enforced via timestamps — never trust the client
- **Two-phase confirmation** (member to George) for every scoreable action (bonus, prize, pre-season award)
- **Column versioning** for season archive — no physical data move, zero loss risk
- **Pure calculators + orchestrators** pattern across scoring, bonuses, LOS, H2H, pre-season
- **Team kit colours** hardcoded via Wikipedia hex — no PL logo licensing
- **Email** on Resend shared sender — upgrade to custom domain if/when app graduates

### Deferred QA (master sheet)

All manual QA for Phases 8, 9, 10, 11 merged into `docs/FINAL_QA_CHECKLIST.md` — single pre-launch gate, ~18 sections, 400+ check items. User QAs everything end-to-end before shipping to real members.

### Pre-launch todos (non-code)

- Apply all migrations (001–012) to production Supabase
- Set `RESEND_API_KEY`, `ADMIN_EMAIL_GEORGE`, `ADMIN_EMAIL_DAVE`, `CRON_SECRET` in Vercel env
- Walk `docs/FINAL_QA_CHECKLIST.md` end-to-end
- Manually enter GW32 scores via admin fixtures page (imported data is GW31-current; football-data.org sync takes over from GW33)
- Add "Bucks" (Dave) as a member with points matching the current league leader
- Re-shoot 5 `/how-it-works` screenshots per `docs/how-it-works-screenshot-runbook.md`

### Tech debt / known gaps

None critical. Placeholder `/how-it-works` screenshots flagged in `.planning/phases/11-polish-continuity/deferred-items.md`.

---
