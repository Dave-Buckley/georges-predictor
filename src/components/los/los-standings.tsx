import { Users } from 'lucide-react'

export interface LosStandingRow {
  member_id: string
  display_name: string
  teamsUsedCount: number
  status: 'active' | 'eliminated'
  eliminatedAtGw: number | null
}

interface LosStandingsProps {
  members: LosStandingRow[]
  viewerMemberId?: string | null
}

/**
 * List of all LOS competition members with their usage counts.
 *
 * Ordering rule (per plan + RESEARCH Open Q5):
 *   - Active members first (teams-used ASC, then alphabetical display_name)
 *   - Eliminated members second (eliminated_at_gw DESC, then alphabetical)
 */
export function LosStandings({ members, viewerMemberId }: LosStandingsProps) {
  const sorted = [...members].sort((a, b) => {
    // Active first
    if (a.status !== b.status) return a.status === 'active' ? -1 : 1

    if (a.status === 'active') {
      if (a.teamsUsedCount !== b.teamsUsedCount) {
        return a.teamsUsedCount - b.teamsUsedCount
      }
      return a.display_name.localeCompare(b.display_name)
    }

    // Eliminated: most-recently-eliminated first
    const aGw = a.eliminatedAtGw ?? 0
    const bGw = b.eliminatedAtGw ?? 0
    if (aGw !== bGw) return bGw - aGw
    return a.display_name.localeCompare(b.display_name)
  })

  const activeCount = sorted.filter((m) => m.status === 'active').length

  if (sorted.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-6 text-center">
        <p className="text-slate-400 text-sm">No members enrolled yet.</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-4 h-4 text-slate-400" />
        <h3 className="text-base font-semibold text-white">Standings</h3>
        <span className="ml-auto text-xs text-slate-400">
          {activeCount} still in
        </span>
      </div>

      <ul className="divide-y divide-slate-700/70">
        {sorted.map((m) => {
          const isViewer = viewerMemberId && m.member_id === viewerMemberId
          const isActive = m.status === 'active'
          return (
            <li
              key={m.member_id}
              className={`flex items-center gap-3 py-2.5 ${
                isViewer ? 'font-semibold' : ''
              }`}
            >
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                  isActive
                    ? 'bg-green-500/20 text-green-300'
                    : 'bg-slate-700 text-slate-400'
                }`}
              >
                {isActive ? 'In' : 'Out'}
              </span>
              <span
                className={`flex-1 text-sm ${
                  isActive ? 'text-white' : 'text-slate-500 line-through'
                }`}
              >
                {m.display_name}
                {isViewer && (
                  <span className="ml-2 text-xs text-yellow-400">(you)</span>
                )}
              </span>
              <span className="text-xs text-slate-400">
                {isActive
                  ? `${m.teamsUsedCount} used`
                  : m.eliminatedAtGw
                    ? `GW${m.eliminatedAtGw}`
                    : '—'}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
