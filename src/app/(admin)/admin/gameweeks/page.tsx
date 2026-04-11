import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { SyncStatus } from '@/components/admin/sync-status'
import type { GameweekRow, SyncLogRow } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

async function getGameweeksData() {
  try {
    const supabase = createAdminClient()

    const [gameweeksResult, syncLogResult] = await Promise.all([
      supabase
        .from('gameweeks')
        .select(`
          id,
          number,
          season,
          status,
          created_at,
          fixtures(count)
        `)
        .order('number'),
      supabase
        .from('sync_log')
        .select('*')
        .order('synced_at', { ascending: false })
        .limit(1)
        .single(),
    ])

    type GameweekWithCount = GameweekRow & { fixtures: [{ count: number }] }
    const gameweeks = (gameweeksResult.data ?? []) as GameweekWithCount[]
    // sync_log single() returns error if no rows — that's fine
    const latestSync = syncLogResult.data as SyncLogRow | null

    return { gameweeks, latestSync }
  } catch {
    return { gameweeks: [], latestSync: null }
  }
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  scheduled: {
    label: 'Scheduled',
    className: 'bg-gray-100 text-gray-600',
  },
  active: {
    label: 'Active',
    className: 'bg-amber-100 text-amber-700',
  },
  complete: {
    label: 'Complete',
    className: 'bg-green-100 text-green-700',
  },
}

export default async function AdminGameweeksPage() {
  const { gameweeks, latestSync } = await getGameweeksData()

  const hasGameweeks = gameweeks.length > 0

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Gameweeks</h1>
        <p className="text-gray-500 mt-1">Manage fixtures and sync from football-data.org.</p>
      </div>

      {/* Sync status bar */}
      <div className="mb-8">
        <SyncStatus lastSync={latestSync} />
      </div>

      {!hasGameweeks ? (
        /* No gameweeks — first sync CTA */
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-8 text-center">
          <p className="text-lg font-semibold text-purple-900 mb-2">No fixtures yet</p>
          <p className="text-purple-700 text-sm mb-6">
            Click &quot;Sync Now&quot; above to fetch all Premier League fixtures from football-data.org.
            This will populate all 38 gameweeks automatically.
          </p>
          <p className="text-xs text-purple-500">
            The first sync may take a few seconds. You only need to do this once.
          </p>
        </div>
      ) : (
        /* Gameweeks table */
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-5 py-3 text-left font-semibold text-gray-600">Gameweek</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-600">Fixtures</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-600">Status</th>
                <th className="px-5 py-3 text-right font-semibold text-gray-600"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {gameweeks.map((gw) => {
                const count = Array.isArray(gw.fixtures) && gw.fixtures[0]
                  ? (gw.fixtures[0] as unknown as { count: number }).count
                  : 0
                const statusInfo = STATUS_STYLES[gw.status] ?? STATUS_STYLES.scheduled

                return (
                  <tr key={gw.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <span className="font-semibold text-gray-900">GW {gw.number}</span>
                    </td>
                    <td className="px-5 py-4 text-gray-600">
                      {count} fixture{count !== 1 ? 's' : ''}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.className}`}
                      >
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/admin/gameweeks/${gw.number}`}
                        className="text-purple-600 hover:text-purple-700 font-medium text-xs"
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
