/**
 * SeasonStatsPanel — grid of stat cards for the current season.
 * Phase 11 Plan 02 Task 2.
 */
import type { SeasonStats } from '@/lib/profile/stats'

interface SeasonStatsPanelProps {
  stats: SeasonStats
}

interface StatCardProps {
  label: string
  value: string
  subtext?: string
}

function StatCard({ label, value, subtext }: StatCardProps) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-1">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
        {label}
      </p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {subtext ? (
        <p className="text-xs text-slate-500">{subtext}</p>
      ) : null}
    </div>
  )
}

function formatLosStatus(status: SeasonStats['losStatus']): string {
  switch (status) {
    case 'winner':
      return 'Winner'
    case 'active':
      return 'Active'
    case 'eliminated':
      return 'Eliminated'
    case 'not-participating':
      return 'Not in'
    default:
      return '—'
  }
}

export function SeasonStatsPanel({ stats }: SeasonStatsPanelProps) {
  const accuracyPct = Math.round(stats.predictionAccuracy * 100)
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
        Current season ({stats.season})
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard
          label="Total points"
          value={String(stats.totalPoints)}
        />
        <StatCard
          label="Rank"
          value={stats.rank == null ? '—' : `#${stats.rank}`}
        />
        <StatCard
          label="Accuracy"
          value={`${accuracyPct}%`}
          subtext={`${stats.correctResults + stats.correctScores} correct predictions`}
        />
        <StatCard
          label="Correct results"
          value={String(stats.correctResults)}
        />
        <StatCard
          label="Correct scores"
          value={String(stats.correctScores)}
        />
        <StatCard
          label="Last One Standing"
          value={formatLosStatus(stats.losStatus)}
          subtext={
            stats.losStatus !== 'not-participating'
              ? `${stats.losTeamsUsed} team${stats.losTeamsUsed === 1 ? '' : 's'} used`
              : undefined
          }
        />
      </div>
    </section>
  )
}

export default SeasonStatsPanel
