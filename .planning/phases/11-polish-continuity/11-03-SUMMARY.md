---
phase: 11-polish-continuity
plan: 03
subsystem: public-explainer-and-hero
tags: [nextjs-16, public-page, inline-svg, anchor-nav, faq, tdd, mobile-audit-deferred]

requires:
  - phase: 11-polish-continuity
    plan: 01
    provides: PL-purple / PL-green @theme tokens, MemberLink component, toSlug helper
  - phase: 10-reports-export
    plan: 04
    provides: /standings public page (column-allowlisted), / home re-export baseline
  - phase: 01-foundation
    provides: Auth routes /login + /signup, (public) route group + layout
provides:
  - Public /how-it-works explainer page (9 sections + 4-item FAQ + anchor nav) — unauth-accessible
  - StandingsHero inline-SVG component wired on /standings
  - LandingHero inline-SVG component wired on / (landing, replaces thin re-export)
  - Footer "How it works" link (site-wide: public + member + admin layouts)
  - Signin "Learn how it works" link on /login page
  - 5 placeholder PNG hero screenshots committed under /public/how-it-works/ with TODO re-shoot note
  - docs/how-it-works-screenshot-runbook.md — one-page retake procedure
  - Mobile audit script for 5 highest-stakes flows (deferred to docs/FINAL_QA_CHECKLIST.md §14.1)
affects: [11-04-polish-copy]

tech-stack:
  added: []
  patterns:
    - "Pattern: Inline SVG hero — zero external assets, pure CSS-gradient background + viewBox-based silhouette path, w-full responsive"
    - "Pattern: JS-free FAQ — native <details>/<summary> disclosure, no client-side React state"
    - "Pattern: Public route under (public) route group — no auth middleware, no redirect, unauth-accessible"
    - "Pattern: Anchor nav with overflow-x-auto on mobile + sticky top on desktop — single responsive component"
    - "Pattern: Mobile audit deferred to master end-of-project QA sheet — matches Phase 8/9/10 deferral precedent (§7, §8, §10, §12)"
    - "Pattern: Placeholder PNGs committed with TODO re-shoot note — avoids broken-image icons during dev while runbook documents the capture procedure"

key-files:
  created:
    - src/app/(public)/how-it-works/page.tsx
    - src/app/(public)/how-it-works/_components/anchor-nav.tsx
    - src/app/(public)/how-it-works/_components/faq.tsx
    - src/components/hero/standings-hero.tsx
    - src/components/hero/landing-hero.tsx
    - public/how-it-works/README.md
    - public/how-it-works/prediction-form.png
    - public/how-it-works/gameweek-results.png
    - public/how-it-works/admin-bonus-panel.png
    - public/how-it-works/los-picker.png
    - public/how-it-works/pre-season-form.png
    - docs/how-it-works-screenshot-runbook.md
    - tests/app/how-it-works.test.tsx
    - .planning/phases/11-polish-continuity/11-03-SUMMARY.md
  modified:
    - src/app/(public)/standings/page.tsx
    - src/app/page.tsx
    - src/components/auth/signin-form.tsx
    - src/components/footer.tsx
    - docs/FINAL_QA_CHECKLIST.md

key-decisions:
  - "Public route (unauth-accessible) — placed under (public) route group so no middleware auth-redirect fires"
  - "JS-free FAQ via native <details>/<summary> — no hydration cost, no client component boundary, works with JS disabled"
  - "Anchor nav: sticky top-4 on desktop, overflow-x-auto + whitespace-nowrap on mobile — single responsive component, no duplication"
  - "Inline-SVG heroes with CSS gradient + viewBox stadium silhouette — zero external assets per CONTEXT.md (no image hosting, no CDN cost)"
  - "Landing hero SignIn CTA links to /login (not /signin) — matches repo convention from Phase 11 Plan 02 deviation"
  - "Placeholder PNGs (PL-purple solid 800x600 + filename overlay) committed to avoid broken-image icons; runbook documents real capture + re-shoot note added to deferred-items. Real screenshots to be captured post-launch via docs/how-it-works-screenshot-runbook.md"
  - "Footer link added to single shared footer component (not per-layout duplication) — appears on public, member, admin layouts because they all mount <Footer />"
  - "Mobile audit script merged into docs/FINAL_QA_CHECKLIST.md §14.1 (Phase 11 5-flow audit) — user approved 2026-04-12 deferral matching Phase 8/9/10 master-QA-sheet precedent"

requirements-completed: [UI-01, UI-02, UI-05]

duration: 45 min
completed: 2026-04-12
---

# Phase 11 Plan 03: Public Explainer + Hero + Mobile Audit Summary

**Public `/how-it-works` explainer page (9 sections + 4 FAQs + anchor nav), inline-SVG hero banners on `/standings` + `/`, footer + signin links, 5-flow mobile audit script merged into master QA sheet**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-04-12T21:05:00Z (Task 1 RED commit 4079739 landed shortly after)
- **Completed:** 2026-04-12T22:00:00Z (after checkpoint approval + master-QA merge)
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint, approved with deferral)
- **Files created:** 13 (page + 2 components + 2 heroes + 5 placeholder PNGs + runbook + README + test + this summary)
- **Files modified:** 5 (/standings, /, signin-form, footer, FINAL_QA_CHECKLIST)
- **Tests added:** 1 test file (tests/app/how-it-works.test.tsx) — 9 section headings + 9 anchor links + 4 FAQ questions asserted

## Accomplishments

- **`/how-it-works` public page** — 9 sections (Welcome, How to play, Scoring, Bonuses, Last One Standing, H2H Steals, Pre-Season Predictions, Prizes, FAQ) with matching ids, worked examples per CONTEXT.md (Arsenal 2-1 vs actual Arsenal 3-2 → 10pts; if predicted 3-2 → 30pts), Double Bubble (GW10/20/30) + Golden Glory formula (20 result / 60 score) explained, all 5 screenshot slots populated. No auth-gate — unauth-accessible per CONTEXT.md.
- **Anchor nav component** — 9 jump-links, sticky top-4 on desktop, horizontal-scroll (`overflow-x-auto whitespace-nowrap`) on mobile. Single responsive component, no JS.
- **FAQ component** — 4 native `<details>`/`<summary>` disclosures: postponed fixtures (George voids or reschedules), tie at top of gameweek (H2H steal triggers), change after kickoff (no, per-fixture lockout), past seasons (click your name anywhere → profile history).
- **Screenshot runbook** `docs/how-it-works-screenshot-runbook.md` — one-page procedure: npm run dev → login as Dave (admin) → 5 URLs with DevTools 1280x800 viewport → pngquant/TinyPNG optimise → commit to `/public/how-it-works/` with exact filenames.
- **StandingsHero inline-SVG** — PL-purple gradient background, "League Standings" title, "Live Premier League predictor standings" tagline, wired above existing table on `/standings`. viewBox-based, responsive, zero external assets.
- **LandingHero inline-SVG** — larger banner, "George's Predictor" wordmark, "Weekly Premier League predictions with your mates" tagline, sign-in CTA → /login (unauth), subtle green-tinted stadium silhouette along bottom edge. Seasons-ended_at branching placeholder in place for Plan 04 end-of-season wiring.
- **Landing page `/` rebuilt** — was a thin re-export of /standings (Phase 10 P04), now renders LandingHero + top-5 standings preview + "View full standings" CTA for unauth; auth flow preserved (redirect to /dashboard for members).
- **Footer "How it works" link** — added to single shared `<Footer />` component; appears on public, member, admin layouts by virtue of shared mount.
- **Signin link** — "New here? Learn how it works" subtle link added to signin form.
- **5 placeholder PNGs** committed to `/public/how-it-works/` (prediction-form.png, gameweek-results.png, admin-bonus-panel.png, los-picker.png, pre-season-form.png) — solid PL-purple backgrounds with filename overlay; README.md documents expected final screenshots; re-shoot TODO added to deferred-items.
- **Mobile audit script** (5 flows: /predictions/[gwNumber], LOS picker, /pre-season, /standings + hero, /members/[slug]) merged into `docs/FINAL_QA_CHECKLIST.md` §14.1 (Phase 11 audit) per user approval — deferred to end-of-project master QA sheet matching Phase 8/9/10 precedent. Proactive mobile-safe patterns documented (responsive Tailwind prefixes, overflow-x-auto, viewBox scaling, 44px tap targets).
- **Proactive mobile-safe fixes** already in place: every new component uses Tailwind responsive prefixes (sm:/md:/lg:) mobile-first; anchor nav overflow-x-auto on narrow viewports; WeeklyPointsChart scales via viewBox + w-full; MemberLink is full `<a>` not sub-span (44px tap via padding).
- **Tests: 588+ green; build green** — 33+ routes including new `/how-it-works` (static prerender candidate).

## Task Commits

1. **Task 1 RED: failing test for /how-it-works page** — `4079739` (test)
2. **Task 1 GREEN: /how-it-works page + anchor nav + FAQ + runbook** — `54d7c97` (feat)
3. **Task 2: Hero banners + landing + footer + signin + placeholder PNGs** — `83d7e7d` (feat)
4. **Task 3 (human-verify checkpoint):** User approved; mobile audit deferred to master QA sheet — no code commit for this task itself; merged into final docs commit below
5. **Plan metadata + master QA merge** — committed alongside this SUMMARY

## Files Created/Modified

**Created (13):**
- `src/app/(public)/how-it-works/page.tsx` — 9-section server component
- `src/app/(public)/how-it-works/_components/anchor-nav.tsx` — 9 jump-links, responsive
- `src/app/(public)/how-it-works/_components/faq.tsx` — 4 native disclosure items
- `src/components/hero/standings-hero.tsx` — inline SVG banner for /standings
- `src/components/hero/landing-hero.tsx` — inline SVG banner for /
- `public/how-it-works/README.md` — expected PNGs + spec (~800px, optimised)
- `public/how-it-works/prediction-form.png` — placeholder (TODO re-shoot)
- `public/how-it-works/gameweek-results.png` — placeholder (TODO re-shoot)
- `public/how-it-works/admin-bonus-panel.png` — placeholder (TODO re-shoot)
- `public/how-it-works/los-picker.png` — placeholder (TODO re-shoot)
- `public/how-it-works/pre-season-form.png` — placeholder (TODO re-shoot)
- `docs/how-it-works-screenshot-runbook.md` — one-page retake procedure
- `tests/app/how-it-works.test.tsx` — 9 sections + 9 nav links + 4 FAQs

**Modified (5):**
- `src/app/(public)/standings/page.tsx` — renders `<StandingsHero />` above existing table
- `src/app/page.tsx` — proper landing page (LandingHero + top-5 standings + CTA); seasons.ended_at branching hook present for Plan 04
- `src/components/auth/signin-form.tsx` — subtle "Learn how it works" link
- `src/components/footer.tsx` — "How it works" link added to shared footer
- `docs/FINAL_QA_CHECKLIST.md` — §14.1 Phase 11 mobile audit subsection added (5 flows, 25+ check items)

## Decisions Made

- **Route under (public) group**: `/how-it-works` placed in `src/app/(public)/` so no auth middleware fires. Matches `/standings` and `/login` placement. Required by CONTEXT.md: explainer must be linkable before registration.
- **Native FAQ disclosures**: used `<details>/<summary>` instead of a controlled-state React accordion. Zero JS, no hydration boundary, works without JavaScript enabled. Matches plan's explicit guidance.
- **Anchor nav dual-mode styling**: single component, `md:sticky md:top-4` on desktop, `overflow-x-auto whitespace-nowrap` on mobile. No per-viewport duplicate component tree.
- **Inline-SVG heroes**: viewBox-based, CSS gradient backgrounds, stadium silhouette via SVG path with opacity-15 fill. CONTEXT.md explicitly locked "no image hosting" — this approach has zero CDN/asset cost and renders identically across dev/prod/PDFs.
- **Landing page rebuild vs re-export**: Phase 10 P04 had `/` as a thin re-export of `/standings`. Plan 03 restores a proper landing (LandingHero + top-5 preview + CTA) while keeping auth redirect semantics intact. Seasons.ended_at branching hook left in place so Plan 04 can wire the end-of-season summary without restructuring.
- **Sign-in CTA → /login** (not /signin): Phase 11 Plan 02 already deviated from plan text for the same reason; continued the convention here. Whole repo uses /login.
- **Placeholder PNGs + TODO re-shoot**: Capturing real screenshots requires a running dev server with seeded data (Dave admin + mid-gameweek fixtures + bonus panel state). Placeholder PNGs avoid broken-image icons during initial deploy; runbook + deferred-items TODO document the re-shoot before public launch. This matches the plan's explicit fallback path.
- **Footer: single shared component**: rather than adding a link to three separate layout files, edited `src/components/footer.tsx` once — every layout that mounts `<Footer />` gets it for free. Verified via the existing footer-import pattern used in Phase 10 P04.
- **Mobile audit deferral to master QA sheet**: user approved — merged 5-flow script into `docs/FINAL_QA_CHECKLIST.md` §14.1 alongside Phase 8 §7-8, Phase 9 §10, Phase 10 §12 deferrals. Reason: pixel-perfect regression against real device emulation (iPhone 13, Pixel 5) is not meaningfully executable in a CI / automated context; proactive responsive patterns already applied during Plans 01-03 cover common regressions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Sign-in CTA link path /signin → /login**
- **Found during:** Task 2 (LandingHero CTA + signin-form link)
- **Issue:** Plan referenced `/signin`; entire codebase uses `/login` (middleware, auth routes). Phase 11 Plan 02 made the same deviation — followed that precedent.
- **Fix:** All new `/how-it-works` ↔ auth cross-links use `/login`.
- **Files modified:** `src/components/hero/landing-hero.tsx`, `src/components/auth/signin-form.tsx`
- **Committed in:** `83d7e7d`

**2. [Rule 3 - Blocking] Placeholder PNG fallback path per plan**
- **Found during:** Task 2 (screenshot capture step)
- **Issue:** Real screenshot capture requires running dev server + seeded multi-member state + Dave admin login + mid-gameweek fixture state + bonus-panel dialog open. Not practical in the executor context.
- **Fix:** Committed 5 placeholder PNGs (800x600 PL-purple backgrounds with filename overlay) per plan's explicit fallback guidance. Added TODO to deferred-items noting re-shoot required via `docs/how-it-works-screenshot-runbook.md` before public launch.
- **Files modified:** `public/how-it-works/*.png` (5 placeholders), deferred-items entry
- **Committed in:** `83d7e7d`

### Checkpoint Deferrals

**3. [Task 3 - human-verify] Mobile audit deferred to master QA sheet (user-approved)**
- **Checkpoint:** Task 3 (5-flow mobile audit at iPhone 13 / Pixel 5 viewports)
- **Resolution:** User approved deferral to `docs/FINAL_QA_CHECKLIST.md` §14.1 alongside Phase 8/9/10 precedents. Deferred, not skipped — surfaced in the end-of-project master QA walkthrough with explicit check items.
- **Proactive mitigation:** responsive Tailwind prefixes throughout new components; overflow-x-auto on the anchor nav; viewBox + w-full on the chart; 44px MemberLink tap targets; mobile-first breakpoints on every hero + section.
- **No code commit required for this task itself.**

---

**Total deviations:** 2 auto-fixed (2 blocking) + 1 approved checkpoint deferral
**Impact on plan:** Zero scope change. Checkpoint resolved with user-approved deferral matching established Phase 8/9/10 precedent.

## Issues Encountered

- **None functional.** Placeholder PNGs are the only pre-launch item; documented in deferred-items with a clear runbook and re-shoot trigger ("before public launch").
- **Checkpoint UX:** plan expected a potential fix-loop if mobile regressions found. User approved first-pass with deferral. No fix loop required. Noted for Phase 12+ planner: consider auto-deferring checkpoint:human-verify mobile audits to the master QA sheet at plan-time if proactive responsive patterns are in place.

## User Setup Required

**Before public launch (post-phase 11):**
- Follow `docs/how-it-works-screenshot-runbook.md` to capture 5 real screenshots replacing the placeholders. Dev server + seeded data + Dave admin login required. ~15-20 minutes.
- Walk through `docs/FINAL_QA_CHECKLIST.md` §14 Mobile and §14.1 Phase 11 5-flow mobile audit on a real iPhone + Android device (as the sheet specifies).

**No new env vars. No new DB migrations. No new dashboard configuration.**

## Next Phase Readiness

- **Plan 04 (polish + copy pass + end-of-season wiring)** unblocked: landing page rebuild is in place with a `seasons.ended_at` branching hook ready for Plan 04 to fill in the end-of-season summary card. Footer + signin links + hero components all stable. How It Works copy can get a final editorial pass if needed.
- **Blockers:** None.

## Self-Check: PASSED

Verified files:
- FOUND: src/app/(public)/how-it-works/page.tsx
- FOUND: src/app/(public)/how-it-works/_components/anchor-nav.tsx
- FOUND: src/app/(public)/how-it-works/_components/faq.tsx
- FOUND: src/components/hero/standings-hero.tsx
- FOUND: src/components/hero/landing-hero.tsx
- FOUND: public/how-it-works/README.md
- FOUND: public/how-it-works/prediction-form.png (placeholder)
- FOUND: public/how-it-works/gameweek-results.png (placeholder)
- FOUND: public/how-it-works/admin-bonus-panel.png (placeholder)
- FOUND: public/how-it-works/los-picker.png (placeholder)
- FOUND: public/how-it-works/pre-season-form.png (placeholder)
- FOUND: docs/how-it-works-screenshot-runbook.md
- FOUND: tests/app/how-it-works.test.tsx

Verified commits:
- FOUND: 4079739 (Task 1 RED)
- FOUND: 54d7c97 (Task 1 GREEN)
- FOUND: 83d7e7d (Task 2)

Master QA merge:
- FOUND: docs/FINAL_QA_CHECKLIST.md §14.1 "Phase 11 — 5-flow mobile audit" subsection (25+ check items)

Test suite: 588/588 green + 20/20 tests/app/ green (matches baseline stated in resume state).
Build: `npm run build` green, 33 routes (adds /how-it-works static prerender candidate).

Public route verification: `/how-it-works` renders unauth (no /login redirect), resolves via (public) route group.

---
*Phase: 11-polish-continuity*
*Completed: 2026-04-12*
