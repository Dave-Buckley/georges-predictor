/**
 * Side-by-side stat comparison. Highlights the winner of each row.
 */
import type { SeasonStats } from '@/lib/profile/stats'

interface CompareStatsProps {
  a: { displayName: string; stats: SeasonStats }
  b: { displayName: string; stats: SeasonStats }
}

interface Row {
  label: string
  aValue: number
  bValue: number
  format: (n: number) => string
  /** higherIsBetter? — rank inverts this. */
  higherIsBetter: boolean
  subtextA?: string
  subtextB?: string
}

function buildRows(a: SeasonStats, b: SeasonStats): Row[] {
  const fmt = (n: number) => String(n)
  const pct = (n: number) => `${Math.round(n * 100)}%`
  const rank = (n: number | null) => (n == null ? '—' : `#${n}`)

  return [
    {
      label: 'Total points',
      aValue: a.totalPoints,
      bValue: b.totalPoints,
      format: fmt,
      higherIsBetter: true,
    },
    {
      label: 'Rank',
      aValue: a.rank ?? Number.POSITIVE_INFINITY,
      bValue: b.rank ?? Number.POSITIVE_INFINITY,
      format: (n) => (Number.isFinite(n) ? rank(n) : '—'),
      higherIsBetter: false,
    },
    {
      label: 'Accuracy',
      aValue: a.predictionAccuracy,
      bValue: b.predictionAccuracy,
      format: pct,
      higherIsBetter: true,
    },
    {
      label: 'Correct results',
      aValue: a.correctResults,
      bValue: b.correctResults,
      format: fmt,
      higherIsBetter: true,
    },
    {
      label: 'Exact scores',
      aValue: a.correctScores,
      bValue: b.correctScores,
      format: fmt,
      higherIsBetter: true,
    },
    {
      label: 'GW wins',
      aValue: a.gwWinnerCount,
      bValue: b.gwWinnerCount,
      format: fmt,
      higherIsBetter: true,
    },
    {
      label: 'LoS wins',
      aValue: a.losWins,
      bValue: b.losWins,
      format: fmt,
      higherIsBetter: true,
    },
    {
      label: 'Bonus confirm rate',
      aValue: a.bonusConfirmationRate,
      bValue: b.bonusConfirmationRate,
      format: pct,
      higherIsBetter: true,
    },
    {
      label: 'Achievements',
      aValue: a.achievements.length,
      bValue: b.achievements.length,
      format: fmt,
      higherIsBetter: true,
    },
  ]
}

function rowWinner(row: Row): 'a' | 'b' | 'tie' {
  if (row.aValue === row.bValue) return 'tie'
  const aBetter = row.higherIsBetter
    ? row.aValue > row.bValue
    : row.aValue < row.bValue
  return aBetter ? 'a' : 'b'
}

export function CompareStats({ a, b }: CompareStatsProps) {
  const rows = buildRows(a.stats, b.stats)

  let aWins = 0
  let bWins = 0
  for (const r of rows) {
    const w = rowWinner(r)
    if (w === 'a') aWins++
    else if (w === 'b') bWins++
  }

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
        <div className="text-lg font-bold text-white truncate">
          {a.displayName}
        </div>
        <div className="text-xs text-slate-500 uppercase tracking-wider">
          vs
        </div>
        <div className="text-lg font-bold text-white truncate">
          {b.displayName}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center text-sm">
        <div
          className={`rounded-lg px-3 py-2 font-semibold ${
            aWins > bWins
              ? 'bg-green-500/20 text-green-200'
              : 'bg-slate-800 text-slate-300'
          }`}
        >
          Wins {aWins}
        </div>
        <div />
        <div
          className={`rounded-lg px-3 py-2 font-semibold ${
            bWins > aWins
              ? 'bg-green-500/20 text-green-200'
              : 'bg-slate-800 text-slate-300'
          }`}
        >
          Wins {bWins}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-900 divide-y divide-slate-800">
        {rows.map((r) => {
          const w = rowWinner(r)
          return (
            <div
              key={r.label}
              className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-3"
            >
              <div
                className={`text-right text-base tabular-nums ${
                  w === 'a'
                    ? 'font-bold text-green-300'
                    : w === 'tie'
                      ? 'text-slate-200'
                      : 'text-slate-400'
                }`}
              >
                {r.format(r.aValue)}
              </div>
              <div className="text-center text-xs text-slate-500 uppercase tracking-wider whitespace-nowrap px-2">
                {r.label}
              </div>
              <div
                className={`text-left text-base tabular-nums ${
                  w === 'b'
                    ? 'font-bold text-green-300'
                    : w === 'tie'
                      ? 'text-slate-200'
                      : 'text-slate-400'
                }`}
              >
                {r.format(r.bValue)}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default CompareStats
