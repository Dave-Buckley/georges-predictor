import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, ArrowRightCircle } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatKickoffFull, formatKickoffDate } from '@/lib/fixtures/timezone'
import { FixtureDialog } from '@/components/admin/fixture-form'
import { MoveFixtureDialog } from '@/components/admin/move-fixture-dialog'
import { ResultOverrideDialog } from '@/components/admin/result-override-dialog'
import type { FixtureWithTeams, GameweekRow, TeamRow } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ gwNumber: string }>
}

async function getGameweekData(gwNumber: number) {
  const supabase = createAdminClient()

  // Look up gameweek by number
  const { data: gameweek, error: gwError } = await supabase
    .from('gameweeks')
    .select('*')
    .eq('number', gwNumber)
    .single()

  if (gwError || !gameweek) return null

  // Fetch fixtures with joined team data for this gameweek
  const { data: fixtures } = await supabase
    .from('fixtures')
    .select(`
      *,
      home_team:teams!home_team_id(*),
      away_team:teams!away_team_id(*),
      gameweek:gameweeks!gameweek_id(*)
    `)
    .eq('gameweek_id', gameweek.id)
    .order('kickoff_time')

  // Fetch all teams for the add-fixture form dropdown
  const { data: teams } = await supabase
    .from('teams')
    .select('*')
    .order('name')

  // Fetch all gameweeks for the move-fixture dropdown
  const { data: gameweeks } = await supabase
    .from('gameweeks')
    .select('id, number, season, status, created_at')
    .order('number')

  return {
    gameweek: gameweek as GameweekRow,
    fixtures: (fixtures ?? []) as FixtureWithTeams[],
    teams: (teams ?? []) as TeamRow[],
    gameweeks: (gameweeks ?? []) as GameweekRow[],
  }
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  SCHEDULED: { label: 'Scheduled', className: 'bg-gray-100 text-gray-600' },
  TIMED: { label: 'Timed', className: 'bg-blue-100 text-blue-700' },
  IN_PLAY: { label: 'In Play', className: 'bg-green-100 text-green-700' },
  PAUSED: { label: 'Paused', className: 'bg-yellow-100 text-yellow-700' },
  FINISHED: { label: 'Finished', className: 'bg-gray-200 text-gray-700' },
  POSTPONED: { label: 'Postponed', className: 'bg-red-100 text-red-700' },
  SUSPENDED: { label: 'Suspended', className: 'bg-orange-100 text-orange-700' },
  CANCELLED: { label: 'Cancelled', className: 'bg-red-200 text-red-800' },
  AWARDED: { label: 'Awarded', className: 'bg-purple-100 text-purple-700' },
}

const SOURCE_BADGE: Record<string, { label: string; className: string }> = {
  api: { label: 'API', className: 'bg-blue-100 text-blue-700' },
  manual: { label: 'Manual', className: 'bg-amber-100 text-amber-700' },
}

export default async function SingleGameweekPage({ params }: PageProps) {
  const { gwNumber: gwNumberStr } = await params
  const gwNumber = parseInt(gwNumberStr, 10)

  if (isNaN(gwNumber) || gwNumber < 1 || gwNumber > 38) {
    notFound()
  }

  const data = await getGameweekData(gwNumber)

  if (!data) {
    notFound()
  }

  const { gameweek, fixtures, teams, gameweeks } = data

  // Group fixtures by date
  const fixturesByDate = fixtures.reduce<Record<string, FixtureWithTeams[]>>(
    (acc, fixture) => {
      const dateKey = formatKickoffDate(fixture.kickoff_time)
      if (!acc[dateKey]) acc[dateKey] = []
      acc[dateKey].push(fixture)
      return acc
    },
    {}
  )

  const dateGroups = Object.entries(fixturesByDate)

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin/gameweeks"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          All gameweeks
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gameweek {gwNumber}</h1>
            <p className="text-gray-500 mt-1">
              {fixtures.length} fixture{fixtures.length !== 1 ? 's' : ''}
              {' — '}
              <span
                className={`capitalize ${
                  gameweek.status === 'active'
                    ? 'text-amber-600'
                    : gameweek.status === 'complete'
                      ? 'text-green-600'
                      : 'text-gray-500'
                }`}
              >
                {gameweek.status}
              </span>
            </p>
          </div>

          {teams.length > 0 && (
            <FixtureDialog
              mode="add"
              teams={teams}
              gameweeks={gameweeks}
              defaultGameweekNumber={gwNumber}
              trigger={
                <button
                  type="button"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-colors shadow-sm"
                >
                  + Add fixture
                </button>
              }
            />
          )}
        </div>
      </div>

      {/* Fixtures */}
      {fixtures.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 text-center">
          <p className="text-gray-500 font-medium">No fixtures in this gameweek yet.</p>
          {teams.length > 0 ? (
            <p className="text-gray-400 text-sm mt-1">
              Click &quot;Add fixture&quot; to add one manually, or run a sync from the gameweeks overview.
            </p>
          ) : (
            <p className="text-gray-400 text-sm mt-1">
              Run a sync from the gameweeks overview to populate fixtures.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {dateGroups.map(([dateLabel, dayFixtures]) => (
            <div key={dateLabel}>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                {dateLabel}
              </h2>
              <div className="space-y-2">
                {dayFixtures.map((fixture) => {
                  const statusBadge = STATUS_BADGE[fixture.status] ?? STATUS_BADGE.SCHEDULED
                  const hasScore =
                    fixture.home_score != null && fixture.away_score != null

                  const sourceBadge = fixture.result_source
                    ? SOURCE_BADGE[fixture.result_source] ?? null
                    : null

                  return (
                    <div
                      key={fixture.id}
                      className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3"
                    >
                      {/* Teams + score */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          {/* Home team */}
                          <div className="flex items-center gap-2 min-w-0">
                            {fixture.home_team.crest_url && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={fixture.home_team.crest_url}
                                alt={fixture.home_team.name}
                                className="w-6 h-6 object-contain flex-shrink-0"
                              />
                            )}
                            <span className="font-semibold text-gray-900 text-sm truncate">
                              {fixture.home_team.name}
                            </span>
                          </div>

                          {/* Score or vs */}
                          <div className="text-sm font-bold text-gray-600 flex-shrink-0">
                            {hasScore
                              ? `${fixture.home_score} – ${fixture.away_score}`
                              : 'vs'}
                          </div>

                          {/* Away team */}
                          <div className="flex items-center gap-2 min-w-0">
                            {fixture.away_team.crest_url && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={fixture.away_team.crest_url}
                                alt={fixture.away_team.name}
                                className="w-6 h-6 object-contain flex-shrink-0"
                              />
                            )}
                            <span className="font-semibold text-gray-900 text-sm truncate">
                              {fixture.away_team.name}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-xs text-gray-500">
                            {formatKickoffFull(fixture.kickoff_time)}
                          </span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge.className}`}
                          >
                            {statusBadge.label}
                          </span>
                          {sourceBadge && (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${sourceBadge.className}`}
                            >
                              {sourceBadge.label}
                            </span>
                          )}
                          {fixture.is_rescheduled && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                              <ArrowRightCircle className="w-3 h-3" />
                              Rescheduled
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <ResultOverrideDialog
                          fixtureId={fixture.id}
                          homeTeamName={fixture.home_team.name}
                          awayTeamName={fixture.away_team.name}
                          currentHomeScore={fixture.home_score}
                          currentAwayScore={fixture.away_score}
                          currentSource={fixture.result_source}
                        />
                        <FixtureDialog
                          mode="edit"
                          fixture={fixture}
                          teams={teams}
                          gameweeks={gameweeks}
                          trigger={
                            <button
                              type="button"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium transition-colors"
                            >
                              Edit
                            </button>
                          }
                        />
                        <MoveFixtureDialog
                          fixtureId={fixture.id}
                          currentGameweekNumber={gwNumber}
                          gameweeks={gameweeks}
                          matchLabel={`${fixture.home_team.name} vs ${fixture.away_team.name}`}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
