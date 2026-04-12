/**
 * SeasonHistoryTable — previous-season row list for the member profile.
 * Phase 11 Plan 02 Task 2.
 */

export interface SeasonHistoryEntry {
  season: number
  rank: number | null
  totalPoints: number
  losWins: number
  gwWinnerCount: number
}

interface SeasonHistoryTableProps {
  entries: SeasonHistoryEntry[]
  memberDisplayName: string
}

export function SeasonHistoryTable({
  entries,
  memberDisplayName,
}: SeasonHistoryTableProps) {
  if (entries.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          Previous seasons
        </h2>
        <p className="text-sm text-slate-500 rounded-xl border border-dashed border-slate-700 bg-slate-900/40 px-4 py-6 text-center">
          No previous seasons — this is {memberDisplayName}&apos;s first season!
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
        Previous seasons
      </h2>
      <div className="rounded-2xl border border-slate-700 bg-slate-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-800/60">
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Season
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Rank
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Total
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                GW wins
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                LOS wins
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {entries.map((e) => (
              <tr key={e.season}>
                <td className="px-4 py-3 font-medium text-white">
                  {e.season}/{String((e.season + 1) % 100).padStart(2, '0')}
                </td>
                <td className="px-4 py-3 text-slate-300">
                  {e.rank == null ? '—' : `#${e.rank}`}
                </td>
                <td className="px-4 py-3 text-right text-purple-300 font-bold">
                  {e.totalPoints}
                </td>
                <td className="px-4 py-3 text-right text-slate-300">
                  {e.gwWinnerCount}
                </td>
                <td className="px-4 py-3 text-right text-slate-300">
                  {e.losWins}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default SeasonHistoryTable
