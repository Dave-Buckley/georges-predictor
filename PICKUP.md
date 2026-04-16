# Pickup — 16 April 2026 session

Everything in git is pushed. Two outstanding things to verify when you're back.

## 1. Run migration 019 SQL in Supabase

This MUST run before the fixture moves + Christmas Present fix take effect.

Open: https://supabase.com/dashboard/project/unpdsomipodadnlnbioq/sql/new

Paste and run:

```sql
BEGIN;

ALTER TABLE public.fixtures
  ADD COLUMN IF NOT EXISTS manual_gameweek_override boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.fixtures.manual_gameweek_override IS
  'When true, sync preserves gameweek_id instead of reverting to API matchday.';

UPDATE public.fixtures
SET gameweek_id = (SELECT id FROM public.gameweeks WHERE number = 33),
    manual_gameweek_override = true,
    is_rescheduled = true
WHERE id IN (
  '9ca38a78-dfee-40fc-8af8-3e3aba0b4225',  -- Brighton vs Chelsea
  '7b953a65-caeb-4874-9a14-b9b1d3dd34b2',  -- Bournemouth vs Leeds
  'd2be9f53-4bed-480e-b8ea-6bba4d4e4dbf'   -- Burnley vs Man City
);

UPDATE public.additional_prizes
SET cash_value = 2000
WHERE name = 'Christmas Present';

COMMIT;
```

Expected: "Success. No rows returned."

After it runs:
- GW33 shows all 13 fixtures (Brighton vs Chelsea, Bournemouth vs Leeds, Burnley vs Man City move in from GW34)
- Christmas Present prize = £20
- Future manual fixture moves via /admin persist across API syncs

## 2. Verify WhatsApp button is visible

Latest commit `bc27efa` renders the green "Copy my picks to WhatsApp" button in THREE places on every `/gameweeks/[n]` page:
- Top of the page (above submission counter)
- Inline after the fixture list
- Sticky at the bottom alongside Update Predictions

If you still don't see any of them:
1. Open an **incognito window** (rules out browser cache + service worker)
2. Log in fresh and go to `/gameweeks/33`
3. If incognito ALSO shows nothing, something else is broken — share a screenshot and we'll dig in

If incognito shows the button, it's a stale client bundle in your normal browser. Clear site data for `georges-predictor.vercel.app`.

## 3. Forward the email to George

An update summary + fixture-move how-to was sent to `dave.john.buckley@gmail.com`. Resend is in test mode so I couldn't send directly to George. Forward it to `king_gegz@aol.com` when you're ready.

## Everything shipped this session

- Bonus descriptions aligned with George's final wording (already done pre-session)
- Double Bubble: selectable bonus, no member fixture pick required
- Prizes: 11 descriptions fixed, 3 ongoing prizes added, Bore Draw + Fantastic 4 removed, Christmas Present bumped to £20 (SQL pending)
- GW33 rollup: Brighton/Chelsea, Bournemouth/Leeds, Burnley/Man City moved from GW34 (SQL pending)
- Fixture ordering: strict kickoff-time on predictions page
- "This Week" points column on standings + dashboard
- How It Works + printable guide rewritten for new bonus/prize list
- Copy-to-WhatsApp button with confirm dialog + week lock
- LOS reminder on Update Predictions click
- `prediction_locks` table created
- `manual_gameweek_override` column (via SQL)
- Sync pipeline respects manual fixture moves
- Update email drafted + sent to Dave for forwarding to George

## Pushed commits this session (most recent first)

```
bc27efa fix(predictions): render WhatsApp button at top of page too
2fdcaa2 fix(predictions): render inline WhatsApp button alongside sticky one
3d841e8 fix(predictions): always show WhatsApp button when week isn't locked
9de6f03 feat(fixtures): manual gameweek override + LOS reminder + prize fixes
4c676f5 fix(predictions): show WhatsApp button on typed picks; save-before-lock
85ece57 fix(predictions): keep WhatsApp button visible after kickoff
b4571f6 feat(predictions): copy-to-WhatsApp button with confirm + week lock
5d03d38 docs(how-it-works): align bonuses + prizes with George's final list
3261f01 feat(tables): show this-week points alongside season total
efde01e feat(prizes): sync to George's final list
c3bd5dc feat(bonuses): add Double Bubble as a pickable bonus
e73ce95 fix(predictions): order fixtures strictly by kickoff date
```
