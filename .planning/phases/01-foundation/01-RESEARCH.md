# Phase 1: Foundation - Research

**Researched:** 2026-04-11
**Domain:** Next.js 15 App Router + Supabase Auth + Magic Link + RLS + Vercel Hobby + Resend
**Confidence:** HIGH (core stack well-documented; approval flow pattern verified via multiple sources)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Registration Flow**
- Branded landing page before login — blend PL aesthetic with competitive energy (league table teaser, jackpot mention), not over the top
- Member signup: pick name from dropdown of imported names, enter email
- Dropdown includes "I'm new" option at bottom — new members type their name, George approves and sets starting points
- After signup, member sees a notice: "Confirm with George via WhatsApp so he can approve your account"
- If two people claim the same name, both can register — George resolves the dispute from admin
- No passwords for members — magic link login via email
- Members can opt in or out of deadline reminder emails during signup
- George gets email notification AND admin dashboard alert for each new signup

**Member Approval**
- Pending members get read-only access (can browse league table, fixtures) but cannot submit predictions
- When George approves: member gets email with magic link to log in
- When George rejects: member gets email explaining rejection, account is deleted
- George can optionally block a rejected email address to prevent re-registration

**Admin Login**
- Separate admin login page at /admin — email + password (not magic link)
- Only George and Dave's emails work for admin login
- Admin accounts have security questions as fallback recovery
- Either admin can reset the other's account if email access is lost

**Account Recovery**
- Members who lose email access contact George via WhatsApp
- Admin can change a member's email address from the admin panel
- Admin recovery: other admin can reset, plus security questions as fallback

**Admin Dashboard**
- Action-focused landing page: shows what needs George's attention right now (pending approvals, unconfirmed bonuses, gameweek status)
- Sidebar navigation for deeper sections: Members, Gameweeks, Bonuses, Reports
- Dedicated "My Predictions" tab — George submits his own predictions here, clearly separated from admin functions
- Notifications tab: reminders to set bonuses, pending approvals, prize milestones, post-gameweek review prompt
- Admin notifications also emailed to George (not just in-dashboard)
- After the last game each week, George gets a notification to review and prep for next gameweek
- George is not technical — prioritize simplicity and clarity over power-user features throughout

**Member Home Page**
- Dashboard mix: member's current rank, this week's fixtures, recent results, upcoming deadline
- Not just a league table, not just fixtures — a balanced overview
- Deadline reminder emails: day before first fixture + morning of match day if still not submitted

**Branding**
- Name: "George's Predictor" — personal, it's his competition
- Visual blend of Premier League feel (dark tones, bold colours, team badges) with clean, modern design

**Idiot-Proof Design (Project-Wide)**
- ALL users are non-technical — the entire application must be idiot-proof, not just admin
- Every screen, every flow, every interaction must be obvious without explanation
- Clear labels, big buttons, confirmation dialogs, no jargon, no ambiguous states
- If a user could misinterpret something, redesign it
- Real money is involved — confusion = errors = disputes

### Claude's Discretion
- Database schema design and table structure
- Supabase RLS policy implementation details
- Vercel deployment configuration
- Email template design (within the PL-branded aesthetic)
- Exact admin dashboard layout and component structure
- Keep-alive mechanism for Supabase free tier

### Deferred Ideas (OUT OF SCOPE)
- Countdown timer on member dashboard for next deadline — Phase 11 (Polish)
- Admin notification for additional prize milestones — Phase 5 (Admin Panel)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | Zero ongoing costs — all hosting, database, API, and email on free tiers | Verified: Vercel Hobby (free), Supabase Free (free), Resend Free (3,000 emails/month free) — all confirmed free |
| INFRA-02 | Scalable to 100 members on free-tier infrastructure | Supabase Free supports 50,000 MAUs — 100 members is well within limits |
| INFRA-03 | Supabase keep-alive mechanism to prevent free-tier database pausing | Vercel cron job (1/day on Hobby) or GitHub Actions — both viable; Vercel cron preferred to keep infra in one place |
| AUTH-01 | User can sign up with email and password | Implemented as email-only magic link signup (locked decision: no passwords for members) via `supabase.auth.signInWithOtp()` |
| AUTH-02 | George must approve each registration before member can access the tool | `approval_status` column in `members` table; RLS blocks submission access until status = 'approved'; magic link sent by admin on approval |
| AUTH-03 | User session persists across browser refresh | `@supabase/ssr` cookie-based sessions; middleware refreshes tokens automatically |
| AUTH-04 | User can reset password via email link | Magic link flow covers this — member requests new magic link; no password to reset |
| AUTH-05 | George can add new members manually (late joiners) with starting points | Admin server action using `supabase.auth.admin.createUser()` + `members` row with custom `starting_points` |
| AUTH-06 | Two admin accounts — George (primary) and Dave (backup) — both with full admin access | `role` in `app_metadata` set to 'admin' by service_role; hardcoded email check as secondary guard |
| AUTH-07 | Separate admin login page and member login page | Route groups: `(admin)/admin/login` (email+password) and `(member)/login` (magic link); middleware enforces separation |
| AUTH-08 | George can submit his own predictions from admin panel — he is both admin and participant | George has both `app_metadata.role = 'admin'` AND a `members` row; "My Predictions" tab in admin panel |
| AUTH-09 | During signup, member selects name from existing imported list or enters new name | Dropdown in signup form pulls from `members` table (pre-populated); "I'm new" option appends free-text entry |
| ADMIN-01 | George can approve or reject member registrations | Admin server action: approve sets `approval_status = 'approved'` + sends magic link via `auth.admin.inviteUserByEmail`; reject deletes user + sends rejection email via Resend |
| ADMIN-06 | George can manage members — add, remove, set starting points | Admin CRUD UI for `members` table; service_role client used server-side; `starting_points` column on `members` |
</phase_requirements>

---

## Summary

This phase delivers the bedrock: a working Next.js 15 App Router application deployed on Vercel Hobby, backed by a Supabase free-tier database with a complete schema, a two-track auth system (magic link for members, email+password for admins), a George-controlled registration approval flow, and a keep-alive mechanism to prevent the free database from pausing.

The critical design insight is the **split auth model**: members never have passwords — they use magic links (Supabase `signInWithOtp`). Admins use email+password at a separate `/admin/login` route. This is not how Supabase Auth is typically used, which means the implementation needs care: member signup flow doesn't use the standard "confirm email and log in" pattern. Instead, after signup George manually sends the magic link via the admin panel using `auth.admin.inviteUserByEmail` (the approval-as-activation pattern).

The second complexity is the **approval gate**: members exist as unconfirmed auth users after signup but are blocked by both app_metadata and RLS until George approves. This requires a `members` table with `approval_status`, a Postgres trigger to create the members row on signup, and RLS policies that check approval status before allowing any write operations. Read-only access for pending members is enforced by separate RLS policies.

**Primary recommendation:** Use the Supabase + Next.js official SSR starter as the scaffold (`@supabase/ssr` package), then layer the custom approval flow, dual auth model, and Vercel cron keep-alive on top.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 15.x | App Router framework | Project-mandated; App Router is current standard |
| @supabase/supabase-js | latest (2.x) | Supabase client | Official JS client |
| @supabase/ssr | latest (0.x) | SSR cookie-based auth | Required for Next.js server components; replaces deprecated `@supabase/auth-helpers-nextjs` |
| typescript | 5.x | Type safety | Project standard |
| tailwindcss | 3.x | Styling | Project standard |
| resend | latest (4.x) | Transactional email | 3,000 emails/month free; official React Email support |
| react-email | latest | Email templates | Pairs with Resend; React-based, PL-branded templates |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-hook-form | 7.x | Form state management | Signup form, admin forms — reduces boilerplate |
| zod | 3.x | Schema validation | Validates form inputs and server action inputs |
| @radix-ui/react-select | latest | Accessible dropdown | Name picker dropdown in signup form |
| @radix-ui/react-dialog | latest | Modal dialogs | Confirmation dialogs for approve/reject actions |
| lucide-react | latest | Icons | Clean, consistent icon set |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Resend | Supabase's built-in email | Supabase's SMTP is limited/unreliable on free tier; Resend gives 3k/month free with proper templates |
| @supabase/ssr | @supabase/auth-helpers-nextjs | auth-helpers is deprecated — ssr is the current official package |
| Vercel cron | GitHub Actions keep-alive | Vercel cron is simpler (one place); GitHub Actions works if Hobby cron limits are hit |
| Magic link | OTP (6-digit code) | Both use `signInWithOtp()`; magic link is more idiot-proof for non-technical users |

**Installation:**
```bash
npm install @supabase/supabase-js @supabase/ssr resend react-email react-hook-form zod @radix-ui/react-select @radix-ui/react-dialog lucide-react
```

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── (public)/              # No auth required
│   │   ├── page.tsx           # Landing page with league teaser
│   │   ├── signup/
│   │   │   └── page.tsx       # Member signup (name picker + email)
│   │   └── login/
│   │       └── page.tsx       # Member magic link request
│   ├── (member)/              # Auth required, approved only
│   │   └── dashboard/
│   │       └── page.tsx       # Member home: rank, fixtures, deadline
│   ├── (admin)/
│   │   └── admin/
│   │       ├── login/
│   │       │   └── page.tsx   # Admin email+password login
│   │       ├── layout.tsx     # Admin layout with sidebar
│   │       └── page.tsx       # Admin dashboard (action-focused)
│   │           ├── members/   # Member management (Phase 1)
│   │           └── predictions/ # George's own predictions (Phase 3)
│   └── auth/
│       └── callback/
│           └── route.ts       # Supabase auth callback (magic links)
├── lib/
│   ├── supabase/
│   │   ├── client.ts          # createBrowserClient
│   │   ├── server.ts          # createServerClient (for server components)
│   │   └── admin.ts           # createClient with service_role (admin ops only)
│   └── email/
│       └── templates/         # React Email templates
├── components/
│   ├── ui/                    # Shadcn-style primitives
│   └── auth/                  # Signup form, login form
├── actions/
│   ├── auth.ts                # signUp, requestMagicLink server actions
│   └── admin/
│       └── members.ts         # approve, reject, createMember server actions
└── middleware.ts               # Token refresh + route protection
```

### Pattern 1: Supabase SSR Middleware (Token Refresh)
**What:** Middleware refreshes expired Supabase auth tokens on every request, stores them in cookies, and protects routes.
**When to use:** Always — this is the base layer for all authenticated routes.
**Example:**
```typescript
// src/middleware.ts
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: use getClaims() not getSession() in middleware
  const { data: { user } } = await supabase.auth.getUser()

  // Protect /admin routes — check app_metadata.role
  if (request.nextUrl.pathname.startsWith('/admin') &&
      !request.nextUrl.pathname.startsWith('/admin/login')) {
    if (!user || user.app_metadata?.role !== 'admin') {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  // Protect /dashboard routes — require approved member
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    // Approval check happens in server component (DB lookup)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

### Pattern 2: Admin Service Role Client
**What:** A separate Supabase client that bypasses RLS for admin operations.
**When to use:** Server Actions only — never expose service_role to the browser.
**Example:**
```typescript
// src/lib/supabase/admin.ts
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // Never expose this publicly
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
```

### Pattern 3: Member Approval Flow
**What:** Two-stage registration — signup creates a pending record; George approves by triggering a magic link.
**When to use:** All member registrations.
**Flow:**
```
1. Member submits signup form → supabase.auth.signInWithOtp()
   with options.shouldCreateUser: true, data: { display_name, email_opt_in }
2. Postgres trigger: on INSERT to auth.users → INSERT into public.members
   (user_id, display_name, email, approval_status: 'pending')
3. Supabase sends OTP email (suppress with emailRedirectTo: null for now)
   OR disable email confirm and handle manually
4. George sees pending approval in admin dashboard
5. George approves → Server Action calls:
   supabaseAdmin.auth.admin.inviteUserByEmail(email) → magic link sent
   + UPDATE members SET approval_status = 'approved' WHERE user_id = ?
6. Member clicks magic link → authenticated + can submit predictions
7. George rejects → Server Action calls:
   supabaseAdmin.auth.admin.deleteUser(user_id)
   + send rejection email via Resend
   + optionally INSERT into blocked_emails table
```

### Pattern 4: Role-Based Access via app_metadata
**What:** Admin role stored in `app_metadata` (tamper-proof — only service_role can modify it).
**When to use:** Distinguishing admins from members; checked in middleware and RLS.
**Example:**
```typescript
// When creating/seeding admin users:
await supabaseAdmin.auth.admin.updateUserById(userId, {
  app_metadata: { role: 'admin' }
})

// In RLS policy (SQL):
-- Allow admin to read all members
CREATE POLICY "admins_read_all_members" ON members
  FOR SELECT USING (
    (auth.jwt() ->> 'role')::text = 'admin'
  );
```

### Pattern 5: Supabase Keep-Alive via Vercel Cron
**What:** A daily Vercel cron job hits a Next.js API route that runs a lightweight DB query.
**When to use:** Always — free-tier Supabase pauses after 7 days of inactivity.
**Example:**
```typescript
// src/app/api/keep-alive/route.ts
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  // Verify this is a Vercel cron call
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createAdminClient()
  await supabase.from('members').select('id').limit(1)
  return NextResponse.json({ ok: true })
}

// vercel.json
// {
//   "crons": [{ "path": "/api/keep-alive", "schedule": "0 9 * * *" }]
// }
```

### Anti-Patterns to Avoid
- **Using `supabase.auth.getSession()` in server code:** Not guaranteed to revalidate JWT; always use `supabase.auth.getUser()` server-side.
- **Exposing service_role key in client components:** Will give anyone full database access. Only use in Server Actions and Route Handlers.
- **Storing admin role in user_metadata:** Users can modify their own `user_metadata`. Role MUST go in `app_metadata` (only service_role can write it).
- **Using `FOR ALL` in RLS policies:** Hard to debug and reason about. Write separate SELECT, INSERT, UPDATE, DELETE policies.
- **Caching authenticated pages:** Pages with user data must use `export const dynamic = 'force-dynamic'` to prevent ISR caching cross-user sessions.
- **Blocking signup with email confirmation:** Keep email confirmation DISABLED for the member flow; instead gate access via `approval_status` in the members table. Magic link sent by George on approval is the confirmation mechanism.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session management | Custom JWT handling | `@supabase/ssr` cookie sessions | Edge cases with token refresh, PKCE flow, cookie serialization — enormous complexity |
| Email sending | SMTP server | Resend | Deliverability, DKIM/SPF, free 3k/month, React Email templates |
| Password hashing | bcrypt manually | Supabase Auth | Auth is a product; rolling your own is a security antipattern |
| Route protection | Per-page auth checks | Middleware + RLS | Middleware misses → RLS catches; defense in depth without repetition |
| Form validation | Manual HTML validation | Zod + react-hook-form | Server action safety requires Zod; client UX requires react-hook-form |
| Admin user creation | Custom user table | Supabase Auth `admin.createUser()` | Auth tokens, password hashing, session — already solved |
| Keep-alive scheduling | Custom cron service | Vercel cron + API route | One-line `vercel.json` config; free on Hobby (1/day is sufficient) |
| Email templates | Raw HTML strings | react-email | Cross-client compatibility, PL branding, inline styles — react-email handles all of this |

**Key insight:** Supabase Auth + `@supabase/ssr` is specifically designed for Next.js App Router. Fighting the opinionated setup costs more than following it.

---

## Common Pitfalls

### Pitfall 1: getSession() in Middleware
**What goes wrong:** Calling `supabase.auth.getSession()` in middleware to check auth — but getSession() returns the cached session without re-validating against the server. A tampered JWT can pass the check.
**Why it happens:** Old tutorials (pre-2024) use getSession(). Supabase docs updated this recommendation.
**How to avoid:** Always use `supabase.auth.getUser()` in middleware and server components. Only use getSession() client-side after initial user check.
**Warning signs:** Auth guides from 2023 or Stack Overflow answers using getSession() in middleware.

### Pitfall 2: Supabase Free Tier Pauses After 7 Days
**What goes wrong:** Database pauses silently; first request after pause times out with a confusing error. Members can't access the site without George manually unpausing via the dashboard.
**Why it happens:** Supabase free tier aggressively reclaims resources from inactive projects.
**How to avoid:** Ship the Vercel cron keep-alive (`0 9 * * *`) in Wave 1 of this phase — before any members use the system. Verify cron is running within 24 hours of deployment.
**Warning signs:** 503 or timeout errors in production that don't reproduce locally.

### Pitfall 3: Magic Link Flow vs Standard Signup Flow
**What goes wrong:** Using `supabase.auth.signUp()` (email+password) for members, then trying to bolt on magic link later. Or using `signInWithOtp()` with autoconfirm enabled, which lets members bypass the approval gate.
**Why it happens:** The design (magic link for members, password for admins) is non-standard and easy to mix up during implementation.
**How to avoid:** Member flow uses `signInWithOtp({ email, options: { shouldCreateUser: true } })`. The OTP email is NOT how members log in after approval — George sends the actual magic link via `inviteUserByEmail` on approval. The initial OTP is suppressed or used only to create the auth.users record. Admin flow uses `supabase.auth.signInWithPassword()` on a completely separate page.
**Warning signs:** Members able to click the initial OTP link and access predictions before George approves.

### Pitfall 4: RLS Not Enabled = Data Wide Open
**What goes wrong:** Tables created without RLS enabled — anon key (in the browser client) can read/write all rows.
**Why it happens:** Supabase doesn't enable RLS by default. Easy to forget.
**How to avoid:** Enable RLS on every table immediately at creation, before any data is inserted. Use `ALTER TABLE members ENABLE ROW LEVEL SECURITY;` in the migration. Deploy with no anon-accessible data until policies are explicitly written.
**Warning signs:** Supabase's built-in "Security Advisor" in the dashboard flags tables with RLS disabled.

### Pitfall 5: app_metadata vs user_metadata Confusion
**What goes wrong:** Storing the admin role in `user_metadata` instead of `app_metadata`. A user can update their own user_metadata via `supabase.auth.updateUser()`, promoting themselves to admin.
**Why it happens:** user_metadata is easier to write (no service_role needed).
**How to avoid:** Admin role MUST be in `app_metadata`. Only the service_role (server-side) can set app_metadata. Seed admin users with a migration script or Supabase dashboard, not via the client.
**Warning signs:** Using `supabase.auth.updateUser({ data: { role: 'admin' } })` — this writes to user_metadata.

### Pitfall 6: Vercel Hobby Cron Limitations
**What goes wrong:** Assuming the Vercel Hobby cron job can run every hour for keep-alive. Hobby crons fire at most once per day and Vercel may vary the exact time within the configured hour.
**Why it happens:** Pro plan allows 1-minute intervals; Hobby only allows daily schedules.
**How to avoid:** Schedule the cron for daily at a consistent hour (`0 9 * * *`). One ping per day is sufficient to prevent Supabase pausing (7-day threshold). If more frequent pings are needed, add a GitHub Actions workflow as a secondary mechanism (free, runs on a schedule).
**Warning signs:** Vercel deployment errors if you specify sub-daily cron schedules on Hobby plan.

### Pitfall 7: ISR Caching Leaking Authenticated Data
**What goes wrong:** Next.js caches server component output; one member's dashboard data gets served to another member on cold-cache.
**Why it happens:** Next.js App Router caches by default. Easy to miss for auth-sensitive pages.
**How to avoid:** Add `export const dynamic = 'force-dynamic'` to all pages that read from Supabase with user context. Alternatively, use cookies-based fetching which auto-opts out of caching.
**Warning signs:** Users seeing each other's data after deployment or on the first load.

---

## Code Examples

Verified patterns from official sources:

### Member Magic Link Signup
```typescript
// Source: https://supabase.com/docs/guides/auth/auth-email-passwordless
// Server Action: src/actions/auth.ts
'use server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function signUpMember(formData: FormData) {
  const email = formData.get('email') as string
  const displayName = formData.get('display_name') as string
  const emailOptIn = formData.get('email_opt_in') === 'true'

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      data: { display_name: displayName, email_opt_in: emailOptIn },
      // Do NOT set emailRedirectTo here — we don't want them to auto-login
      // George sends the actual login link on approval
    }
  })
  // ...
}
```

### Admin Approve Member
```typescript
// Source: https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail
// Server Action: src/actions/admin/members.ts
'use server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function approveMember(userId: string, email: string) {
  const supabase = createAdminClient()

  // Send magic link (this is how the member actually gets access)
  await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/dashboard`
  })

  // Update approval status
  await supabase
    .from('members')
    .update({ approval_status: 'approved', approved_at: new Date().toISOString() })
    .eq('user_id', userId)

  // Send via Resend as well for custom branding (optional — inviteUserByEmail already sends)
}
```

### Admin Reject Member
```typescript
// Server Action: src/actions/admin/members.ts
export async function rejectMember(
  userId: string,
  email: string,
  blockEmail: boolean
) {
  const supabase = createAdminClient()

  // Delete auth user (cascades to members via FK + trigger)
  await supabase.auth.admin.deleteUser(userId)

  // Send rejection email via Resend
  const resend = new Resend(process.env.RESEND_API_KEY!)
  await resend.emails.send({
    from: 'George\'s Predictor <noreply@georgespedictor.co.uk>',
    to: email,
    subject: 'Registration Update',
    react: RejectionEmailTemplate(),
  })

  if (blockEmail) {
    await supabase.from('blocked_emails').insert({ email })
  }
}
```

### Profiles Trigger (Postgres migration)
```sql
-- Source: https://supabase.com/docs/guides/auth/managing-user-data
-- Creates a members row when auth.users is inserted
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.members (user_id, email, display_name, email_opt_in, approval_status)
  VALUES (
    NEW.id,
    NEW.email,
    (NEW.raw_user_meta_data->>'display_name')::text,
    (NEW.raw_user_meta_data->>'email_opt_in')::boolean,
    'pending'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();
```

---

## Database Schema (Phase 1 Scope)

Claude's discretion — recommended design:

```sql
-- Members table (public — linked to auth.users)
CREATE TABLE members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email         text NOT NULL,
  display_name  text NOT NULL,
  approval_status text NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  email_opt_in  boolean NOT NULL DEFAULT true,
  starting_points int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  approved_at   timestamptz,
  approved_by   uuid REFERENCES auth.users(id)
);

-- Blocked emails (prevent re-registration after rejection)
CREATE TABLE blocked_emails (
  email text PRIMARY KEY,
  blocked_at timestamptz NOT NULL DEFAULT now(),
  blocked_by uuid REFERENCES auth.users(id)
);

-- Enable RLS immediately
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_emails ENABLE ROW LEVEL SECURITY;

-- Indexes for RLS performance (source: Supabase RLS best practices)
CREATE INDEX members_user_id_idx ON members(user_id);
CREATE INDEX members_approval_status_idx ON members(approval_status);

-- RLS: Members can read their own row
CREATE POLICY "members_read_own" ON members
  FOR SELECT USING (auth.uid() = user_id);

-- RLS: Admins can read all members
CREATE POLICY "admins_read_all_members" ON members
  FOR SELECT USING ((auth.jwt() ->> 'role')::text = 'admin');

-- RLS: Admins can update members
CREATE POLICY "admins_update_members" ON members
  FOR UPDATE USING ((auth.jwt() ->> 'role')::text = 'admin');
```

**Note on `(auth.jwt() ->> 'role')`:** This reads the `role` claim directly from the JWT. This works when `app_metadata.role` is set — Supabase includes app_metadata keys in the JWT automatically. Verify this in your Supabase project's JWT claims before relying on it in production RLS policies.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2023/2024 | auth-helpers is deprecated; must use ssr package |
| `supabase.auth.getSession()` in middleware | `supabase.auth.getUser()` | 2024 | Security fix — getSession() doesn't revalidate JWT |
| Next.js Edge runtime middleware | Next.js Node runtime middleware | Next.js 15.2+ | `@supabase/ssr` requires Node APIs; no longer a conflict in 15.2+ |
| Manual email SMTP | Resend / Postmark | 2023+ | Built-in Supabase SMTP unreliable for custom templates; Resend free tier is sufficient |
| pg_cron for keep-alive | Vercel cron + API route | N/A for this project | pg_cron is available on free tier but Vercel cron is simpler to manage alongside the app |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs`: Deprecated — do not install. Use `@supabase/ssr`.
- `supabase.auth.getSession()` in server code: Security vulnerability. Use `getUser()`.
- `next-auth` with Supabase adapter: Adds complexity; Supabase Auth is sufficient for this use case.

---

## Open Questions

1. **Should the initial OTP email be suppressed or used as "registration received" confirmation?**
   - What we know: Supabase sends an OTP/magic link email when `signInWithOtp()` is called. This goes to the member immediately on signup.
   - What's unclear: Do we want members to receive this email, or should we suppress it and only use the George-approved magic link from `inviteUserByEmail`?
   - Recommendation: **Use the initial OTP email as "registration received" confirmation**, but customize the template text to say "George will approve your account shortly — do not click this link until approved." This avoids members logging in before approval. The planner should decide whether to customize the Supabase email template or use Resend for the confirmation email instead.

2. **How does the admin role JWT claim get into the token for George and Dave?**
   - What we know: `app_metadata.role` must be set via service_role; Supabase includes app_metadata in JWT automatically.
   - What's unclear: Whether a Postgres migration can seed this, or if it requires manual action in the Supabase dashboard after project creation.
   - Recommendation: Create a Supabase migration that inserts admin accounts using a server-side seed script run once post-deploy. The planner should include a "seed admins" task in Wave 1 before any member signs up.

3. **Email domain for Resend — do George/Dave have a domain?**
   - What we know: Resend free tier allows 1 custom domain. Resend also provides a test sender (`onboarding@resend.dev`) but production emails must come from a verified domain.
   - What's unclear: Whether the project has a domain purchased yet.
   - Recommendation: The planner should add a task to verify a custom domain in Resend before first production email. If no domain is purchased yet, flag this as a blocker for email delivery.

---

## Validation Architecture

`workflow.nyquist_validation` is `true` in config — validation section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + React Testing Library (recommended) OR Jest — neither is installed yet |
| Config file | `vitest.config.ts` — Wave 0 gap |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-03 | Keep-alive API route returns 200 with valid auth header | unit | `npx vitest run tests/api/keep-alive.test.ts` | Wave 0 gap |
| AUTH-01 | signUpMember server action calls signInWithOtp with correct params | unit | `npx vitest run tests/actions/auth.test.ts` | Wave 0 gap |
| AUTH-02 | Pending member cannot access /dashboard (redirected to login) | integration | `npx vitest run tests/middleware.test.ts` | Wave 0 gap |
| AUTH-03 | Session cookie set after magic link → page refresh returns same user | integration | manual smoke (E2E browser test) | manual-only |
| AUTH-04 | Magic link request flow completes without error | unit | `npx vitest run tests/actions/auth.test.ts` | Wave 0 gap |
| AUTH-06 | Middleware rejects non-admin JWT for /admin routes | unit | `npx vitest run tests/middleware.test.ts` | Wave 0 gap |
| AUTH-07 | /admin/login and /login are distinct routes; no cross-redirect | integration | `npx vitest run tests/routing.test.ts` | Wave 0 gap |
| ADMIN-01 | approveMember calls inviteUserByEmail + updates approval_status | unit | `npx vitest run tests/actions/admin/members.test.ts` | Wave 0 gap |
| ADMIN-01 | rejectMember calls deleteUser + sends Resend email | unit | `npx vitest run tests/actions/admin/members.test.ts` | Wave 0 gap |
| INFRA-01 | All external deps are free tier (configuration check) | manual | — | manual-only |
| INFRA-02 | App loads and renders with 100 simulated member rows | smoke | manual | manual-only |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/ --reporter=dot`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/actions/auth.test.ts` — covers AUTH-01, AUTH-04 (mock supabase client)
- [ ] `tests/actions/admin/members.test.ts` — covers ADMIN-01 (mock supabase admin client + Resend)
- [ ] `tests/middleware.test.ts` — covers AUTH-02, AUTH-06 (mock NextRequest with JWT fixtures)
- [ ] `tests/api/keep-alive.test.ts` — covers INFRA-03
- [ ] `tests/routing.test.ts` — covers AUTH-07
- [ ] `vitest.config.ts` — framework config
- [ ] `tests/setup.ts` — shared mocks (supabase client factory, Resend mock)
- [ ] Framework install: `npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom`

---

## Sources

### Primary (HIGH confidence)
- [Supabase SSR Auth for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs) — middleware setup, cookie clients, getUser() pattern
- [Supabase Passwordless Email (Magic Link)](https://supabase.com/docs/guides/auth/auth-email-passwordless) — signInWithOtp, OTP config, rate limits
- [Supabase auth.admin.inviteUserByEmail](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail) — approval flow trigger
- [Supabase Custom Claims & RBAC](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac) — role in app_metadata, JWT claims, RLS
- [Supabase User Management / Triggers](https://supabase.com/docs/guides/auth/managing-user-data) — profiles trigger pattern
- [Supabase RLS Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — policy structure
- [Resend Next.js Docs](https://resend.com/docs/send-with-nextjs) — Server Action integration
- [Vercel Hobby Plan Limits](https://vercel.com/docs/plans/hobby) — 2 cron jobs, once/day max

### Secondary (MEDIUM confidence)
- [Supabase Pause Prevention — Medium 2026](https://shadhujan.medium.com/how-to-keep-supabase-free-tier-projects-active-d60fd4a17263) — keep-alive patterns verified against official free tier docs
- [Supabase Free Tier Limits — freetiers.com](https://www.freetiers.com/directory/supabase) — 500MB DB, 50k MAUs, 7-day pause threshold; cross-checked with official pricing page
- [Vercel Cron Usage & Pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) — Hobby: 2 crons, once/day

### Tertiary (LOW confidence)
- Multiple community examples for Supabase approval flow with profiles table — pattern is consistent across sources but not a single official tutorial

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — official docs confirm all packages; versions current
- Architecture: HIGH — patterns directly from Supabase official Next.js guide
- Approval flow: MEDIUM — composed from multiple official APIs (signInWithOtp, inviteUserByEmail, profiles trigger); no single official "approval flow" tutorial
- Free tier limits: HIGH — verified from official Supabase pricing page and Vercel Hobby plan docs
- Pitfalls: HIGH — several sourced from Supabase's own troubleshooting docs; getSession() pitfall is documented by Supabase officially

**Research date:** 2026-04-11
**Valid until:** 2026-07-11 (stable stack — 90 days; re-verify @supabase/ssr version before planning if delayed)
