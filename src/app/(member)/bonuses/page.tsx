import { createServerSupabaseClient } from '@/lib/supabase/server'
import type {
  BonusTypeRow,
  BonusScheduleWithType,
  AdditionalPrizeRow,
  PrizeAwardWithDetails,
  GameweekRow,
} from '@/lib/supabase/types'
import { MemberLink } from '@/components/shared/member-link'

export const dynamic = 'force-dynamic'

async function getBonusesData(): Promise<{
  bonusTypes: BonusTypeRow[]
  bonusSchedule: (BonusScheduleWithType & { gameweek: GameweekRow })[]
  prizes: AdditionalPrizeRow[]
  confirmedAwards: PrizeAwardWithDetails[]
}> {
  try {
    const supabase = await createServerSupabaseClient()

    const [bonusTypesResult, bonusScheduleResult, prizesResult, awardsResult] = await Promise.all([
      supabase.from('bonus_types').select('*').order('name'),
      supabase
        .from('bonus_schedule')
        .select('*, bonus_type:bonus_types!bonus_type_id(*), gameweek:gameweeks!gameweek_id(*)')
        .order('gameweek_id'),
      supabase.from('additional_prizes').select('*').order('name'),
      supabase
        .from('prize_awards')
        .select(`
          *,
          prize:additional_prizes!prize_id(*),
          member:members!member_id(id, display_name)
        `)
        .eq('status', 'confirmed'),
    ])

    return {
      bonusTypes: (bonusTypesResult.data ?? []) as BonusTypeRow[],
      bonusSchedule: (bonusScheduleResult.data ?? []) as (BonusScheduleWithType & { gameweek: GameweekRow })[],
      prizes: (prizesResult.data ?? []) as AdditionalPrizeRow[],
      confirmedAwards: (awardsResult.data ?? []) as PrizeAwardWithDetails[],
    }
  } catch {
    return { bonusTypes: [], bonusSchedule: [], prizes: [], confirmedAwards: [] }
  }
}

export default async function BonusesPage() {
  const { bonusTypes, bonusSchedule, prizes, confirmedAwards } = await getBonusesData()

  // Build a map of bonus_type_id -> list of gameweek numbers
  const bonusTypeToGameweeks: Record<string, number[]> = {}
  for (const schedule of bonusSchedule) {
    const typeId = schedule.bonus_type_id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gwNumber = ((schedule as any).gameweek as GameweekRow | null)?.number
    if (gwNumber !== undefined && gwNumber !== null) {
      if (!bonusTypeToGameweeks[typeId]) bonusTypeToGameweeks[typeId] = []
      bonusTypeToGameweeks[typeId].push(gwNumber)
    }
  }

  // Build a map of prize_id -> confirmed award (for winner display)
  const prizeToAward: Record<string, PrizeAwardWithDetails> = {}
  for (const award of confirmedAwards) {
    if (!prizeToAward[award.prize_id]) {
      prizeToAward[award.prize_id] = award
    }
  }

  // Identify Double Bubble gameweeks (GW10, GW20, GW30)
  const doubleBubbleGWs = bonusSchedule
    .filter((s) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gwNum = ((s as any).gameweek as GameweekRow | null)?.number
      return gwNum === 10 || gwNum === 20 || gwNum === 30
    })
    .map((s) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return ((s as any).gameweek as GameweekRow | null)?.number
    })
    .filter(Boolean) as number[]

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Bonuses &amp; Prizes</h1>
        <p className="text-slate-400 mt-1 text-sm">
          Everything you need to know about bonus challenges and prizes this season.
        </p>
      </div>

      {/* ── Bonus Types Section ──────────────────────────────────────────────── */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white">Bonus Types</h2>
          <p className="text-slate-400 text-sm mt-0.5">
            Each gameweek features a different bonus challenge — here&apos;s how they all work.
          </p>
        </div>

        {/* Special call-out: Double Bubble */}
        {doubleBubbleGWs.length > 0 && (
          <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-2xl p-5 mb-5">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">🫧</span>
              <h3 className="font-bold text-amber-300 text-lg">Double Bubble</h3>
            </div>
            <p className="text-amber-100 text-sm leading-relaxed">
              On gameweeks {doubleBubbleGWs.sort((a, b) => a - b).join(', ')}, <strong>all points are doubled!</strong>{' '}
              Your prediction scores, bonus points — everything. These are the gameweeks where you can really make your move up the table.
            </p>
          </div>
        )}

        {bonusTypes.length === 0 ? (
          <div className="bg-slate-800/50 rounded-2xl p-8 text-center">
            <p className="text-slate-500 text-sm">Bonus types will appear here once the season is set up.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {bonusTypes.map((bonusType) => {
              const gameweeks = (bonusTypeToGameweeks[bonusType.id] ?? []).sort((a, b) => a - b)
              const isGoldenGlory = bonusType.name.toLowerCase().includes('golden glory')

              return (
                <div
                  key={bonusType.id}
                  className={`rounded-2xl p-5 border ${
                    isGoldenGlory
                      ? 'bg-gradient-to-br from-yellow-500/10 to-amber-500/10 border-yellow-500/30'
                      : 'bg-slate-800/60 border-slate-700/50'
                  }`}
                >
                  <h3 className={`font-bold text-base mb-1 ${isGoldenGlory ? 'text-yellow-300' : 'text-white'}`}>
                    {bonusType.name}
                    {bonusType.is_custom && (
                      <span className="ml-2 text-xs font-normal text-purple-400">Custom</span>
                    )}
                  </h3>
                  <p className="text-slate-400 text-sm leading-relaxed mb-3">{bonusType.description}</p>

                  {isGoldenGlory && (
                    <div className="bg-yellow-500/10 rounded-lg p-2.5 mb-3 border border-yellow-500/20">
                      <p className="text-yellow-200 text-xs leading-relaxed">
                        <strong>Scoring:</strong> Correct result = 20 pts · Exact score = 60 pts
                      </p>
                    </div>
                  )}

                  {gameweeks.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {gameweeks.map((gw) => (
                        <span
                          key={gw}
                          className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-700 text-slate-300"
                        >
                          GW{gw}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-xs">Gameweeks not yet assigned</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Prizes Section ────────────────────────────────────────────────────── */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white">Prizes</h2>
          <p className="text-slate-400 text-sm mt-0.5">
            Milestone achievements and special prizes throughout the season. Can you win them all?
          </p>
        </div>

        {prizes.length === 0 ? (
          <div className="bg-slate-800/50 rounded-2xl p-8 text-center">
            <p className="text-slate-500 text-sm">Prize details will appear here once the season is set up.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {prizes.map((prize) => {
              const confirmedAward = prizeToAward[prize.id]
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const winner = confirmedAward
                ? ((confirmedAward as any).member as { display_name?: string } | null)?.display_name ?? 'Someone'
                : null

              return (
                <div
                  key={prize.id}
                  className={`rounded-2xl p-5 border ${
                    winner
                      ? 'bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/30'
                      : 'bg-slate-800/60 border-slate-700/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-3">
                      {prize.emoji ? (
                        <span className="text-3xl leading-none">{prize.emoji}</span>
                      ) : (
                        <span className="text-3xl leading-none">🏆</span>
                      )}
                      <div>
                        <h3 className="font-bold text-white text-base">{prize.name}</h3>
                        {prize.cash_value > 0 && (
                          <p className="text-green-400 text-sm font-semibold">
                            Win £{(prize.cash_value / 100).toFixed(0)}
                          </p>
                        )}
                        {prize.points_value > 0 && (
                          <p className="text-purple-400 text-xs">+{prize.points_value} points</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <p className="text-slate-400 text-sm leading-relaxed mb-3">{prize.description}</p>

                  {winner ? (
                    <div className="flex items-center gap-2 bg-green-500/10 rounded-lg px-3 py-2 border border-green-500/20">
                      <span className="text-base">🏆</span>
                      <div>
                        <p className="text-green-300 text-xs font-medium">Winner!</p>
                        <p className="text-white text-sm font-semibold">
                          {winner === 'Someone' ? (
                            'Someone'
                          ) : (
                            <MemberLink displayName={winner} className="text-white font-semibold" />
                          )}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 bg-slate-700/50 rounded-lg px-3 py-2">
                      <span className="text-base">✨</span>
                      <p className="text-slate-400 text-xs font-medium">Up for grabs!</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
