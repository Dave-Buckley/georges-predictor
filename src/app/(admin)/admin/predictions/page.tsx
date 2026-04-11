import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { PredictionsTable } from '@/components/predictions/predictions-table'
import { GameweekSelector } from './gameweek-selector'
import type { FixtureWithTeams, GameweekRow } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: "All Predictions — George's Predictor Admin",
}

interface PageProps {
  searchParams: Promise<{ gw?: string }>
}

/**
 * Determines the default gameweek to show:
 * - Earliest gameweek with SCHEDULED or TIMED fixtures (current active window)
 * - Falls back to the latest gameweek if none are upcoming
 */
function pickDefaultGameweek(gameweeks: GameweekRow[]): number {
  if (gameweeks.length === 0) return 1
  // Prefer 'active' status first
  const active = gameweeks.find((gw) => gw.status === 'active')
  if (active) return active.number
  // Otherwise the first 'scheduled' one
  const scheduled = gameweeks.find((gw) => gw.status === 'scheduled')
  if (scheduled) return scheduled.number
  // Fall back to latest
  return gameweeks[gameweeks.length - 1].number
}

export default async function AdminPredictionsPage({ searchParams }: PageProps) {
  const { gw: gwParam } = await searchParams

  const supabaseAdmin = createAdminClient()

  // 1. Fetch all gameweeks for the selector dropdown
  const { data: allGameweeks } = await supabaseAdmin
    .from('gameweeks')
    .select('*')
    .order('number')

  const gameweeks = (allGameweeks ?? []) as GameweekRow[]

  if (gameweeks.length === 0) {
    return (
      <div className="p-6 lg:p-8 max-w-6xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">All Predictions</h1>
          <p className="text-gray-500 mt-1 text-sm">
            View all members&apos; predictions for any gameweek.
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
          <p className="text-gray-500 text-sm">
            No gameweeks available. Sync fixtures first.
          </p>
        </div>
      </div>
    )
  }

  // 2. Determine which gameweek to show
  const defaultGw = pickDefaultGameweek(gameweeks)
  const selectedGw = gwParam ? parseInt(gwParam, 10) : defaultGw
  const validGw = isNaN(selectedGw) ? defaultGw : selectedGw

  // 3. Fetch the selected gameweek
  const { data: gameweekData } = await supabaseAdmin
    .from('gameweeks')
    .select('*')
    .eq('number', validGw)
    .single()

  const gameweek = gameweekData as GameweekRow | null

  // 4. Fetch all approved members (sorted alphabetically)
  const { data: membersData } = await supabaseAdmin
    .from('members')
    .select('id, display_name')
    .eq('approval_status', 'approved')
    .order('display_name')

  const members = (membersData ?? []) as Array<{ id: string; display_name: string }>

  // 5. Fetch fixtures for the gameweek (only if gameweek found)
  let fixtures: FixtureWithTeams[] = []
  let predictions: Array<{
    member_id: string
    fixture_id: string
    home_score: number
    away_score: number
  }> = []

  if (gameweek) {
    const { data: fixturesData } = await supabaseAdmin
      .from('fixtures')
      .select(
        '*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*), gameweek:gameweeks!gameweek_id(*)'
      )
      .eq('gameweek_id', gameweek.id)
      .order('kickoff_time')

    fixtures = (fixturesData ?? []) as FixtureWithTeams[]

    // 6. Fetch ALL predictions for this gameweek's fixtures (admin bypasses RLS)
    if (fixtures.length > 0) {
      const fixtureIds = fixtures.map((f) => f.id)
      const { data: predictionsData } = await supabaseAdmin
        .from('predictions')
        .select('member_id, fixture_id, home_score, away_score')
        .in('fixture_id', fixtureIds)

      predictions = (predictionsData ?? []) as typeof predictions
    }
  }

  // 7. Calculate summary stats
  const submittedMemberIds = new Set(predictions.map((p) => p.member_id))
  const submittedCount = submittedMemberIds.size
  const totalMembers = members.length
  const totalPredictions = predictions.length

  return (
    <div className="p-6 lg:p-8 max-w-full">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">All Predictions</h1>
        <p className="text-gray-500 mt-1 text-sm">
          View all members&apos; predictions for any gameweek.
        </p>
      </div>

      {/* Gameweek selector */}
      <div className="flex items-center gap-3 mb-5">
        <label className="text-sm font-medium text-gray-700">Gameweek:</label>
        <GameweekSelector gameweeks={gameweeks} selectedGw={validGw} />
      </div>

      {/* Summary stats */}
      {gameweek && fixtures.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 mb-5">
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-2.5">
            <span className="text-sm text-gray-500">Submitted</span>
            <p className="text-lg font-bold text-gray-900">
              {submittedCount}{' '}
              <span className="text-gray-400 font-normal text-sm">of {totalMembers}</span>
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-2.5">
            <span className="text-sm text-gray-500">Total predictions</span>
            <p className="text-lg font-bold text-gray-900">{totalPredictions}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-2.5">
            <span className="text-sm text-gray-500">Fixtures</span>
            <p className="text-lg font-bold text-gray-900">{fixtures.length}</p>
          </div>
        </div>
      )}

      {/* No gameweek found for selected number */}
      {!gameweek && (
        <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
          <p className="text-gray-500 text-sm">Gameweek {validGw} not found.</p>
        </div>
      )}

      {/* No fixtures */}
      {gameweek && fixtures.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
          <p className="text-gray-500 text-sm">No fixtures in this gameweek.</p>
        </div>
      )}

      {/* No members */}
      {gameweek && fixtures.length > 0 && members.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
          <p className="text-gray-500 text-sm">No approved members yet.</p>
        </div>
      )}

      {/* No predictions yet */}
      {gameweek && fixtures.length > 0 && members.length > 0 && predictions.length === 0 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-amber-700 text-sm">
            No predictions submitted yet for Gameweek {validGw}.
          </p>
        </div>
      )}

      {/* Predictions table */}
      {gameweek && fixtures.length > 0 && members.length > 0 && (
        <PredictionsTable
          members={members}
          fixtures={fixtures}
          predictions={predictions}
        />
      )}
    </div>
  )
}
