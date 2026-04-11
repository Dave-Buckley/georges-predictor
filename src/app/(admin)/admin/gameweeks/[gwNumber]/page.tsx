import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, ArrowRightCircle, Star, Zap } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatKickoffFull, formatKickoffDate } from '@/lib/fixtures/timezone'
import { FixtureDialog } from '@/components/admin/fixture-form'
import { MoveFixtureDialog } from '@/components/admin/move-fixture-dialog'
import { ResultOverrideDialog } from '@/components/admin/result-override-dialog'
import { SetBonusDialog } from '@/components/admin/set-bonus-dialog'
import { CloseGameweekDialog } from '@/components/admin/close-gameweek-dialog'
import { toggleDoubleBubble } from '@/actions/admin/bonuses'
import type { FixtureWithTeams, GameweekRow, TeamRow, BonusTypeRow } from '@/lib/supabase/types'

interface BonusScheduleEntry {
  id: string
  gameweek_id: string
  bonus_type_id: string
  confirmed: boolean
  bonus_type: BonusTypeRow
}

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

  // Fetch bonus schedule for this gameweek
  const { data: bonusSchedule } = await supabase
    .from('bonus_schedule')
    .select('*, bonus_type:bonus_types(*)')
    .eq('gameweek_id', gameweek.id)
    .maybeSingle()

  // Fetch all bonus types for the SetBonusDialog dropdown
  const { data: bonusTypes } = await supabase
    .from('bonus_types')
    .select('*')
    .order('name')

  // Count pending bonus awards for this gameweek
  const { count: pendingAwardCount } = await supabase
    .from('bonus_awards')
    .select('id', { count: 'exact', head: true })
    .eq('gameweek_id', gameweek.id)
    .is('awarded', null)

  return {
    gameweek: gameweek as GameweekRow,
    fixtures: (fixtures ?? []) as FixtureWithTeams[],
    teams: (teams ?? []) as TeamRow[],
    gameweeks: (gameweeks ?? []) as GameweekRow[],
    bonusSchedule: bonusSchedule as BonusScheduleEntry | null,
    bonusTypes: (bonusTypes ?? []) as BonusTypeRow[],
    pendingAwardCount: pendingAwardCount ?? 0,
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

  const { gameweek, fixtures, teams, gameweeks, bonusSchedule, bonusTypes, pendingAwardCount } = data

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
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">Gameweek {gwNumber}</h1>
              {gameweek.closed_at && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                  Closed
                </span>
              )}
            </div>
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

          <div className="flex items-center gap-2">
            <CloseGameweekDialog
              gameweekId={gameweek.id}
              gameweekNumber={gwNumber}
              isClosed={gameweek.closed_at !== null}
            />
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
      </div>

      {/* Bonus section */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <Star className="w-4 h-4 text-purple-600" />
          Bonus
        </h2>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Current bonus */}
          <div className="flex-1">
            <p className="text-xs text-gray-500 mb-1">Assigned bonus</p>
            {bonusSchedule ? (
              <div>
                <span className="font-semibold text-gray-900">
                  {bonusSchedule.bonus_type.name}
                </span>
                <p className="text-xs text-gray-400 mt-0.5">
                  {bonusSchedule.bonus_type.description}
                </p>
              </div>
            ) : (
              <span className="text-gray-400 italic text-sm">No bonus set</span>
            )}
          </div>

          {/* Double Bubble toggle */}
          <div className="flex-shrink-0">
            <p className="text-xs text-gray-500 mb-1">Double Bubble</p>
            <form action={toggleDoubleBubble} className="inline-flex">
              <input type="hidden" name="gameweek_id" value={gameweek.id} />
              <input
                type="hidden"
                name="enabled"
                value={gameweek.double_bubble ? 'false' : 'true'}
              />
              <button
                type="submit"
                title={
                  gameweek.double_bubble
                    ? 'Click to disable Double Bubble'
                    : 'Click to enable Double Bubble'
                }
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  gameweek.double_bubble
                    ? 'bg-purple-100 text-purple-700 hover:bg-purple-200 border border-purple-200'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200 border border-gray-200'
                }`}
              >
                <Zap className="w-4 h-4" />
                {gameweek.double_bubble ? 'Double Bubble ON' : 'Double Bubble OFF'}
              </button>
            </form>
          </div>

          {/* Set/Change bonus button */}
          <div className="flex-shrink-0">
            <p className="text-xs text-gray-500 mb-1">Actions</p>
            <SetBonusDialog
              gameweekNumber={gwNumber}
              gameweekId={gameweek.id}
              currentBonusTypeId={bonusSchedule?.bonus_type_id ?? null}
              bonusTypes={bonusTypes}
              existingPickCount={0}
            />
          </div>
        </div>

        {/* Pending awards notice */}
        {pendingAwardCount > 0 && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              <span className="font-semibold">{pendingAwardCount} bonus award{pendingAwardCount !== 1 ? 's' : ''} pending review</span>
              {' — '}
              <Link
                href="/admin/bonuses#awards"
                className="underline hover:no-underline"
              >
                Review on Bonuses page
              </Link>
            </p>
          </div>
        )}
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
