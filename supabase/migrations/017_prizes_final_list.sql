-- ─── Migration 017: Sync additional_prizes to George's final list ─────────────
-- George sent a final prize list on 16 Apr. Several seeded prizes had stale
-- descriptions (wrong thresholds, wrong snapshot targets) or trigger config
-- that didn't match his intent. This migration rewrites each mismatched row
-- to match the final wording, inserts the 3 ongoing prizes (Last One Standing,
-- Jackpot 1st, Jackpot 2nd) that weren't seeded, and removes Bore Draw +
-- Fantastic 4 which aren't part of the final list.
--
-- cash_value is in pence (1000 = £10, 3000 = £30, 5000 = £50).
-- trigger_config is metadata — the actual trigger implementations (if any)
-- live in src/lib/prizes/ and may need follow-up updates.

BEGIN;

-- ─── Remove prizes not in final list ──────────────────────────────────────────
DELETE FROM public.additional_prizes
WHERE name IN ('Bore Draw', 'Fantastic 4');

-- ─── Update existing prizes to match final wording ────────────────────────────
UPDATE public.additional_prizes
SET description = 'First member to score 180+ points in a week',
    trigger_type = 'auto',
    trigger_config = '{"threshold": 180, "metric": "weekly_points", "award": "first"}'::jsonb,
    cash_value = 1000
WHERE name = '180';

UPDATE public.additional_prizes
SET description = 'First member to earn 3 consecutive bonuses',
    trigger_type = 'auto',
    trigger_config = '{"metric": "consecutive_bonuses", "count": 3, "award": "first"}'::jsonb,
    cash_value = 1000
WHERE name = 'Bonus King';

UPDATE public.additional_prizes
SET description = 'First member to reach 1000 total points',
    trigger_type = 'auto',
    trigger_config = '{"threshold": 1000, "metric": "total_points", "award": "first"}'::jsonb,
    cash_value = 1000
WHERE name = 'Centurion';

UPDATE public.additional_prizes
SET description = 'League leader on Christmas Day',
    cash_value = 1000
WHERE name = 'Christmas Present';

UPDATE public.additional_prizes
SET description = 'Lowest scoring player at the end of January',
    cash_value = 1000
WHERE name = 'Dry January';

UPDATE public.additional_prizes
SET description = 'Overall losing player on Easter Sunday',
    trigger_config = '{"occasion": "easter_sunday", "snapshot": "lowest"}'::jsonb,
    cash_value = 1000
WHERE name = 'Easter Egg';

UPDATE public.additional_prizes
SET description = 'Highest scoring player from the first gameweek',
    trigger_type = 'auto',
    trigger_config = '{"metric": "gameweek_score", "gameweek_number": 1, "award": "highest"}'::jsonb,
    cash_value = 1000
WHERE name = 'Fresh Start';

UPDATE public.additional_prizes
SET description = 'Member in 31st place on Halloween',
    trigger_config = '{"month": 10, "day": 31, "snapshot": "position", "position": 31}'::jsonb,
    cash_value = 1000
WHERE name = 'Halloween Horror Show';

UPDATE public.additional_prizes
SET description = 'First member to lose 2 H2H steals',
    trigger_type = 'auto',
    trigger_config = '{"metric": "h2h_steals_lost", "count": 2, "award": "first"}'::jsonb,
    cash_value = 1000
WHERE name = 'Knockout';

UPDATE public.additional_prizes
SET description = 'First member to reach final 10 in 3 separate LOS games',
    trigger_type = 'auto',
    trigger_config = '{"metric": "los_final_ten_reaches", "count": 3, "award": "first"}'::jsonb,
    cash_value = 1000
WHERE name = 'Smart One Standing';

UPDATE public.additional_prizes
SET description = 'Members in 6th & 9th positions on Valentines Day',
    trigger_config = '{"month": 2, "day": 14, "snapshot": "positions", "positions": [6, 9]}'::jsonb,
    cash_value = 1000
WHERE name = 'Valentines Surprise';

-- ─── Insert ongoing prizes (weekly / per-LOS-game) ────────────────────────────
-- These recur rather than being one-shot season prizes. trigger_type is set to
-- 'auto' for the Jackpots so the weekly detector can pick them up; Last One
-- Standing is manual (George awards after each LOS game concludes).

INSERT INTO public.additional_prizes (name, emoji, description, trigger_type, trigger_config, points_value, cash_value, is_custom)
SELECT 'Last One Standing',
       '🧍‍♂️',
       'Final player standing for each LOS game',
       'manual',
       '{"note": "Awarded to the winner of each completed Last One Standing competition", "recurring": true}'::jsonb,
       0, 5000, false
WHERE NOT EXISTS (
  SELECT 1 FROM public.additional_prizes WHERE name = 'Last One Standing'
);

INSERT INTO public.additional_prizes (name, emoji, description, trigger_type, trigger_config, points_value, cash_value, is_custom)
SELECT 'Jackpot 1st',
       '💰',
       'Member with the highest score each week',
       'auto',
       '{"metric": "weekly_rank", "position": 1, "recurring": true}'::jsonb,
       0, 3000, false
WHERE NOT EXISTS (
  SELECT 1 FROM public.additional_prizes WHERE name = 'Jackpot 1st'
);

INSERT INTO public.additional_prizes (name, emoji, description, trigger_type, trigger_config, points_value, cash_value, is_custom)
SELECT 'Jackpot 2nd',
       '💸',
       'Member with the 2nd highest score each week',
       'auto',
       '{"metric": "weekly_rank", "position": 2, "recurring": true}'::jsonb,
       0, 1000, false
WHERE NOT EXISTS (
  SELECT 1 FROM public.additional_prizes WHERE name = 'Jackpot 2nd'
);

COMMIT;
