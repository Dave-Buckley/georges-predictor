import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { FixtureWithTeams, GameweekRow, GameweekStatus } from '@/lib/supabase/types'
import GameweekNav from '@/components/fixtures/gameweek-nav'
import GameweekView from '@/components/fixtures/gameweek-view'

// Force dynamic rendering — fixture data changes frequently
export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ gwNumber: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { gwNumber } = await params
  const n = parseInt(gwNumber, 10)
  if (isNaN(n) || n < 1 || n > 38) return { title: "George's Predictor" }
  return { title: `Gameweek ${n} — George's Predictor` }
}

/**
 * Member gameweek page — shows all fixtures for a specific gameweek
 * with navigation to browse all 38 gameweeks.
 */
export default async function GameweekPage({ params }: PageProps) {
  const { gwNumber } = await params
  const gwNum = parseInt(gwNumber, 10)

  // Validate parameter
  if (isNaN(gwNum) || gwNum < 1 || gwNum > 38) {
    notFound()
  }

  const supabase = await createServerSupabaseClient()

  // Fetch the specific gameweek
  const { data: gw, error: gwError } = await supabase
    .from('gameweeks')
    .select('*')
    .eq('number', gwNum)
    .single()

  if (gwError || !gw) {
    notFound()
  }

  const gameweek = gw as GameweekRow

  // Fetch fixtures for this gameweek with joined team data
  const { data: fixturesData } = await supabase
    .from('fixtures')
    .select('*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*), gameweek:gameweeks!gameweek_id(*)')
    .eq('gameweek_id', gameweek.id)
    .order('kickoff_time')

  const fixtures = (fixturesData ?? []) as FixtureWithTeams[]

  // Fetch all gameweeks for the navigation dropdown
  const { data: allGameweeks } = await supabase
    .from('gameweeks')
    .select('number, status')
    .order('number')

  const navGameweeks = (allGameweeks ?? []).map((g) => ({
    number: g.number as number,
    status: g.status as GameweekStatus,
  }))

  // If no gameweeks loaded, provide a minimal nav entry for the current GW
  const navList = navGameweeks.length > 0
    ? navGameweeks
    : [{ number: gwNum, status: gameweek.status }]

  const totalGw = navList.length > 0 ? Math.max(...navList.map((g) => g.number)) : 38

  return (
    <div className="space-y-6">
      <GameweekNav
        currentGw={gwNum}
        totalGw={totalGw}
        gameweeks={navList}
      />
      <GameweekView fixtures={fixtures} gameweek={gameweek} />
    </div>
  )
}
