---
phase: 01-foundation
plan: 02
subsystem: auth-ui
tags: [next.js, supabase, auth, signup, resend, react-hook-form, zod, radix-ui, landing-page]
one-liner: "Premier League-branded landing page, idiot-proof signup flow with name picker dropdown, Zod validation schemas, Resend email notifications to George on new signup, and all auth server actions with magic link OTP"
dependency-graph:
  requires:
    - next.js-project-scaffold
    - supabase-client-utilities
    - phase-1-database-schema
  provides:
    - member-signup-flow
    - auth-server-actions
    - resend-email-utility
    - zod-auth-validators
    - branded-landing-page
  affects:
    - route-protection-middleware
tech-stack:
  added:
    - "@hookform/resolvers@^3.x"
  patterns:
    - react-hook-form + zodResolver with Zod v4 (use result.error.issues not result.error.errors)
    - Server action + FormData pattern for signUpMember/requestMagicLink
    - Fire-and-forget email (sendAdminSignupNotification) — email failure never blocks signup
    - Radix Select with portal for accessible name picker dropdown
    - Route group (public) with shared layout for landing/login/signup
    - createClient<any> for admin/server Supabase clients until supabase gen types is run
key-files:
  created:
    - src/lib/validators/auth.ts
    - src/lib/email.ts
    - src/actions/auth.ts
    - src/app/(public)/page.tsx
    - src/app/(public)/signup/page.tsx
    - src/components/auth/signup-form.tsx
    - src/components/auth/name-picker.tsx
    - tests/actions/auth.test.ts
  modified:
    - vitest.config.ts
    - package.json
    - src/lib/supabase/admin.ts
    - src/lib/supabase/server.ts
    - src/actions/admin/members.ts
  deleted:
    - src/app/page.tsx
decisions:
  - "email_opt_in has no schema-level default — default (true) lives in the form component defaultValues so zodResolver types resolve cleanly with react-hook-form"
  - "createAdminClient and createServerSupabaseClient use createClient<any> until supabase gen types is run post-deployment — type safety at the query level is deferred"
  - "sendAdminSignupNotification uses displayName/email param names (not memberName/memberEmail) to match plan spec"
  - "Removed root src/app/page.tsx — landing page served by (public)/page.tsx route group to get the shared public layout (header with George's Predictor branding)"
  - "@hookform/resolvers added to package.json — was missing from initial scaffold despite react-hook-form being planned"
metrics:
  duration: 8 min
  completed: "2026-04-11"
  tasks_completed: 2
  files_created: 8
  files_modified: 6
---

# Phase 1 Plan 2: Member Signup Flow and Landing Page Summary

Premier League-branded landing page, idiot-proof signup flow with name picker dropdown, Zod validation schemas, Resend email notifications to George on new signup, and all auth server actions with magic link OTP.

## Tasks Completed

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | Auth server actions, Resend email utility, and validation schemas (TDD) | e031e5f (RED) / f85b5d5 (GREEN) | Done |
| 2 | Landing page and signup form UI | b4a28ec | Done |

## What Was Built

### Auth Server Actions (`src/actions/auth.ts`)
- `signUpMember(formData)`: Validates via signupSchema, checks blocked_emails table, calls `supabase.auth.signInWithOtp` with `shouldCreateUser: true` and `data: { display_name, email_opt_in }`. Fire-and-forgets `sendAdminSignupNotification` — email failure never blocks signup. Returns `{ success: true }` or `{ error }`.
- `requestMagicLink(formData)`: Validates via loginSchema, calls `signInWithOtp` with `shouldCreateUser: false` and `emailRedirectTo: /auth/callback?next=/dashboard`. Returns `{ success: true }` or `{ error }`.

### Zod Validators (`src/lib/validators/auth.ts`)
- `signupSchema`: `display_name` (1-50 chars, trim), `email` (valid format, lowercase), `is_new_member` (boolean), `email_opt_in` (boolean, required)
- `loginSchema`: `email` (valid format, lowercase)
- Both export inferred TypeScript types

### Resend Email Utility (`src/lib/email.ts`)
- `sendEmail({ to, subject, html })`: Generic wrapper around `resend.emails.send()`. Logs errors and returns `{ error }` rather than throwing.
- `sendAdminSignupNotification({ displayName, email })`: Sends email to `ADMIN_EMAIL_GEORGE` with subject "New signup waiting for approval: {displayName}" and body with member details + link to admin pending members page.

### Landing Page (`src/app/(public)/page.tsx`)
- Premier League-inspired design: dark slate background, purple accent colours
- Hero section with "George's Predictor" title, tagline, two CTA buttons (Join the Competition / Member Login)
- Stats strip (PL, 38 Gameweeks, Cash Prize)
- League table teaser: shows top 5 approved members by points, or "Season starting soon" placeholder
- "How It Works" 3-step section
- Bottom CTA repeated
- `force-dynamic` to ensure live DB reads

### Name Picker (`src/components/auth/name-picker.tsx`)
- Radix UI Select dropdown showing imported member names (fetched from server)
- Last option: "I'm new — type my name" — reveals a text input below the dropdown
- Falls back to direct text input if no imported names exist
- Large touch targets, clear design per idiot-proof requirement

### Signup Form (`src/components/auth/signup-form.tsx`)
- `react-hook-form` + `zodResolver(signupSchema)` with Controller for the name picker
- Fields: name picker, email input, deadline reminder opt-in checkbox (defaults to checked)
- Loading state on submit button
- Server error display
- On success: "You're registered! Confirm with George via WhatsApp so he can approve your account."

### Signup Page (`src/app/(public)/signup/page.tsx`)
- Server component that fetches `display_name` from `members` where `user_id IS NULL` (pre-imported names)
- Passes imported names to SignupForm

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Zod v4 uses `result.error.issues` not `result.error.errors`**
- **Found during:** Task 1 (TDD RED phase — tests revealed runtime error)
- **Issue:** `result.error.errors` is `undefined` in Zod v4; error details are on `result.error.issues`
- **Fix:** Updated `src/actions/auth.ts` to use `result.error.issues[0]?.message`
- **Files modified:** src/actions/auth.ts
- **Commit:** f85b5d5

**2. [Rule 3 - Blocking] `@hookform/resolvers` was missing from dependencies**
- **Found during:** Task 2
- **Issue:** `react-hook-form` was installed but `@hookform/resolvers` (needed for `zodResolver`) was not in package.json
- **Fix:** Ran `npm install @hookform/resolvers`
- **Files modified:** package.json, package-lock.json
- **Commit:** f85b5d5

**3. [Rule 1 - Bug] `sendAdminSignupNotification` had wrong parameter names**
- **Found during:** Task 1 (tests checking `{ displayName, email }` vs implementation using `{ memberName, memberEmail }`)
- **Issue:** The implementation used `memberName`/`memberEmail` but the plan spec and tests expected `displayName`/`email`
- **Fix:** Updated `src/lib/email.ts` to use `displayName` and `email` param names
- **Files modified:** src/lib/email.ts
- **Commit:** f85b5d5

**4. [Rule 1 - Bug] Pre-existing TypeScript type errors in admin files (Database = Record\<string, unknown\>)**
- **Found during:** Task 2 build verification
- **Issue:** `src/actions/admin/members.ts` and `recovery.ts` had type errors because `Database = Record<string, unknown>` makes all Supabase query parameters resolve to `never`. These files existed from a prior plan.
- **Fix:** Changed `createAdminClient()` and `createServerSupabaseClient()` to use `createClient<any>` until `supabase gen types` is run after deployment
- **Files modified:** src/lib/supabase/admin.ts, src/lib/supabase/server.ts
- **Commit:** b4a28ec

**5. [Rule 3 - Blocking] Root `src/app/page.tsx` conflicted with `(public)/page.tsx`**
- **Found during:** Task 2
- **Issue:** Both `src/app/page.tsx` (old scaffold default) and `src/app/(public)/page.tsx` (new landing page) mapped to route `/`. The scaffold default page needed to be removed.
- **Fix:** Deleted `src/app/page.tsx`
- **Commit:** b4a28ec

**6. [Rule 1 - Bug] `email_opt_in` `.default(true)` in Zod schema caused zodResolver type mismatch**
- **Found during:** Task 2 (TypeScript check during build)
- **Issue:** Zod v4 `.default()` makes the input type `boolean | undefined` but output `boolean`, causing a zodResolver ↔ react-hook-form type mismatch
- **Fix:** Removed `.default(true)` from signupSchema; default is set in form's `defaultValues: { email_opt_in: true }` instead
- **Files modified:** src/lib/validators/auth.ts, tests/actions/auth.test.ts
- **Commit:** b4a28ec

## Self-Check: PASSED

Key files verified present:
```
✓ src/lib/validators/auth.ts
✓ src/lib/email.ts
✓ src/actions/auth.ts
✓ src/app/(public)/page.tsx
✓ src/app/(public)/signup/page.tsx
✓ src/components/auth/signup-form.tsx
✓ src/components/auth/name-picker.tsx
✓ tests/actions/auth.test.ts
```

Commits verified:
- e031e5f — test(01-02): add failing tests for auth server actions and validation schemas
- f85b5d5 — feat(01-02): implement auth server actions, Zod validators, and Resend email utility
- b4a28ec — feat(01-02): add landing page, signup form, and name picker components

Verification results:
- `npx vitest run tests/actions/auth.test.ts` — 20/20 PASS
- `npm run build` — PASS (all routes generated, 0 TypeScript errors)
