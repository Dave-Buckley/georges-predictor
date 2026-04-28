import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { gatherGameweekData } from '@/lib/reports/_data/gather-gameweek-data'
import type { GameweekRow } from '@/lib/supabase/types'
import { TablesView } from './_components/tables-view'
import { GameweekSelector } from './_components/gameweek-selector'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: "Tables — George's Predictor Admin",
}

interface PageProps {
  searchParams: Promise<{ gw?: string }>
}

interface BonusAwardRaw {
  id: string
  member_id: string
  fixture_id: string | null
  awarded: boolean | null
  points_awarded: number | null
  bonus_types: { name: string } | null
  fixtures:
    | {
        home_team: { name: string } | null
        away_team: { name: string } | null
      }
    | null
}

function pickDefaultGameweek(gameweeks: GameweekRow[]): number {
  if (gameweeks.length === 0) return 1
  const complete = [...gameweeks].reverse().find((gw) => gw.status === 'complete')
  if (complete) return complete.number
  const active = gameweeks.find((gw) => gw.status === 'active')
  if (active) return active.number
  const scheduled = gameweeks.find((gw) => gw.status === 'scheduled')
  if (scheduled) return scheduled.number
  return gameweeks[gameweeks.length - 1].number
}

export default async function AdminTablesPage({ searchParams }: PageProps) {
  const { gw: gwParam } = await searchParams
  const admin = createAdminClient()

  const { data: allGameweeks } = await admin
    .from('gameweeks')
    .select('*')
    .order('number')
  const gameweeks = (allGameweeks ?? []) as GameweekRow[]

  if (gameweeks.length === 0) {
    return (
      <div className="p-6 lg:p-8 max-w-6xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Tables</h1>
          <p className="text-gray-500 mt-1 text-sm">
            League table for each gameweek.
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
          <p className="text-gray-500 text-sm">
            No gameweeks available yet.
          </p>
        </div>
      </div>
    )
  }

  const defaultGw = pickDefaultGameweek(gameweeks)
  const requested = gwParam ? parseInt(gwParam, 10) : defaultGw
  const selectedGwNumber = isNaN(requested) ? defaultGw : requested
  const selectedGw = gameweeks.find((g) => g.number === selectedGwNumber) ?? null

  if (!selectedGw) {
    return (
      <div className="p-6 lg:p-8 max-w-6xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Tables</h1>
        </div>
        <div className="flex items-center gap-3 mb-5">
          <label className="text-sm font-medium text-gray-700">Gameweek:</label>
          <GameweekSelector gameweeks={gameweeks} selectedGw={selectedGwNumber} />
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
          <p className="text-gray-500 text-sm">
            Gameweek {selectedGwNumber} not found.
          </p>
        </div>
      </div>
    )
  }

  const gwData = await gatherGameweekData(selectedGw.id)

  const { data: bonusAwardsRaw } = await admin
    .from('bonus_awards')
    .select(
      'id, member_id, fixture_id, awarded, points_awarded, bonus_types(name), fixtures(home_team:teams!home_team_id(name), away_team:teams!away_team_id(name))',
    )
    .eq('gameweek_id', selectedGw.id)

  const bonusByMember = new Map<string, BonusAwardRaw>()
  for (const row of (bonusAwardsRaw ?? []) as unknown as BonusAwardRaw[]) {
    bonusByMember.set(row.member_id, row)
  }

  const memberPredictionPoints = new Map<string, number>()
  for (const memberId of Object.keys(gwData.predictionsByMember)) {
    const preds = gwData.predictionsByMember[memberId] ?? []
    let sum = 0
    for (const p of preds) sum += p.pointsAwarded
    memberPredictionPoints.set(memberId, sum)
  }

  const rows = gwData.standings
    .map((s) => {
      const bonus = bonusByMember.get(s.memberId)
      const fixtureLabel = bonus?.fixtures
        ? `${bonus.fixtures.home_team?.name ?? '?'} vs ${bonus.fixtures.away_team?.name ?? '?'}`
        : null
      return {
        memberId: s.memberId,
        displayName: s.displayName,
        predictionPoints: memberPredictionPoints.get(s.memberId) ?? 0,
        weeklyPoints: s.weeklyPoints,
        totalPoints: s.totalPoints,
        hasPredictions: (gwData.predictionsByMember[s.memberId] ?? []).length > 0,
        bonus: bonus
          ? {
              awardId: bonus.id,
              typeName: bonus.bonus_types?.name ?? 'Bonus',
              fixtureLabel,
              awarded: bonus.awarded,
              pointsAwarded: bonus.points_awarded ?? 0,
            }
          : null,
      }
    })
    .sort((a, b) => {
      if (b.weeklyPoints !== a.weeklyPoints) return b.weeklyPoints - a.weeklyPoints
      return a.displayName.localeCompare(b.displayName)
    })

  const submittedCount = rows.filter((r) => r.hasPredictions).length
  const pendingBonusCount = rows.filter(
    (r) => r.bonus && r.bonus.awarded === null,
  ).length

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tables</h1>
        <p className="text-gray-500 mt-1 text-sm">
          League table for each gameweek — sorted by weekly score.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <label className="text-sm font-medium text-gray-700">Gameweek:</label>
        <GameweekSelector gameweeks={gameweeks} selectedGw={selectedGwNumber} />
        {gwData.doubleBubbleActive && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 border border-purple-200">
            ⚡ Double Bubble ×2
          </span>
        )}
        {selectedGw.status === 'complete' && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
            Complete
          </span>
        )}
        {selectedGw.status === 'active' && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
            Active
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4 mb-5">
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-2.5">
          <span className="text-sm text-gray-500">Submitted</span>
          <p className="text-lg font-bold text-gray-900">
            {submittedCount}{' '}
            <span className="text-gray-400 font-normal text-sm">
              of {rows.length}
            </span>
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-2.5">
          <span className="text-sm text-gray-500">Pending bonuses</span>
          <p className="text-lg font-bold text-gray-900">{pendingBonusCount}</p>
        </div>
      </div>

      <TablesView gameweekId={selectedGw.id} gameweekNumber={selectedGw.number} rows={rows} />
    </div>
  )
}
