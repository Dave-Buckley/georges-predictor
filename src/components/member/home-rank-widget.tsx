/**
 * HomeRankWidget — dashboard strip showing viewer's rank with a window of
 * 10 members above + viewer + 2 below (clamped to list bounds).
 *
 * Returns null when viewer is not a member (e.g. admin-only user) so the
 * dashboard layout doesn't carry an empty card.
 */
import Link from 'next/link'

import { MemberLink } from '@/components/shared/member-link'

const ROWS_ABOVE = 10
const ROWS_BELOW = 2

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

  const start = Math.max(0, viewerIndex - ROWS_ABOVE)
  const end = Math.min(sorted.length, viewerIndex + ROWS_BELOW + 1)
  const slice = sorted.slice(start, end)

  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          Your position
        </h2>
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
      <Link
        href="/standings"
        className="block w-full text-center px-4 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition"
      >
        View full league table &rarr;
      </Link>
    </section>
  )
}

export default HomeRankWidget
