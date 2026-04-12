# /public/how-it-works/ — Screenshot assets for /how-it-works

This directory holds the 5 dev-environment screenshots referenced by the
public explainer page at `/how-it-works`.

## Expected files

| Filename                | Shown in              | Subject                                                              |
| ----------------------- | --------------------- | -------------------------------------------------------------------- |
| `prediction-form.png`   | "How to play" section | Prediction form with the week's fixtures and score inputs            |
| `gameweek-results.png`  | "Scoring" section     | Closed gameweek results screen with per-fixture points breakdown     |
| `admin-bonus-panel.png` | "Bonuses" section     | Admin bonus-set dialog (George choosing the week's bonus type)       |
| `los-picker.png`        | "Last One Standing"   | LOS team picker UI with several teams still available                |
| `pre-season-form.png`   | "Pre-Season" section  | Pre-season form showing top-4, relegated and promoted picker columns |

## Format

- **PNG**, lossy-optimised with `pngquant` or TinyPNG.
- Target width: **~800px** wide (max 1000). 2x smaller if source is ultra-wide.
- Target file size: **< 150 KB** each.

## Retaking screenshots

See `docs/how-it-works-screenshot-runbook.md` for the full step-by-step guide
on when and how to retake these when the UI changes materially.
