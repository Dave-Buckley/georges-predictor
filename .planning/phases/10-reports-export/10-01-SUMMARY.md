---
phase: 10-reports-export
plan: 01
subsystem: reports
tags: [xlsx, react-pdf, resend, supabase, reports, email, attachments]

requires:
  - phase: 01-foundation
    provides: Resend client, sendEmail/sendAdminSignupNotification, admin_notifications CHECK baseline
  - phase: 04-scoring-engine
    provides: prediction_scores, points_awarded union 0|10|30, recalcFixture idempotence pattern
  - phase: 05-admin-panel
    provides: bonus_awards tri-state (null/true/false) with points_awarded
  - phase: 06-bonus-system
    provides: computeDisplayTotal precedent (confirmed-only bonus aggregation)
  - phase: 08-last-one-standing-h2h
    provides: los_picks, los_competition_members, h2h_steals, tri-state outcome enum
  - phase: 09-pre-season-predictions
    provides: migration 009 admin_notifications CHECK ritual, pre-season export pattern (map-merge picks + awards)

provides:
  - Migration 011 — gameweeks.kickoff_backup_sent_at + reports_sent_at, members.email_weekly_personal + email_weekly_group, member_report_log table with UNIQUE(member_id, gameweek_id, report_type)
  - Pinned dependencies — xlsx@0.18.5 (exact, avoids v0.19+ paid license) + @react-pdf/renderer@^4.3.0 (server-externalised)
  - src/lib/reports/_data/gather-gameweek-data.ts — one aggregator feeding all 4 artifact renderers (personal PDF, group PDF, admin XLSX, kickoff backup)
  - src/lib/email/client.ts — lazy Resend singleton + DEFAULT_FROM
  - src/lib/email/send-attachments.ts — Buffer → base64 attachment send helper
  - tests/reports/fixtures/gameweek-data.ts — mockGameweekData() + mockSupabaseFrom() shared across all Phase 10 tests
  - tests/reports/fixtures/resend-mock.ts — payload-recording Resend mock for orchestration tests

affects:
  - 10-02 (PDF + XLSX renderers — consume GameweekReportData)
  - 10-03 (orchestration + cron — consumes gatherGameweekData + sendWithAttachments)
  - 10-04 (member profile email toggles — consumes email_weekly_* columns)

tech-stack:
  added:
    - xlsx@0.18.5 (SheetJS — exact pin; v0.19+ paid license)
    - '@react-pdf/renderer@^4.3.0 (React → PDF renderer, server-externalised)'
  patterns:
    - Parallel Promise.all admin-client fetch + pure shapeData transform (testable in isolation)
    - Idempotent send ledger via UNIQUE(member_id, gameweek_id, report_type)
    - Graceful Resend fallback — missing RESEND_API_KEY returns error object, never throws
    - serverExternalPackages registration as preemptive Vercel safety net

key-files:
  created:
    - supabase/migrations/011_reports.sql
    - src/lib/reports/_data/gather-gameweek-data.ts
    - src/lib/email/client.ts
    - src/lib/email/send-attachments.ts
    - tests/reports/fixtures/gameweek-data.ts
    - tests/reports/fixtures/resend-mock.ts
    - tests/reports/gather-data.test.ts
    - tests/reports/send-attachments.test.ts
  modified:
    - package.json (pinned xlsx + react-pdf)
    - package-lock.json
    - next.config.ts (serverExternalPackages)
    - src/lib/supabase/types.ts (GameweekRow + MemberRow extensions, MemberReportLogRow, ReportType, new admin_notifications types)
    - src/lib/email.ts (refactored to delegate to getResend())

key-decisions:
  - xlsx pinned with --save-exact (0.18.5, NO caret) — v0.19+ is paid license
  - serverExternalPackages registered for @react-pdf/renderer preemptively — prevents the "yoga.wasm subpath not defined" class of Vercel errors before they surface
  - shapeData exported as a pure transform — downstream tests can assert transform logic without mocking the admin client
  - h2h_steals filter via .or(detected_in_gw_id.eq.${gw},resolves_in_gw_id.eq.${gw}) — reports must surface both newly detected AND resolving-this-week rows
  - Weekly points aggregation excludes pending bonuses (awarded=null/false) — matches computeDisplayTotal precedent from Phase 6
  - Standings tiebreak on displayName alpha (after totalPoints DESC) — determinism for test assertions and avoiding spurious rank swaps
  - getResend() lazy singleton + graceful null return — matches Phase 1 sendEmail contract verbatim
  - Refactor sendEmail to delegate rather than holding its own Resend instance — avoids two Resend clients in the same process

patterns-established:
  - Phase-10 test fixture layout — tests/reports/fixtures/ holds shared mocks imported by every report test
  - Admin-client bypass for backgroundable aggregators — reports orchestrator will run as a cron with no session
  - Idempotent ledger UNIQUE constraint pattern — any retryable send MUST have a UNIQUE composite to prevent double-sends

requirements-completed:
  - RPT-01
  - RPT-02
  - RPT-03
  - RPT-04
  - RPT-05
  - RPT-06
  - RPT-07
  - DATA-04

duration: 20min
completed: 2026-04-12
---

# Phase 10 Plan 01: Reports Foundation Summary

**Pinned xlsx + react-pdf, migration 011 for report tracking and per-member email prefs, typed GameweekReportData aggregator with parallel admin-client fetch, and Buffer→base64 Resend attachment helper — wave-0 groundwork for all 4 report artifacts.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-04-12T18:27:00Z
- **Completed:** 2026-04-12T18:47:29Z
- **Tasks:** 3
- **Files modified:** 12 (5 created, 7 modified — counting package-lock.json)

## Accomplishments

- Pinned dependency set ready for renderers (xlsx@0.18.5 exact, @react-pdf/renderer server-externalised)
- Migration 011 applied-as-file with gameweeks/members extensions, `member_report_log` ledger (UNIQUE composite + RLS), and 3 new admin notification types
- `gatherGameweekData(gwId)` ships one parallel round-trip aggregator feeding all 4 downstream artifact renderers — pure `shapeData` transform broken out for test granularity
- Attachment-send helper handles Buffer→base64, graceful missing-key fallback, and Resend error surfacing
- Shared test fixtures (mockGameweekData, mockSupabaseFrom, createResendMock) ready for Plans 02-04 to import
- Full test suite: **454/454 green** (+15 from the baseline 439)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install deps, configure Next, apply migration 011** — `d82cddb` (chore)
2. **Task 2: gatherGameweekData aggregator (TDD)**
   - RED: `b7af114` (test — 8 failing behavioural tests + 1 shapeData test)
   - GREEN: `2ab0be8` (feat — implementation; all 9 pass)
3. **Task 3: Resend client wrapper + attachment-send helper (TDD)** — `f1b83f9` (feat — 6 tests + implementation combined, Resend mock construction pattern sorted out inline)

## Files Created/Modified

### Created
- `supabase/migrations/011_reports.sql` — report tracking schema + admin_notifications CHECK extension
- `src/lib/reports/_data/gather-gameweek-data.ts` — aggregator + shapeData
- `src/lib/email/client.ts` — lazy Resend singleton + DEFAULT_FROM
- `src/lib/email/send-attachments.ts` — Buffer→base64 attachment send helper
- `tests/reports/fixtures/gameweek-data.ts` — mockGameweekData + mockSupabaseFrom
- `tests/reports/fixtures/resend-mock.ts` — createResendMock payload recorder
- `tests/reports/gather-data.test.ts` — 9 tests
- `tests/reports/send-attachments.test.ts` — 6 tests
- `.planning/phases/10-reports-export/deferred-items.md` — pre-existing lint findings log

### Modified
- `package.json` + `package-lock.json` — xlsx@0.18.5 exact, @react-pdf/renderer@^4.3.0
- `next.config.ts` — `serverExternalPackages: ['@react-pdf/renderer']`
- `src/lib/supabase/types.ts` — GameweekRow + MemberRow extensions, `MemberReportLogRow`, `ReportType` union, 3 new `AdminNotificationType` members
- `src/lib/email.ts` — `sendEmail` delegates to `getResend()`; `sendAdminSignupNotification` unchanged

## Decisions Made

See frontmatter `key-decisions`. Highlights:

- xlsx pinned exact (0.18.5) — v0.19+ paid license
- `serverExternalPackages` registered preemptively — prevents the yoga/fontkit server-bundler class of errors before they surface on Vercel
- `shapeData` exported as pure transform — downstream tests (Plans 02-04) can exercise shaping without mocking admin client
- Weekly points aggregation excludes pending bonuses — matches `computeDisplayTotal` precedent from Phase 6
- `h2h_steals` filter via `.or(detected_in_gw_id.eq.${gw},resolves_in_gw_id.eq.${gw})` — surfaces both newly-detected and resolving-this-week
- Standings tiebreak on `displayName` alpha — determinism for tests and display

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Resend mock construction pattern (vi.mock factory vs constructor)**
- **Found during:** Task 3 (send-attachments tests RED→GREEN)
- **Issue:** Initial `vi.mocked(Resend).mockImplementation(() => mock.client)` failed with `not a constructor` because `getResend()` uses `new Resend(...)`. Arrow-function mock implementations are not construct-callable.
- **Fix:** Switched to classic `function (this: unknown) { Object.assign(this as object, mock.client) }` pattern — works with `new`. Applied across all 3 affected tests.
- **Files modified:** `tests/reports/send-attachments.test.ts` (3 call sites)
- **Verification:** All 6 tests pass; full 454-test suite green.
- **Committed in:** `f1b83f9` (Task 3 commit — combined with initial implementation rather than a separate pre-commit since the issue only surfaced during GREEN).

---

**Total deviations:** 1 auto-fixed (Rule 3 - Blocking)
**Impact on plan:** No scope creep; fix was purely a test-infrastructure blocker. Implementation code unchanged.

## Issues Encountered

- **Pre-existing lint noise surfaced on `npm run lint`.** 18 errors + 16 warnings in files unrelated to Phase 10 (Phase 8 `src/lib/los/round.ts`, Phase 1 `tests/actions/auth.test.ts`, Phase 2/4 test files). Per GSD scope-boundary rules, logged to `.planning/phases/10-reports-export/deferred-items.md` and **not** fixed in this plan. Phase 10 code itself is lint-clean.
- **Vercel plugin skill suggestions auto-triggered** (`next-cache-components`, `next-upgrade`, `vercel-storage`) during `Read` calls — none applicable to this task (only adding `serverExternalPackages`, not upgrading Next or using Vercel-native storage). Acknowledged and proceeded with established project patterns.

## User Setup Required

**Phase 10 depends on Resend configuration for live sends.** `RESEND_API_KEY` + `EMAIL_FROM` are already wired from Phase 1; Plan 01 adds no new env vars. Plan 02/03 will surface the full Phase 10 `USER-SETUP.md` if required (e.g., `ADMIN_EMAIL_DAVE` for redundancy on the admin XLSX + kickoff backup).

## Next Phase Readiness

- **Plan 02 (renderers)** can now `import { gatherGameweekData } from '@/lib/reports/_data/gather-gameweek-data'` and consume the typed `GameweekReportData`. The xlsx + @react-pdf/renderer packages are installed and ready.
- **Plan 03 (orchestration + cron)** can consume `sendWithAttachments` directly; idempotency guaranteed by `member_report_log` UNIQUE composite.
- **Plan 04 (member profile)** can read/write `members.email_weekly_personal` + `members.email_weekly_group` via the extended `MemberRow` type.
- **Zero blockers** for Wave 2 — build clean, 454 tests green, types consistent.

## Self-Check: PASSED

All 8 expected artifact files present on disk. All 4 task commits (d82cddb, b7af114, 2ab0be8, f1b83f9) present in git history.

---
*Phase: 10-reports-export*
*Completed: 2026-04-12*
