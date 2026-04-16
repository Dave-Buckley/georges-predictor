-- ─── Migration 016: Double Bubble as a selectable bonus type ─────────────────
-- George treats Double Bubble as one of his ~9 rotating bonuses. Previously it
-- was only a gameweek-level boolean (gameweeks.double_bubble). Now it also
-- appears as a bonus_types row so George can pick it from the admin bonus
-- dropdown like any other bonus. The server action that sets a gameweek's
-- bonus will synchronise the gameweeks.double_bubble flag when this bonus is
-- selected or replaced.
--
-- Unlike the other bonus types, Double Bubble does NOT require members to
-- pick a fixture — the whole gameweek total is doubled. The member UI
-- special-cases this by name so no bonus_awards row is needed.

BEGIN;

INSERT INTO public.bonus_types (name, description, is_custom)
SELECT 'Double Bubble', 'Your points are doubled for this gameweek', false
WHERE NOT EXISTS (
  SELECT 1 FROM public.bonus_types WHERE name = 'Double Bubble'
);

COMMIT;
