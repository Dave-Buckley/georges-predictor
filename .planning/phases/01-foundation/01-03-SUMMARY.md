---
phase: 01-foundation
plan: 03
subsystem: auth
tags: [next.js, supabase, admin, auth, member-management, security-questions, react-hook-form, radix-ui, sha256, tdd]

requires:
  - phase: 01-foundation/01-01
    provides: supabase-client-utilities, route-protection-middleware, phase-1-database-schema
  - phase: 01-foundation/01-02
    provides: email-utility (sendEmail)

provides:
  - admin-email-password-login
  - member-approval-rejection-flow
  - member-crud-actions
  - admin-security-questions
  - admin-to-admin-email-recovery
  - admin-dashboard-shell
  - admin-sidebar-navigation

affects:
  - phase-03-predictions (admin predictions tab)
  - phase-05-admin-panel (gameweeks, bonuses, reports stubs exist)

tech-stack:
  added: []
  patterns:
    - TDD Red-Green with Vitest for server actions
    - SHA-256 via Web Crypto API for security question hashing (no bcrypt dependency)
    - Server actions with requireAdmin() guard pattern
    - Admin client (createAdminClient) for auth.admin.* operations, server client for getUser() auth checks
    - Radix Dialog for confirmation dialogs on destructive actions
    - react-hook-form for client-side forms without zodResolver (no @hookform/resolvers)

key-files:
  created:
    - src/lib/validators/admin.ts
    - src/lib/email.ts
    - src/actions/admin/auth.ts
    - src/actions/admin/members.ts
    - src/actions/admin/recovery.ts
    - src/app/(admin)/admin/login/page.tsx
    - src/app/(admin)/admin/layout.tsx
    - src/app/(admin)/admin/page.tsx
    - src/app/(admin)/admin/members/page.tsx
    - src/app/(admin)/admin/predictions/page.tsx
    - src/app/(admin)/admin/settings/page.tsx
    - src/components/admin/sidebar.tsx
    - src/components/admin/member-table.tsx
    - src/components/admin/member-actions.tsx
    - src/components/admin/notification-badge.tsx
    - src/components/admin/security-questions-setup.tsx
    - src/components/admin/admin-recovery.tsx
    - tests/actions/admin/members.test.ts
  modified:
    - tests/setup.ts (added listUsers mock to admin auth mock)

key-decisions:
  - "Security question answers hashed with SHA-256 (Web Crypto API), normalised to lowercase+trimmed — no bcrypt needed since personal questions, not passwords"
  - "zodResolver excluded — @hookform/resolvers not installed; client forms use react-hook-form native validation; Zod validation happens in server actions"
  - "recovery.ts requireAdmin() returns email alongside userId — needed for early self-reset guard without listUsers call"
  - "AdminRecovery component hardcodes other admin as the non-current one (current != other) — works for exactly 2 admins"
  - "Zod v4 uses .issues[] not .errors[] for error array — fixed across all server actions"

patterns-established:
  - "requireAdmin(): server action guard pattern — createServerSupabaseClient().auth.getUser() + role check, returns {userId, email} or {error}"
  - "createAdminClient() for auth.admin.* and DB writes that bypass RLS; createServerSupabaseClient() only for auth checks"
  - "Confirmation dialogs on all destructive actions (Radix Dialog) — George is not technical"

requirements-completed:
  - AUTH-05
  - AUTH-07
  - AUTH-08
  - ADMIN-01
  - ADMIN-06

duration: 9min
completed: "2026-04-11"
---

# Phase 1 Plan 3: Admin Auth, Member Management, and Account Recovery Summary

**Admin email+password login, full member CRUD (approve/reject/add/remove/edit) with Supabase auth.admin calls, SHA-256 security questions for admin account recovery, and complete admin dashboard shell with sidebar navigation**

## Performance

- **Duration:** 9 min
- **Started:** 2026-04-11T16:00:59Z
- **Completed:** 2026-04-11T16:10:44Z
- **Tasks:** 2 (TDD task + UI task)
- **Files created:** 18
- **Files modified:** 2

## Accomplishments

- Full admin auth flow: email+password login at /admin/login, admin role verified in both middleware and server action
- Complete member management CRUD: approve (magic link), reject (delete + rejection email + optional email block), add (createUser + update members row), remove (deleteUser FK cascade), edit email, set starting points
- SHA-256 security questions for admin account recovery — stored as hex hash, case-insensitive matching
- Admin-to-admin email recovery: George can reset Dave's email (or vice versa) by answering the other's security question
- Admin dashboard shell with responsive sidebar (desktop + mobile drawer), notification badges, action-focused landing page
- 22 Vitest tests covering all server actions — all passing

## Task Commits

1. **Task 1: TDD RED + GREEN — admin actions, validators, recovery** - `5e28b1e` (test) + `b4a28ec` (feat already present from Plan 02 run) — validators, email stub, auth/members/recovery actions, 22 tests
2. **Task 2: Admin UI pages and components** - `b1bdc13` (feat) — login page, layout, dashboard, members, predictions, settings, all components

## Files Created/Modified

- `src/lib/validators/admin.ts` — Zod schemas: adminLoginSchema, addMemberSchema, updateEmailSchema, securityQuestionSchema, adminRecoverySchema
- `src/lib/email.ts` — sendEmail and sendAdminSignupNotification using Resend
- `src/actions/admin/auth.ts` — adminLogin: email+password sign-in, secondary admin email guard, redirects to /admin
- `src/actions/admin/members.ts` — approveMember, rejectMember, addMember, removeMember, updateMemberEmail, setMemberStartingPoints (all gated by requireAdmin())
- `src/actions/admin/recovery.ts` — setSecurityQuestion, getSecurityQuestion, verifySecurityAnswer, resetOtherAdminEmail (SHA-256 hashing, early self-reset guard)
- `src/app/(admin)/admin/login/page.tsx` — Email+password login form, dark theme, "George's Predictor — Admin" branding
- `src/app/(admin)/admin/layout.tsx` — Admin layout with AdminSidebar, defense-in-depth admin role check
- `src/app/(admin)/admin/page.tsx` — Dashboard: pending approvals widget, member stats, recent notifications, coming-soon placeholders
- `src/app/(admin)/admin/members/page.tsx` — Member management with MemberTable + AddMemberDialog
- `src/app/(admin)/admin/predictions/page.tsx` — Placeholder: "Predictions will be available once fixtures are loaded"
- `src/app/(admin)/admin/settings/page.tsx` — SecurityQuestionsSetup + AdminRecovery with server-fetched admin user
- `src/components/admin/sidebar.tsx` — AdminSidebar: responsive (hamburger on mobile), disabled Coming Soon links, active state
- `src/components/admin/member-table.tsx` — Sortable table, filter tabs (All/Pending/Approved), status badges
- `src/components/admin/member-actions.tsx` — ApproveButton, RejectDialog (with block checkbox), EditEmailDialog, SetStartingPointsDialog, RemoveDialog, AddMemberDialog
- `src/components/admin/notification-badge.tsx` — Server component, unread count from admin_notifications
- `src/components/admin/security-questions-setup.tsx` — Shows current question if set, SHA-256 hashed answer, success message
- `src/components/admin/admin-recovery.tsx` — Resets other admin's email after security answer verification
- `tests/actions/admin/members.test.ts` — 22 tests covering all server actions

## Decisions Made

- SHA-256 via Web Crypto API for security question hashing — avoids bcrypt dependency, sufficient for personal security questions
- No `@hookform/resolvers` — not installed; Zod validation happens server-side only; client forms use react-hook-form native validation
- `requireAdmin()` in recovery.ts returns `{userId, email}` (not just `{userId}`) — email needed for early self-reset guard before listUsers call
- Settings page is async server component to pass `adminUserId` to SecurityQuestionsSetup and both admin emails to AdminRecovery

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Zod v4 uses .issues[] not .errors[]**
- **Found during:** Task 1 (addMember validation test)
- **Issue:** Zod v4 changed the error array property from `.errors` to `.issues`. `result.error.errors[0]` returned undefined causing TypeError
- **Fix:** Replaced all `result.error.errors[0]?.message` with `result.error.issues[0]?.message` across auth.ts, members.ts, recovery.ts
- **Files modified:** src/actions/admin/auth.ts, src/actions/admin/members.ts, src/actions/admin/recovery.ts
- **Verification:** All 22 tests pass
- **Committed in:** 5e28b1e

**2. [Rule 2 - Missing] Added listUsers mock to test setup**
- **Found during:** Task 1 (resetOtherAdminEmail tests)
- **Issue:** recovery.ts calls `supabaseAdmin.auth.admin.listUsers()` to find target admin by email. The mock setup.ts didn't include `listUsers` — calling it would throw
- **Fix:** Added `listUsers: vi.fn().mockResolvedValue({ data: { users: [] }, error: null })` to the admin auth mock in tests/setup.ts
- **Files modified:** tests/setup.ts
- **Committed in:** 5e28b1e

**3. [Rule 1 - Bug] Settings page passed no props to SecurityQuestionsSetup and AdminRecovery**
- **Found during:** Task 2 (build verification)
- **Issue:** Pre-existing settings/page.tsx called both components without required props (adminUserId, georgeEmail, daveEmail)
- **Fix:** Converted settings page to async server component, fetches current user, passes required props
- **Files modified:** src/app/(admin)/admin/settings/page.tsx
- **Committed in:** b1bdc13

**4. [Rule 1 - Bug] Layout imported Sidebar but export was AdminSidebar**
- **Found during:** Task 2 (build verification)
- **Issue:** Pre-existing admin layout imported `{ Sidebar }` but sidebar.tsx exports `{ AdminSidebar }`
- **Fix:** Updated import in layout.tsx to `AdminSidebar` and updated JSX usage
- **Files modified:** src/app/(admin)/admin/layout.tsx
- **Committed in:** b1bdc13

---

**Total deviations:** 4 auto-fixed (2 Rule 1 bugs, 1 Rule 1 bug in pre-existing code, 1 Rule 2 missing mock)
**Impact on plan:** All fixes necessary for correctness. No scope creep.

## Issues Encountered

None beyond the auto-fixed deviations above.

## Self-Check

Files created — key files verified:
- src/actions/admin/auth.ts — present
- src/actions/admin/members.ts — present
- src/actions/admin/recovery.ts — present
- src/lib/validators/admin.ts — present
- tests/actions/admin/members.test.ts — present
- src/app/(admin)/admin/login/page.tsx — present
- src/components/admin/sidebar.tsx — present

Commits verified:
- 5e28b1e — test(01-03): add failing tests for admin actions (TDD RED)
- b1bdc13 — feat(01-03): add admin UI — login, dashboard, member management, settings

Build: PASS (npm run build — all 12 routes rendered)
Tests: PASS (22/22 vitest tests pass)

## Self-Check: PASSED

## Next Phase Readiness

- Admin login and member management fully operational
- Plan 01-04 (member-facing UI: dashboard, login, signup UI for members) can proceed
- Plan 01-05 (deployment and environment setup) can proceed after 01-04
- Phase 3 (predictions) will populate the /admin/predictions placeholder

---
*Phase: 01-foundation*
*Completed: 2026-04-11*
