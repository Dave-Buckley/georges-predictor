'use client'

/**
 * Client-side sortable standings table.
 *
 * The server-rendered /standings page hands us the already-computed rows
 * (total + weekly points) and we handle sort state locally. Click a
 * sortable column header to switch sort key; clicking the active column
 * flips direction.
 *
 * Ties break alphabetically on display_name so the order is stable when
 * multiple members share a score.
 */

import { useMemo, useState } from 'react'

import { MemberLink } from '@/components/shared/member-link'

export interface StandingsRow {
  id: string
  display_name: string
  starting_points: number
  weekly_points: number
}

interface StandingsTableProps {
  rows: StandingsRow[]
  weeklyLabel: string
}

type SortKey = 'total' | 'weekly'
type SortDir = 'desc' | 'asc'

export function StandingsTable({ rows, weeklyLabel }: StandingsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('total')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const sorted = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => {
      const aVal = sortKey === 'total' ? a.starting_points : a.weekly_points
      const bVal = sortKey === 'total' ? b.starting_points : b.weekly_points
      if (aVal !== bVal) {
        return sortDir === 'desc' ? bVal - aVal : aVal - bVal
      }
      return a.display_name.localeCompare(b.display_name)
    })
    return copy.map((row, i) => ({ ...row, rank: i + 1 }))
  }, [rows, sortKey, sortDir])

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  function arrow(key: SortKey): string {
    if (sortKey !== key) return ''
    return sortDir === 'desc' ? ' \u2193' : ' \u2191'
  }

  return (
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
            <th className="px-0 py-0 text-right">
              <button
                type="button"
                onClick={() => handleSort('weekly')}
                aria-sort={
                  sortKey === 'weekly'
                    ? sortDir === 'desc'
                      ? 'descending'
                      : 'ascending'
                    : 'none'
                }
                className={`w-full px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider whitespace-nowrap transition ${
                  sortKey === 'weekly'
                    ? 'text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {weeklyLabel}
                {arrow('weekly')}
              </button>
            </th>
            <th className="px-0 py-0 text-right">
              <button
                type="button"
                onClick={() => handleSort('total')}
                aria-sort={
                  sortKey === 'total'
                    ? sortDir === 'desc'
                      ? 'descending'
                      : 'ascending'
                    : 'none'
                }
                className={`w-full px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider transition ${
                  sortKey === 'total'
                    ? 'text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Total
                {arrow('total')}
              </button>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {sorted.map((m) => (
            <tr key={m.id} className={m.rank === 1 ? 'bg-purple-500/10' : ''}>
              <td className="px-4 py-3 font-medium text-slate-300">
                {m.rank}
              </td>
              <td className="px-4 py-3 text-white font-medium">
                <MemberLink
                  displayName={m.display_name}
                  className="text-white font-medium"
                />
              </td>
              <td
                className={`px-4 py-3 text-right tabular-nums ${
                  sortKey === 'weekly'
                    ? 'text-pl-green font-semibold'
                    : 'text-slate-300'
                }`}
              >
                {m.weekly_points > 0 ? `+${m.weekly_points}` : m.weekly_points}
              </td>
              <td
                className={`px-4 py-3 text-right tabular-nums font-bold ${
                  sortKey === 'total' ? 'text-pl-green' : 'text-purple-300'
                }`}
              >
                {m.starting_points}
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td
                colSpan={4}
                className="px-4 py-8 text-center text-slate-500"
              >
                No members yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
