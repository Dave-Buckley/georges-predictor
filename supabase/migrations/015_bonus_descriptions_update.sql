-- ─── Migration 015: Bonus description corrections ─────────────────────────────
-- George sent corrected rule wording for 8 bonus types. Descriptions drive
-- what members see in the bonus picker + admin award dialog, so the DB needs
-- to match. Only `description` changes; `name` and `id` are preserved so
-- existing bonus_schedule / bonus_awards rows stay valid.

BEGIN;

UPDATE public.bonus_types
SET description = 'Predict a player scores exactly 2 goals in your chosen match'
WHERE name = 'Brace Yourself';

UPDATE public.bonus_types
SET description = 'Predict a captain to score, assist or be booked in your chosen match'
WHERE name = 'Captain Fantastic';

UPDATE public.bonus_types
SET description = 'Predict under 2.5 goals in your chosen match'
WHERE name = 'Jose Park The Bus';

UPDATE public.bonus_types
SET description = 'Predict the home team to score, concede and receive 3+ yellows in your chosen match'
WHERE name = 'Klopp Trumps';

UPDATE public.bonus_types
SET description = 'Predict both teams to score in your chosen match'
WHERE name = 'London Derby';

UPDATE public.bonus_types
SET description = 'Predict the team to win by over 2.5 goals in your chosen match'
WHERE name = 'Pep Talk';

UPDATE public.bonus_types
SET description = 'Predict the highest number of cards in your chosen match'
WHERE name = 'Roy Keane';

UPDATE public.bonus_types
SET description = 'Predict the fastest goal to be scored in your chosen match'
WHERE name = 'Shane Long';

COMMIT;
