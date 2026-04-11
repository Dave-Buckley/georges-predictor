---
phase: 01-foundation
plan: 05
subsystem: deployment
tags: [vercel, supabase, deployment, e2e, production]
started: 2026-04-11T20:00:00.000Z
completed: 2026-04-11T21:30:00.000Z
duration_minutes: 90
tasks_completed: 2
tasks_total: 2
status: complete
deviations: 3
---

# Plan 01-05 Summary: Deploy & E2E Production Verification

## What Was Built

Deployed the full application to Vercel production with live Supabase database, seeded admin accounts, and verified end-to-end flows.

## Key Outcomes

- **Live URL:** https://georges-predictor.vercel.app
- **Vercel project:** dave-buckleys-projects/georges-predictor (Hobby/free tier)
- **Supabase project:** unpdsomipodadnlnbioq (free tier)
- **Admin accounts seeded:** George (king_gegz@aol.com, admin+participant) and Dave (dave.john.buckley@gmail.com, admin-only)
- **8 env vars configured** on Vercel production
- **Schema migration** run successfully in Supabase SQL Editor
- **Email confirmation disabled** in Supabase Auth (magic links used instead)
- **Site URL + redirect URLs** configured in Supabase for auth callbacks
- **Admin login verified** working end-to-end
- **Forgot password flow added** — reset link via Supabase email

## Deviations

1. **PUBLISHABLE_KEY → ANON_KEY:** All three Supabase client files (client.ts, server.ts, middleware.ts) referenced `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` but the actual env var is `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Caused MIDDLEWARE_INVOCATION_FAILED on Vercel. Fixed.
2. **Admin login redirect loop:** `/admin/login` was inside the `(admin)` route group whose layout checks auth and redirects to `/admin/login` — infinite loop. Fixed by moving login page outside the route group.
3. **Vercel env var whitespace:** `echo` pipe added trailing newline to env vars, causing admin email comparison to fail. Fixed with `printf` (no trailing newline).

## Key Files

### Created
- `src/app/admin/reset-password/page.tsx` — Password reset page
- `.planning/phases/01-foundation/01-05-USER-SETUP.md` — External services setup guide

### Modified
- `src/middleware.ts` — Fixed env var name
- `src/lib/supabase/client.ts` — Fixed env var name
- `src/lib/supabase/server.ts` — Fixed env var name
- `src/app/admin/login/page.tsx` — Added forgot password flow, moved outside (admin) group
- `src/actions/admin/auth.ts` — Added resetAdminPassword action

## Self-Check: PASSED

- [x] Application deployed and accessible at production URL
- [x] Admin login works with email+password
- [x] Admin accounts seeded with correct roles
- [x] Forgot password flow added
- [x] Database schema applied
- [x] Environment variables configured
