-- ─── Migration 019: manual gameweek override + GW33 rollup + prize fix ────────
-- Three changes bundled into one migration:
--
-- 1) Add `manual_gameweek_override` to fixtures. When true, the sync pipeline
--    preserves the current gameweek_id instead of reverting to the API's
--    matchday. This lets George bundle rescheduled fixtures into the
--    "predictor week" they actually get played in, without every sync
--    reverting his decision.
--
-- 2) One-off rollup: George's GW33 poster lists 13 fixtures including three
--    that the API puts in GW34. Move them into GW33 with override=true.
--      - Brighton vs Chelsea
--      - Bournemouth vs Leeds
--      - Burnley vs Man City
--
-- 3) Christmas Present prize is £20, not £10.

BEGIN;

ALTER TABLE public.fixtures
  ADD COLUMN IF NOT EXISTS manual_gameweek_override boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.fixtures.manual_gameweek_override IS
  'When true, sync preserves gameweek_id instead of reverting to API matchday.';

-- Move the 3 GW33 rescheduled fixtures (admin chose to bundle into GW33)
UPDATE public.fixtures
SET gameweek_id = (SELECT id FROM public.gameweeks WHERE number = 33),
    manual_gameweek_override = true,
    is_rescheduled = true
WHERE id IN (
  '9ca38a78-dfee-40fc-8af8-3e3aba0b4225',  -- Brighton vs Chelsea
  '7b953a65-caeb-4874-9a14-b9b1d3dd34b2',  -- Bournemouth vs Leeds
  'd2be9f53-4bed-480e-b8ea-6bba4d4e4dbf'   -- Burnley vs Man City
);

-- Christmas Present: £10 → £20
UPDATE public.additional_prizes
SET cash_value = 2000
WHERE name = 'Christmas Present';

COMMIT;
