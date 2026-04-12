# Phase 11 Deferred Items

Items discovered during execution that are out-of-scope per GSD boundary
rules. Tracked here for end-of-phase / pre-launch cleanup.

## 11-03 Plan

### Placeholder screenshots in `/public/how-it-works/`

**Status:** Placeholder solid-PL-purple PNGs (2.8 KB each, 800x600) committed
in Task 2 so the `/how-it-works` page renders without broken-image icons.

**Action required before launch:** Retake all 5 screenshots against the
real dev environment per the runbook at
`docs/how-it-works-screenshot-runbook.md`:

- [ ] `public/how-it-works/prediction-form.png`
- [ ] `public/how-it-works/gameweek-results.png`
- [ ] `public/how-it-works/admin-bonus-panel.png`
- [ ] `public/how-it-works/los-picker.png`
- [ ] `public/how-it-works/pre-season-form.png`

**Why deferred:** Claude cannot practically run a browser + DevTools
screenshot capture loop against a populated database. The page structure,
component interfaces, runbook, and placeholder binaries are all in place —
George / Dave can refresh the assets in ~15 minutes following the runbook.

**Verification:** After replacing each file, visit `/how-it-works` locally
and scroll — every `<img>` renders the real screenshot with readable UI.
