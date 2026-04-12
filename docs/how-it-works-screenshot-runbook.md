# How It Works — Screenshot Runbook

This runbook captures the 5 screenshots shown on the public `/how-it-works`
explainer page. Retake them whenever the corresponding UI changes
materially (new layout, renamed controls, different colour scheme).

**Time required:** ~15 minutes end-to-end.

---

## Prerequisites

1. Local dev environment running against a populated database (test data
   with at least one completed gameweek, an active LOS competition, and
   some pre-season picks on file).
2. Logged in as an admin account (so you can see every panel). Dave's
   admin test account is the default choice.
3. Chrome or Edge with DevTools available.
4. `pngquant` installed (or a TinyPNG account ready) for optimisation.

## Step 1 — Start the dev server

```bash
npm run dev
```

Wait for `Ready in Xs` then open the app in your browser.

## Step 2 — Configure the browser viewport

Open DevTools (F12). Click the device-toolbar icon (Ctrl/Cmd+Shift+M) and
set a custom viewport of **1280 x 800** (desktop). Zoom set to 100%. We
want desktop-quality screenshots, not mobile.

## Step 3 — Capture each screenshot

Each capture uses DevTools' **"Capture screenshot"** command (Ctrl/Cmd+Shift+P
→ type "screenshot" → select "Capture area screenshot" or "Capture full size
screenshot" depending on the shot).

### 3a. `prediction-form.png`

- Navigate: `/predictions/[current-gw]` (or whichever GW has open fixtures)
- Screenshot the main prediction card list with at least 5–10 fixtures visible.
- Include the sticky "Save predictions" bar at the bottom if possible.

### 3b. `gameweek-results.png`

- Navigate: `/gameweeks/[N]` where N is a completed gameweek with scored predictions
- Screenshot the per-fixture results area showing your prediction, the actual score,
  and the points awarded column.

### 3c. `admin-bonus-panel.png`

- Navigate: `/admin/bonuses` (admin-only)
- Click "Set this week's bonus" to open the bonus dialog.
- Screenshot the dialog showing the list of bonus types with one selected.
- Close the dialog once captured.

### 3d. `los-picker.png`

- Navigate: `/predictions/[current-gw]` (same as 3a — LOS picker lives on this page when an LOS comp is active).
- Scroll to the LOS picker widget.
- Screenshot the team grid with a clear visual of used vs available teams.

### 3e. `pre-season-form.png`

- Navigate: `/pre-season` (or `/admin/pre-season/[member-slug]` for a pre-populated form)
- Ensure the 3 sections (Top 4, Relegated, Promoted) are visible.
- Screenshot mid-fill-out — a few picks made, the Championship dropdown open if possible.

## Step 4 — Optimise

Each raw capture will typically be 200–500 KB. Shrink them:

```bash
# Using pngquant (CLI)
pngquant --quality=65-80 --ext .png --force *.png

# Or drop them into https://tinypng.com and re-download.
```

Target: < 150 KB each. Inspect after — make sure text is still legible.

## Step 5 — Commit

Place the optimised files in `/public/how-it-works/` with the exact filenames
from the table in that directory's README.md:

```bash
git add public/how-it-works/*.png
git commit -m "chore(11-03): refresh how-it-works screenshots"
```

## Step 6 — Verify

```bash
npm run dev
# Visit http://localhost:3000/how-it-works and scroll through
# — every screenshot renders inline, nothing broken-image-icons.
```

---

## Troubleshooting

- **Images look huge** — DevTools viewport was wrong. Re-capture at 1280 wide.
- **Text is blurry** — Don't resize after capture. Use native DevTools capture at
  100% zoom.
- **File size still > 200 KB after optimisation** — Try `pngquant --quality=55-70` or
  crop to just the essential UI area before optimising.
