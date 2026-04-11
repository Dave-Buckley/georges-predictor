# Phase 1: Foundation - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Project scaffold, database schema, auth system, George-approved registration flow, dual admin roles (George + Dave), and infrastructure deployment on free-tier services. This phase delivers the shell that every other feature builds on — no scoring, no predictions, no fixtures yet.

</domain>

<decisions>
## Implementation Decisions

### Registration Flow
- Branded landing page before login — blend PL aesthetic with competitive energy (league table teaser, jackpot mention), not over the top
- Member signup: pick name from dropdown of imported names, enter email
- Dropdown includes "I'm new" option at bottom — new members type their name, George approves and sets starting points
- After signup, member sees a notice: "Confirm with George via WhatsApp so he can approve your account"
- If two people claim the same name, both can register — George resolves the dispute from admin
- No passwords for members — magic link login via email
- Members can opt in or out of deadline reminder emails during signup
- George gets email notification AND admin dashboard alert for each new signup

### Member Approval
- Pending members get read-only access (can browse league table, fixtures) but cannot submit predictions
- When George approves: member gets email with magic link to log in
- When George rejects: member gets email explaining rejection, account is deleted
- George can optionally block a rejected email address to prevent re-registration

### Admin Login
- Separate admin login page at /admin — email + password (not magic link)
- Only George and Dave's emails work for admin login
- Admin accounts have security questions as fallback recovery
- Either admin can reset the other's account if email access is lost

### Account Recovery
- Members who lose email access contact George via WhatsApp
- Admin can change a member's email address from the admin panel
- Admin recovery: other admin can reset, plus security questions as fallback

### Admin Dashboard
- Action-focused landing page: shows what needs George's attention right now (pending approvals, unconfirmed bonuses, gameweek status)
- Sidebar navigation for deeper sections: Members, Gameweeks, Bonuses, Reports
- Dedicated "My Predictions" tab — George submits his own predictions here, clearly separated from admin functions
- Notifications tab: reminders to set bonuses, pending approvals, prize milestones, post-gameweek review prompt
- Admin notifications also emailed to George (not just in-dashboard)
- After the last game each week, George gets a notification to review and prep for next gameweek
- George is not technical — prioritize simplicity and clarity over power-user features throughout

### Member Home Page
- Dashboard mix: member's current rank, this week's fixtures, recent results, upcoming deadline
- Not just a league table, not just fixtures — a balanced overview
- Deadline reminder emails: day before first fixture + morning of match day if still not submitted

### Branding
- Name: "George's Predictor" — personal, it's his competition
- Visual blend of Premier League feel (dark tones, bold colours, team badges) with clean, modern design

### Claude's Discretion
- Database schema design and table structure
- Supabase RLS policy implementation details
- Vercel deployment configuration
- Email template design (within the PL-branded aesthetic)
- Exact admin dashboard layout and component structure
- Keep-alive mechanism for Supabase free tier

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project

### Established Patterns
- None — this phase establishes the patterns

### Integration Points
- Supabase project setup (auth, database, RLS)
- Vercel deployment pipeline
- Resend email service integration
- football-data.org API key registration (needed for Phase 2 but account setup could happen here)

</code_context>

<specifics>
## Specific Ideas

- Landing page should show a teaser of the league table and mention the jackpot to create excitement
- The signup dropdown should show imported names like "Big Steve", "Dan The Man" etc. — the WhatsApp display names
- Admin notifications should feel like a to-do list: "Set bonus for GW32", "3 pending approvals", "Confirm bonus awards for GW31"
- George isn't technical — every admin action should be obvious with no ambiguity about what buttons do

</specifics>

<deferred>
## Deferred Ideas

- Countdown timer on member dashboard for next deadline — could be added in Phase 11 (Polish) since email reminders cover this for now
- Admin notification for additional prize milestones — Phase 5 (Admin Panel) when prize tracking is built

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-04-11*
