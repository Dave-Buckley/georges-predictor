/**
 * HomeRankWidget — dashboard strip showing viewer's rank + 2 neighbours on
 * each side. Phase 11 Plan 02 Task 3.
 *
 * Returns null when viewer is not a member (e.g. admin-only user) so the
 * dashboard layout doesn't carry an empty card.
 */
import Link from 'next/link'

import { MemberLink } from '@/components/shared/member-link'

export interface HomeRankWidgetMember {
  memberId: string
  displayName: string
  rank: number
  totalPoints: number
}

interface HomeRankWidgetProps {
  viewerMemberId: string | null
  members: HomeRankWidgetMember[]
}

export function HomeRankWidget({
  viewerMemberId,
  members,
}: HomeRankWidgetProps) {
  if (!viewerMemberId) return null

  const sorted = [...members].sort((a, b) => a.rank - b.rank)
  const viewerIndex = sorted.findIndex((m) => m.memberId === viewerMemberId)
  if (viewerIndex === -1) return null

  // Slice [viewerIndex - 2, viewerIndex + 2] clamped to array bounds.
  const start = Math.max(0, viewerIndex - 2)
  const end = Math.min(sorted.length, viewerIndex + 3)
  const slice = sorted.slice(start, end)

  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          Your position
        </h2>
        <Link
          href="/standings"
          className="text-xs text-purple-400 hover:text-purple-300 transition font-medium"
        >
          View full league table &rarr;
        </Link>
      </div>
      <div className="divide-y divide-slate-800">
        {slice.map((m) => {
          const isViewer = m.memberId === viewerMemberId
          return (
            <div
              key={m.memberId}
              data-testid="rank-row"
              data-row-variant={isViewer ? 'rank-row-viewer' : 'rank-row-other'}
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
              <span className="text-sm font-bold text-purple-300 tabular-nums">
                {m.totalPoints}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default HomeRankWidget
