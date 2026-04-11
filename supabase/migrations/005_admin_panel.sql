-- ─── Migration 005: Admin Panel ───────────────────────────────────────────────
-- Creates:
--   - bonus_types        (14 predefined bonus type definitions + custom)
--   - bonus_schedule     (one row per gameweek, which bonus is assigned)
--   - bonus_awards       (per-member bonus award tracking, tri-state: pending/confirmed/rejected)
--   - additional_prizes  (13 predefined prize definitions + custom)
--   - prize_awards       (when a prize is triggered and George's confirmation status)
--   - admin_settings     (toggleable notification preferences per admin)
-- Modifies:
--   - gameweeks:          adds double_bubble, closed_at, closed_by columns
--   - admin_notifications: extends type CHECK to include Phase 5 notification types
-- Seeds:
--   - 14 bonus types
--   - bonus_schedule rotation for GW1–38
--   - Double Bubble pre-set for GW10, GW20, GW30
--   - 13 additional prizes

BEGIN;

-- ─── bonus_types ─────────────────────────────────────────────────────────────
-- Catalogue of bonus challenges George can assign to a gameweek.
-- 14 predefined entries + George can create custom types.

CREATE TABLE public.bonus_types (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  description text        NOT NULL,
  is_custom   boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.bonus_types IS
  'Bonus challenge type definitions. 14 predefined + unlimited custom types.';

-- ─── bonus_schedule ──────────────────────────────────────────────────────────
-- One row per gameweek. George confirms the auto-seeded rotation (or changes it)
-- before the bonus goes live. Members cannot see an unconfirmed bonus.

CREATE TABLE public.bonus_schedule (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  gameweek_id    uuid        NOT NULL REFERENCES public.gameweeks(id) ON DELETE CASCADE,
  bonus_type_id  uuid        NOT NULL REFERENCES public.bonus_types(id),
  confirmed      boolean     NOT NULL DEFAULT false,
  confirmed_at   timestamptz,
  confirmed_by   uuid        REFERENCES auth.users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gameweek_id)
);

COMMENT ON TABLE public.bonus_schedule IS
  'Which bonus is assigned to each gameweek. George confirms before it goes live to members.';

-- ─── bonus_awards ─────────────────────────────────────────────────────────────
-- Tri-state tracking of bonus award outcomes per member per gameweek.
-- NULL = pending (awaiting George's review), true = awarded, false = rejected.
-- UNIQUE(gameweek_id, member_id) — one bonus award record per member per GW.

CREATE TABLE public.bonus_awards (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  gameweek_id    uuid        NOT NULL REFERENCES public.gameweeks(id) ON DELETE CASCADE,
  member_id      uuid        NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  bonus_type_id  uuid        NOT NULL REFERENCES public.bonus_types(id),
  fixture_id     uuid        REFERENCES public.fixtures(id),
  awarded        boolean     CHECK (awarded IN (true, false) OR awarded IS NULL),
  confirmed_by   uuid        REFERENCES auth.users(id),
  confirmed_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gameweek_id, member_id)
);

COMMENT ON TABLE public.bonus_awards IS
  'Per-member bonus award tracking. awarded=NULL means pending George review.';

-- ─── additional_prizes ───────────────────────────────────────────────────────
-- Prize definitions. 13 predefined competition prizes + George can add custom ones.
-- cash_value stored in pence (£10 = 1000).
-- trigger_type: auto=system detects, date=snapshot at specific date, manual=George awards

CREATE TABLE public.additional_prizes (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text        NOT NULL,
  emoji          text,
  description    text        NOT NULL,
  trigger_type   text        NOT NULL CHECK (trigger_type IN ('auto', 'date', 'manual')),
  trigger_config jsonb,
  points_value   int         NOT NULL DEFAULT 0,
  cash_value     int         NOT NULL DEFAULT 0,
  is_custom      boolean     NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.additional_prizes IS
  'Prize definitions. cash_value in pence (1000 = £10). trigger_config stores condition metadata.';

-- ─── prize_awards ─────────────────────────────────────────────────────────────
-- Tracks when a prize is triggered (auto-detected or manually) and George's
-- confirmation status. member_id is NULL for group prizes.

CREATE TABLE public.prize_awards (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  prize_id      uuid        NOT NULL REFERENCES public.additional_prizes(id),
  member_id     uuid        REFERENCES public.members(id),
  gameweek_id   uuid        REFERENCES public.gameweeks(id),
  triggered_at  timestamptz NOT NULL DEFAULT now(),
  snapshot_data jsonb,
  status        text        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'confirmed', 'rejected')),
  confirmed_by  uuid        REFERENCES auth.users(id),
  confirmed_at  timestamptz,
  notes         text
);

COMMENT ON TABLE public.prize_awards IS
  'Prize award events. George confirms before award is visible to members.';

-- ─── admin_settings ──────────────────────────────────────────────────────────
-- Per-admin email notification preferences. One row per admin user.

CREATE TABLE public.admin_settings (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id           uuid        NOT NULL UNIQUE REFERENCES auth.users(id),
  email_bonus_reminders   boolean     NOT NULL DEFAULT true,
  email_gw_complete       boolean     NOT NULL DEFAULT true,
  email_prize_triggered   boolean     NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.admin_settings IS
  'Email notification toggles per admin. One row per admin user.';

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX idx_bonus_schedule_gameweek    ON public.bonus_schedule(gameweek_id);
CREATE INDEX idx_bonus_awards_gameweek      ON public.bonus_awards(gameweek_id);
CREATE INDEX idx_bonus_awards_member        ON public.bonus_awards(member_id);
CREATE INDEX idx_prize_awards_prize         ON public.prize_awards(prize_id);
CREATE INDEX idx_prize_awards_member        ON public.prize_awards(member_id);
CREATE INDEX idx_prize_awards_status        ON public.prize_awards(status);

-- ─── Alterations to existing tables ──────────────────────────────────────────

-- gameweeks: add double_bubble toggle, gameweek close tracking
ALTER TABLE public.gameweeks
  ADD COLUMN IF NOT EXISTS double_bubble  boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS closed_at      timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by      uuid        REFERENCES auth.users(id);

COMMENT ON COLUMN public.gameweeks.double_bubble IS
  'When true, all points earned this gameweek are doubled. Pre-set for GW10/20/30.';
COMMENT ON COLUMN public.gameweeks.closed_at IS
  'Timestamp when George closed this gameweek. NULL = not yet closed.';
COMMENT ON COLUMN public.gameweeks.closed_by IS
  'Admin user who closed this gameweek.';

-- admin_notifications: extend type CHECK to include Phase 5 notification types.
-- Postgres inline CHECK constraints are auto-named <table>_<column>_check.
-- We drop and re-add with the full extended list.
ALTER TABLE public.admin_notifications
  DROP CONSTRAINT IF EXISTS admin_notifications_type_check;

ALTER TABLE public.admin_notifications
  ADD CONSTRAINT admin_notifications_type_check
  CHECK (type IN (
    -- Phase 1 original types
    'new_signup',
    'approval_needed',
    'system',
    -- Phase 2 fixture types
    'sync_failure',
    'fixture_rescheduled',
    'fixture_moved',
    -- Phase 4 scoring types
    'result_override',
    'scoring_complete',
    -- Phase 5 admin panel types
    'bonus_reminder',
    'gw_complete',
    'prize_triggered',
    'bonus_award_needed'
  ));

-- ─── Enable Row Level Security ────────────────────────────────────────────────

ALTER TABLE public.bonus_types       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonus_schedule    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonus_awards      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.additional_prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prize_awards      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_settings    ENABLE ROW LEVEL SECURITY;

-- ─── RLS Policies ─────────────────────────────────────────────────────────────

-- bonus_types: authenticated users can read (members need bonus names for display)
CREATE POLICY bonus_types_select_authenticated
  ON public.bonus_types FOR SELECT
  USING (auth.role() = 'authenticated');

-- bonus_types: admin full access
CREATE POLICY bonus_types_admin_all
  ON public.bonus_types FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- bonus_schedule: admin only (Phase 6 adds member-facing confirmed bonus queries)
CREATE POLICY bonus_schedule_admin_all
  ON public.bonus_schedule FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- bonus_awards: admin only
CREATE POLICY bonus_awards_admin_all
  ON public.bonus_awards FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- additional_prizes: authenticated users can read (members see what prizes exist)
CREATE POLICY additional_prizes_select_authenticated
  ON public.additional_prizes FOR SELECT
  USING (auth.role() = 'authenticated');

-- additional_prizes: admin full access
CREATE POLICY additional_prizes_admin_all
  ON public.additional_prizes FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- prize_awards: members can see confirmed winners only
CREATE POLICY prize_awards_select_confirmed
  ON public.prize_awards FOR SELECT
  USING (status = 'confirmed');

-- prize_awards: admin full access
CREATE POLICY prize_awards_admin_all
  ON public.prize_awards FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- admin_settings: admin can manage their own settings
CREATE POLICY admin_settings_own
  ON public.admin_settings FOR ALL
  USING (auth.uid() = admin_user_id)
  WITH CHECK (auth.uid() = admin_user_id);

-- ─── Seed Data: bonus_types ───────────────────────────────────────────────────
-- 14 predefined bonus types from the competition rules.
-- ON CONFLICT DO NOTHING for idempotency.

INSERT INTO public.bonus_types (name, description, is_custom) VALUES
  ('Brace Yourself',    'Predict a player scores 2+ goals in your chosen match',                         false),
  ('Fergie Time',       'Predict a goal scored after 85th minute in your chosen match',                  false),
  ('Golden Glory',      'Special bonus — 20pts correct result, 60pts correct score on chosen match',     false),
  ('London Derby',      'Predict the correct score of a London derby match',                             false),
  ('Jose Park The Bus', 'Predict a 0-0 or 1-0 scoreline in your chosen match',                          false),
  ('Shane Long',        'Predict the first goal scored within 10 minutes in your chosen match',          false),
  ('Pop Up Trent',      'Predict a defender scores in your chosen match',                                false),
  ('Pay The Penalty',   'Predict a penalty is awarded in your chosen match',                             false),
  ('Captain Fantastic', 'Predict the captain scores in your chosen match',                               false),
  ('Alan Shearer',      'Predict the highest scoring match of the gameweek',                             false),
  ('Super Sub',         'Predict a substitute scores in your chosen match',                              false),
  ('Pep Talk',          'Predict the winning manager in your chosen match',                              false),
  ('Klopp Trumps',      'Predict the team with most possession in your chosen match',                    false),
  ('Roy Keane',         'Predict a red card in your chosen match',                                       false)
ON CONFLICT DO NOTHING;

-- ─── Seed Data: bonus_schedule ────────────────────────────────────────────────
-- Pre-populate the full-season rotation for GW1–38.
-- Rotation cycle (repeats every ~15 GWs):
--   GW1/16/32: Brace Yourself
--   GW2/17/33: Fergie Time
--   GW3/18/34: Golden Glory
--   GW4/19/35: London Derby
--   GW5/20/36: Jose Park The Bus
--   GW6/21/37: Shane Long
--   GW7/22/38: Pop Up Trent
--   GW8/23:    Pay The Penalty
--   GW9/24:    Captain Fantastic
--   GW10/25:   Alan Shearer
--   GW11/26:   Super Sub
--   GW12/27:   Pep Talk
--   GW13/28:   Klopp Trumps
--   GW14/29:   Roy Keane
--   GW15/30:   Brace Yourself
--   GW31:      Fergie Time
-- ON CONFLICT DO NOTHING — gameweeks may not all exist yet at migration time.

INSERT INTO public.bonus_schedule (gameweek_id, bonus_type_id)
SELECT g.id, bt.id
FROM public.gameweeks g
JOIN public.bonus_types bt ON bt.name = CASE (((g.number - 1) % 15) + 1)
  WHEN 1  THEN 'Brace Yourself'
  WHEN 2  THEN 'Fergie Time'
  WHEN 3  THEN 'Golden Glory'
  WHEN 4  THEN 'London Derby'
  WHEN 5  THEN 'Jose Park The Bus'
  WHEN 6  THEN 'Shane Long'
  WHEN 7  THEN 'Pop Up Trent'
  WHEN 8  THEN 'Pay The Penalty'
  WHEN 9  THEN 'Captain Fantastic'
  WHEN 10 THEN 'Alan Shearer'
  WHEN 11 THEN 'Super Sub'
  WHEN 12 THEN 'Pep Talk'
  WHEN 13 THEN 'Klopp Trumps'
  WHEN 14 THEN 'Roy Keane'
  WHEN 15 THEN 'Brace Yourself'
  ELSE 'Brace Yourself'
END
WHERE g.number BETWEEN 1 AND 38
ON CONFLICT (gameweek_id) DO NOTHING;

-- Special overrides to match the documented rotation:
-- GW31 maps to position 1 in the second cycle (31 mod 15 = 1 → Brace Yourself),
-- but the spec says GW31 = Fergie Time. Update that specific row.
UPDATE public.bonus_schedule
SET bonus_type_id = (SELECT id FROM public.bonus_types WHERE name = 'Fergie Time')
WHERE gameweek_id = (SELECT id FROM public.gameweeks WHERE number = 31);

-- ─── Seed Data: Double Bubble gameweeks ──────────────────────────────────────
-- GW10, GW20, GW30 are pre-toggled on. George can adjust any GW from the admin panel.

UPDATE public.gameweeks
SET double_bubble = true
WHERE number IN (10, 20, 30);

-- ─── Seed Data: additional_prizes ────────────────────────────────────────────
-- 13 competition prizes. cash_value in pence (1000 = £10, 2000 = £20).

INSERT INTO public.additional_prizes (name, emoji, description, trigger_type, trigger_config, points_value, cash_value, is_custom) VALUES
  ('180',
   '🎯',
   'First member to reach 180 total points',
   'auto',
   '{"threshold": 180, "metric": "total_points", "award": "first"}',
   0, 2000, false),

  ('Bore Draw',
   '😴',
   'First member to correctly predict a 0-0',
   'auto',
   '{"condition": "correct_score", "score": "0-0", "award": "first"}',
   0, 1000, false),

  ('Christmas Present',
   '🎄',
   'Snapshot league leader on Christmas Day',
   'date',
   '{"month": 12, "day": 25, "snapshot": "leader"}',
   0, 1000, false),

  ('Halloween Horror Show',
   '🎃',
   'Snapshot lowest scorer on Halloween',
   'date',
   '{"month": 10, "day": 31, "snapshot": "lowest"}',
   0, 1000, false),

  ('Centurion',
   '💯',
   'First member to reach 100 total points',
   'auto',
   '{"threshold": 100, "metric": "total_points", "award": "first"}',
   0, 1000, false),

  ('Fantastic 4',
   '4️⃣',
   'First member to get 4 correct scores in a single gameweek',
   'auto',
   '{"condition": "correct_scores_in_gw", "count": 4, "award": "first"}',
   0, 1000, false),

  ('Bonus King',
   '👑',
   'Most bonus points at season end (manual award)',
   'manual',
   '{"note": "George reviews bonus totals at season end"}',
   0, 2000, false),

  ('Easter Egg',
   '🥚',
   'Snapshot league leader on Easter Sunday',
   'date',
   '{"occasion": "easter_sunday", "snapshot": "leader"}',
   0, 1000, false),

  ('Valentines Surprise',
   '💝',
   'Snapshot league leader on Valentine''s Day',
   'date',
   '{"month": 2, "day": 14, "snapshot": "leader"}',
   0, 1000, false),

  ('Dry January',
   '🚫',
   'Snapshot lowest scorer at end of January',
   'date',
   '{"month": 1, "day": 31, "snapshot": "lowest", "period": "january"}',
   0, 1000, false),

  ('Fresh Start',
   '🌅',
   'Best single gameweek score of the entire season',
   'auto',
   '{"metric": "best_single_gw_score", "award": "highest"}',
   0, 1000, false),

  ('Knockout',
   '🥊',
   'George awards at his discretion',
   'manual',
   '{"note": "George awards this prize whenever he sees fit"}',
   0, 1000, false),

  ('Smart One Standing',
   '🧠',
   'Last One Standing winner (manual award)',
   'manual',
   '{"note": "Awarded to the Last One Standing competition winner"}',
   0, 2000, false)

ON CONFLICT DO NOTHING;

COMMIT;
