import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { TeamRow, FixtureWithTeams } from '@/lib/supabase/types'
import AllFixturesClient from './all-fixtures-client'

// Force dynamic rendering — fixture data changes throughout the season
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: "All Fixtures — George's Predictor",
}

/**
 * All-fixtures page — shows all 380 season fixtures with a team filter.
 * Data is fetched server-side and passed to a client wrapper for interactive filtering.
 */
export default async function AllFixturesPage() {
  const supabase = await createServerSupabaseClient()

  // Fetch all teams ordered by name (for the filter dropdown)
  const { data: teamsData } = await supabase
    .from('teams')
    .select('*')
    .order('name')

  const teams = (teamsData ?? []) as TeamRow[]

  // Fetch all fixtures with joined team and gameweek data, ordered by kickoff
  const { data: fixturesData } = await supabase
    .from('fixtures')
    .select('*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*), gameweek:gameweeks!gameweek_id(*)')
    .order('kickoff_time')

  const fixtures = (fixturesData ?? []) as FixtureWithTeams[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">All Fixtures</h1>
        <p className="text-slate-400 mt-1">Browse every Premier League fixture this season.</p>
      </div>
      <AllFixturesClient teams={teams} fixtures={fixtures} />
    </div>
  )
}
