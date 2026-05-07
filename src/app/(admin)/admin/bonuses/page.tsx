import { createAdminClient } from '@/lib/supabase/admin'
import { Star, Zap, CheckCircle, Clock, PlusCircle } from 'lucide-react'
import { SetBonusDialog } from '@/components/admin/set-bonus-dialog'
import { ConfirmBonusAwards } from '@/components/admin/confirm-bonus-awards'
import { createBonusType, toggleDoubleBubble } from '@/actions/admin/bonuses'
import { GameweekSelector } from './gameweek-selector'
import type {
  BonusTypeRow,
  BonusScheduleRow,
  GameweekRow,
  BonusAwardRow,
} from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

interface BonusScheduleWithType extends BonusScheduleRow {
  bonus_type: BonusTypeRow
}

interface AwardWithDetails extends BonusAwardRow {
  member_display_name: string
  bonus_type_name: string
  fixture_label: string | null
}

interface PageProps {
  searchParams: Promise<{ gw?: string }>
}

/**
 * Picks which gameweek's awards to show by default:
 *   1. earliest gameweek with pending (NULL) awards — that's the one George
 *      most likely needs to action right now
 *   2. otherwise the active gameweek so he can see live picks before close
 *   3. otherwise the latest gameweek with at least one pick
 */
function pickDefaultGameweek(
  gameweeks: GameweekRow[],
  pendingByGwId: Map<string, number>,
  anyByGwId: Map<string, number>,
): number {
  if (gameweeks.length === 0) return 1
  const firstWithPending = gameweeks.find((gw) => (pendingByGwId.get(gw.id) ?? 0) > 0)
  if (firstWithPending) return firstWithPending.number
  const active = gameweeks.find((gw) => gw.status === 'active')
  if (active) return active.number
  const lastWithAny = [...gameweeks].reverse().find((gw) => (anyByGwId.get(gw.id) ?? 0) > 0)
  if (lastWithAny) return lastWithAny.number
  return gameweeks[gameweeks.length - 1].number
}

function getRowClass(status: string): string {
  if (status === 'complete') return 'bg-gray-50 opacity-60'
  if (status === 'active') return 'bg-purple-50'
  return 'bg-white'
}

export default async function BonusesPage({ searchParams }: PageProps) {
  const { gw: gwParam } = await searchParams
  const supabase = createAdminClient()

  // ── Phase 1: load lookups + per-gw award counts in parallel ────────────────
  const [
    bonusTypesResult,
    scheduleResult,
    gameweeksResult,
    awardCountsResult,
  ] = await Promise.all([
    supabase.from('bonus_types').select('*').order('name'),
    supabase
      .from('bonus_schedule')
      .select('*, bonus_type:bonus_types(*)')
      .order('created_at'),
    supabase.from('gameweeks').select('*').order('number'),
    supabase.from('bonus_awards').select('gameweek_id, awarded'),
  ])

  const bonusTypes = (bonusTypesResult.data ?? []) as BonusTypeRow[]
  const schedule = (scheduleResult.data ?? []) as BonusScheduleWithType[]
  const gameweeks = (gameweeksResult.data ?? []) as GameweekRow[]

  const pendingByGwId = new Map<string, number>()
  const anyByGwId = new Map<string, number>()
  for (const row of (awardCountsResult.data ?? []) as Array<{
    gameweek_id: string
    awarded: boolean | null
  }>) {
    anyByGwId.set(row.gameweek_id, (anyByGwId.get(row.gameweek_id) ?? 0) + 1)
    if (row.awarded === null) {
      pendingByGwId.set(
        row.gameweek_id,
        (pendingByGwId.get(row.gameweek_id) ?? 0) + 1,
      )
    }
  }

  // ── Phase 2: resolve which gw to show + load that gw's awards ──────────────
  const defaultGwNumber = pickDefaultGameweek(gameweeks, pendingByGwId, anyByGwId)
  const requested = gwParam ? parseInt(gwParam, 10) : defaultGwNumber
  const selectedGwNumber = isNaN(requested) ? defaultGwNumber : requested
  const selectedGw = gameweeks.find((gw) => gw.number === selectedGwNumber) ?? null

  let awardsForSelectedGw: AwardWithDetails[] = []
  const predictionsByKey = new Map<string, { home_score: number; away_score: number }>()

  if (selectedGw) {
    const { data: awardRows } = await supabase
      .from('bonus_awards')
      .select(
        '*, members(display_name), bonus_types(name), fixtures(home_team:teams!home_team_id(name), away_team:teams!away_team_id(name))',
      )
      .eq('gameweek_id', selectedGw.id)
    awardsForSelectedGw = (awardRows ?? []) as unknown as AwardWithDetails[]

    const memberIds = Array.from(
      new Set(awardsForSelectedGw.map((a) => a.member_id).filter(Boolean)),
    )
    const fixtureIds = Array.from(
      new Set(
        awardsForSelectedGw
          .map((a) => a.fixture_id)
          .filter((id): id is string => Boolean(id)),
      ),
    )
    if (memberIds.length > 0 && fixtureIds.length > 0) {
      const { data: predictionsData } = await supabase
        .from('predictions')
        .select('member_id, fixture_id, home_score, away_score')
        .in('member_id', memberIds)
        .in('fixture_id', fixtureIds)
      for (const p of predictionsData ?? []) {
        predictionsByKey.set(`${p.member_id}::${p.fixture_id}`, {
          home_score: p.home_score,
          away_score: p.away_score,
        })
      }
    }
  }

  // ── Schedule lookup for the rotation table ─────────────────────────────────
  const scheduleByGwId = new Map<string, BonusScheduleWithType>()
  for (const row of schedule) {
    scheduleByGwId.set(row.gameweek_id, row)
  }

  // ── Shape awards for ConfirmBonusAwards ────────────────────────────────────
  const awardItems = awardsForSelectedGw.map((a) => {
    const prediction = a.fixture_id
      ? predictionsByKey.get(`${a.member_id}::${a.fixture_id}`) ?? null
      : null
    return {
      id: a.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      member_display_name: (a as any).members?.display_name ?? 'Unknown',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      bonus_type_name: (a as any).bonus_types?.name ?? 'Unknown',
      fixture_label: (() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const f = (a as any).fixtures
        if (!f) return null
        return `${f.home_team?.name ?? '?'} vs ${f.away_team?.name ?? '?'}`
      })(),
      prediction,
      awarded: a.awarded ?? null,
      points_awarded: a.points_awarded ?? 0,
    }
  })

  const pendingForSelected = awardItems.filter((a) => a.awarded === null).length

  return (
    <div className="p-6 lg:p-8 max-w-5xl space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Star className="w-6 h-6 text-purple-600" />
          Bonus Rotation
        </h1>
        <p className="text-gray-500 mt-1">
          Manage bonus assignments for all 38 gameweeks
        </p>
      </div>

      {/* Create new bonus type */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <PlusCircle className="w-4 h-4 text-gray-500" />
          Create Custom Bonus Type
        </h2>
        <form action={createBonusType as unknown as (formData: FormData) => void} className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <input
              type="text"
              name="name"
              placeholder="Bonus name (e.g. Clean Sheet Hero)"
              maxLength={100}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
              required
            />
          </div>
          <div className="flex-1">
            <input
              type="text"
              name="description"
              placeholder="Description (e.g. Your keeper keeps a clean sheet)"
              maxLength={500}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
              required
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-colors shrink-0"
          >
            Create
          </button>
        </form>
      </div>

      {/* Full season rotation table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Season Rotation</h2>
          <p className="text-sm text-gray-500 mt-0.5">All 38 gameweeks</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-16">
                  GW
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Bonus Type
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">
                  Double Bubble
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">
                  Status
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {gameweeks.map((gw) => {
                const scheduleRow = scheduleByGwId.get(gw.id)
                const isDoubleBubble = gw.double_bubble
                const isSpecialGw = gw.number === 10 || gw.number === 20 || gw.number === 30
                const rowClass = getRowClass(gw.status)

                return (
                  <tr
                    key={gw.id}
                    className={`${rowClass} hover:bg-purple-25 transition-colors`}
                  >
                    {/* GW number */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-gray-900">GW{gw.number}</span>
                        {isSpecialGw && (
                          <span className="text-xs text-purple-500" title="Special gameweek">
                            ★
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-xs capitalize ${
                          gw.status === 'active'
                            ? 'text-purple-600'
                            : gw.status === 'complete'
                              ? 'text-gray-400'
                              : 'text-gray-400'
                        }`}
                      >
                        {gw.status}
                      </span>
                    </td>

                    {/* Bonus type */}
                    <td className="px-4 py-3">
                      {scheduleRow ? (
                        <div>
                          <span className="font-medium text-gray-900">
                            {scheduleRow.bonus_type.name}
                          </span>
                          <p className="text-xs text-gray-400 mt-0.5 max-w-[220px] truncate">
                            {scheduleRow.bonus_type.description}
                          </p>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic text-xs">Not assigned</span>
                      )}
                    </td>

                    {/* Double Bubble toggle */}
                    <td className="px-4 py-3 text-center">
                      <form
                        action={toggleDoubleBubble as unknown as (formData: FormData) => void}
                        className="inline-flex items-center justify-center"
                      >
                        <input type="hidden" name="gameweek_id" value={gw.id} />
                        <input
                          type="hidden"
                          name="enabled"
                          value={isDoubleBubble ? 'false' : 'true'}
                        />
                        <button
                          type="submit"
                          title={isDoubleBubble ? 'Click to disable Double Bubble' : 'Click to enable Double Bubble'}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                            isDoubleBubble
                              ? 'bg-purple-100 text-purple-700 hover:bg-purple-200 border border-purple-200'
                              : 'bg-gray-100 text-gray-400 hover:bg-gray-200 border border-gray-200'
                          }`}
                        >
                          <Zap className="w-3 h-3" />
                          {isDoubleBubble ? 'On' : 'Off'}
                        </button>
                      </form>
                    </td>

                    {/* Confirmed status */}
                    <td className="px-4 py-3 text-center">
                      {scheduleRow?.confirmed ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          <CheckCircle className="w-3 h-3" />
                          Set
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                          <Clock className="w-3 h-3" />
                          Pending
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <SetBonusDialog
                        gameweekNumber={gw.number}
                        gameweekId={gw.id}
                        currentBonusTypeId={scheduleRow?.bonus_type_id ?? null}
                        bonusTypes={bonusTypes}
                        existingPickCount={0}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bonus Awards review section */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
          <div>
            <h2 className="text-base font-semibold text-gray-900" id="awards">
              Bonus Awards
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Pick a gameweek to review or audit member bonus picks.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Gameweek:</label>
            <GameweekSelector gameweeks={gameweeks} selectedGw={selectedGwNumber} />
            {pendingForSelected > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                {pendingForSelected} pending
              </span>
            )}
          </div>
        </div>

        {!selectedGw ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
            <p className="text-gray-500 text-sm">Gameweek {selectedGwNumber} not found.</p>
          </div>
        ) : awardItems.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
            <p className="text-gray-500 font-medium">
              No bonus picks for Gameweek {selectedGw.number} yet
            </p>
            <p className="text-gray-400 text-sm mt-1">
              Picks appear here as soon as members submit them.
            </p>
          </div>
        ) : (
          <ConfirmBonusAwards
            gameweekId={selectedGw.id}
            gameweekNumber={selectedGw.number}
            awards={awardItems}
          />
        )}
      </div>
    </div>
  )
}
