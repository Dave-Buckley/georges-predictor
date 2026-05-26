-- 022_exclude_from_standings.sql
--
-- Adds a flag to hide a member from the points tally / standings / weekly-winner
-- views WITHOUT removing their login or prediction access. Used for placeholder
-- and admin/QA accounts (e.g. "Bucks") that should be able to sign in and test
-- but must not appear as a competitor in the league.
--
-- Access (auth + approval_status) is intentionally untouched: an excluded member
-- can still log in, submit predictions, and use the app — they just don't show
-- up in any ranked tally.

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS exclude_from_standings boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.members.exclude_from_standings IS
  'When true, the member is hidden from all points tally / standings / weekly-winner views but retains full login and prediction access. Used for placeholder and admin/QA accounts.';

-- Remove the placeholder admin account "Bucks" from the tally (keeps access).
UPDATE public.members
SET exclude_from_standings = true
WHERE display_name ILIKE 'Bucks'
   OR email = 'dave.john.buckley@gmail.com';
