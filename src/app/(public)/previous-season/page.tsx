/**
 * Public "Previous Season" page — the permanent home for last season's final
 * league table and champion. Reads the immutable static snapshot in
 * src/lib/history/season-2025-26.ts (captured before the 2026/27 reset zeroed
 * members.starting_points), so this record survives every future season reset.
 */
import Link from 'next/link'
import type { Metadata } from 'next'
import { Crown, Trophy, ArrowLeft } from 'lucide-react'
import { SEASON_2025_26 } from '@/lib/history/season-2025-26'
import { MemberLink } from '@/components/shared/member-link'

export const metadata: Metadata = {
  title: `${SEASON_2025_26.label} Final Table — King Predictor`,
}

export default function PreviousSeasonPage() {
  const { label, champion, runnerUp, third, table } = SEASON_2025_26

  return (
    <div className="text-white">
      <main className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        <header className="space-y-3">
          <Link
            href="/standings"
            className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to this season
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-400" />
            {label} Final Table
          </h1>
          <p className="text-slate-400 text-sm">
            The final standings from the {label} season — preserved for the
            record books.
          </p>
        </header>

        {/* Champion highlight */}
        <section className="rounded-2xl border border-yellow-500/40 bg-gradient-to-br from-yellow-900/30 to-amber-900/20 p-6 text-center space-y-2">
          <p className="text-xs font-semibold text-yellow-400 uppercase tracking-widest">
            {label} Champion
          </p>
          <div className="flex items-center justify-center gap-2">
            <Crown className="w-7 h-7 text-yellow-400 fill-yellow-400" />
            <MemberLink displayName={champion} className="text-3xl font-bold text-white" />
          </div>
          <p className="text-sm text-slate-300">
            {table[0]?.points.toLocaleString()} points
          </p>
          {(runnerUp || third) && (
            <p className="text-sm text-slate-400 pt-1">
              Runner-up: <span className="text-slate-200 font-medium">{runnerUp}</span>
              {third && (
                <>
                  {' '}&middot; Third:{' '}
                  <span className="text-slate-200 font-medium">{third}</span>
                </>
              )}
            </p>
          )}
        </section>

        {/* Full final table */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-200">Final Standings</h2>
          <div className="rounded-2xl border border-slate-700 bg-slate-900 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/60">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider w-12">
                    Rank
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Member
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Points
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {table.map((row) => {
                  const isChampion = row.rank === 1
                  return (
                    <tr key={`${row.rank}-${row.name}`} className={isChampion ? 'bg-purple-500/10' : ''}>
                      <td className="px-4 py-3 font-medium text-slate-300">{row.rank}</td>
                      <td className="px-4 py-3 text-white font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          {isChampion && (
                            <Crown
                              className="w-4 h-4 text-yellow-400 fill-yellow-400 flex-shrink-0"
                              aria-label="Season winner"
                            />
                          )}
                          <MemberLink displayName={row.name} className="text-white font-medium" />
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-bold text-purple-300">
                        {row.points.toLocaleString()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}
