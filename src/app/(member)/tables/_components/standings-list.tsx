import { MemberLink } from '@/components/shared/member-link'
import type { StandingsRow } from '@/lib/standings/get-standings-at-gameweek'

interface Props {
  rows: StandingsRow[]
  viewerMemberId: string | null
  weeklyLabel: string
}

export function StandingsList({ rows, viewerMemberId, weeklyLabel }: Props) {
  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          League table
        </h2>
        <div className="flex items-center gap-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider pr-1">
          <span className="w-14 text-right">{weeklyLabel}</span>
          <span className="w-12 text-right">Total</span>
        </div>
      </div>
      <div className="divide-y divide-slate-800">
        {rows.map((m) => {
          const isViewer = m.memberId === viewerMemberId
          return (
            <div
              key={m.memberId}
              className={`flex items-center justify-between gap-3 px-3 py-2.5 ${
                isViewer
                  ? 'bg-pl-purple/20 border-l-2 border-pl-green -mx-3 px-5'
                  : ''
              }`}
            >
              <span className="text-sm font-semibold text-slate-400 w-8 tabular-nums">
                #{m.rank}
              </span>
              <span className="flex-1 text-sm">
                {isViewer ? (
                  <span className="text-white font-medium">
                    {m.displayName}{' '}
                    <span className="text-xs text-pl-green">(you)</span>
                  </span>
                ) : (
                  <MemberLink
                    displayName={m.displayName}
                    className="text-slate-200"
                  />
                )}
              </span>
              <span className="text-xs text-slate-400 tabular-nums w-14 text-right">
                {m.weeklyPoints > 0 ? `+${m.weeklyPoints}` : m.weeklyPoints}
              </span>
              <span className="text-sm font-bold text-purple-300 tabular-nums w-12 text-right">
                {m.totalPoints}
              </span>
            </div>
          )
        })}
        {rows.length === 0 && (
          <div className="px-3 py-6 text-center text-slate-500 text-sm">
            No members yet.
          </div>
        )}
      </div>
    </section>
  )
}
