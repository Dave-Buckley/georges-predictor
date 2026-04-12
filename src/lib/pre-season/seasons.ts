/**
 * Season-window helpers for pre-season predictions.
 *
 * Thin DB helpers — uses the admin client because the `seasons` table is
 * small, read-only for most callers, and the RLS public-SELECT policy
 * means we don't need admin bypass, but the admin client keeps the
 * connection pooled and avoids session round-trips for server pages.
 *
 * Current = the season whose GW1 kickoff is in the past (most recent such row).
 * Upcoming = the earliest season whose GW1 kickoff is still in the future.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import type { SeasonRow } from '@/lib/supabase/types'

/**
 * Returns the most recently-started season (GW1 kickoff in the past),
 * or null when no season has started yet.
 */
export async function getCurrentSeason(): Promise<SeasonRow | null> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('seasons')
    .select('*')
    .lte('gw1_kickoff', new Date().toISOString())
    .order('season', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) return null
  return (data as SeasonRow | null) ?? null
}

/**
 * Returns the next season whose GW1 kickoff is still in the future,
 * or null when no upcoming season is seeded.
 */
export async function getUpcomingSeason(): Promise<SeasonRow | null> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('seasons')
    .select('*')
    .gt('gw1_kickoff', new Date().toISOString())
    .order('season', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) return null
  return (data as SeasonRow | null) ?? null
}
