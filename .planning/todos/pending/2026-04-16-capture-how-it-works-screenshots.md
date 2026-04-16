---
created: 2026-04-16T14:33:11.815Z
title: Capture how-it-works screenshots
area: docs
files:
  - public/how-it-works/prediction-form.png
  - public/how-it-works/gameweek-results.png
  - public/how-it-works/admin-bonus-panel.png
  - public/how-it-works/los-picker.png
  - public/how-it-works/pre-season-form.png
  - docs/how-it-works-screenshot-runbook.md
  - src/app/(public)/how-it-works/page.tsx
---

## Problem

The 5 PNGs in `/public/how-it-works/` are placeholder blanks (all
exactly 2796 bytes, identical purple swatch). The `/how-it-works` page
references them via `<img>` tags in 5 sections (How to play, Scoring,
Bonuses, Last One Standing, Pre-Season), so visitors currently see
empty purple rectangles instead of UI screenshots.

Spotted on 2026-04-16 when viewing the live page on
georges-predictor.vercel.app — the Welcome → How to play section
showed a solid purple block where the prediction form should be.

## Solution

Follow `docs/how-it-works-screenshot-runbook.md` (~15 min):

1. `npm run dev` — start local server
2. DevTools viewport 1280×800, zoom 100%
3. Capture each shot via DevTools "Capture screenshot":
   - `prediction-form.png` — `/predictions/[gw]` main card list
   - `gameweek-results.png` — `/gameweeks/[N]` for completed GW
   - `admin-bonus-panel.png` — `/admin/bonuses` with set-bonus dialog open
   - `los-picker.png` — LOS widget on `/predictions/[gw]`
   - `pre-season-form.png` — `/pre-season` mid-fill-out
4. Optimise to <150 KB each via pngquant or TinyPNG
5. Drop into `/public/how-it-works/` (overwrite placeholders)
6. Commit `chore: refresh how-it-works screenshots`
7. Verify on `/how-it-works`

Alternative: capture against production (georges-predictor.vercel.app)
if local dev DB isn't seeded with the right state.
