/**
 * Admin pre-season monitoring table (Phase 9 Plan 03).
 *
 * Server component. Lists every approved member with submission status for
 * the current / upcoming season. Non-submitted rows get a LateJoinerPicksDialog
 * trigger so George can enter picks on their behalf.
 */

import { LateJoinerPicksDialog } from '@/components/admin/late-joiner-picks-dialog'
import type { PreSeasonExportRow } from '@/lib/pre-season/export'

export interface AdminPreSeasonTableProps {
  season: number
  plTeams: Array<{ name: string }>
  championship: readonly string[]
  /** One row per member (approved). Non-submitted members have null pick fields. */
  rows: AdminPreSeasonRow[]
}

export interface AdminPreSeasonRow {
  member_id: string
  member_name: string
  submitted: boolean
  submitted_by_admin: boolean
  submitted_at: string | null
  top4: string[]
  tenth_place: string
  relegated: string[]
  promoted: string[]
  promoted_playoff_winner: string
}

/**
 * Helper: convert PreSeasonExportRow + full member list into table rows.
 * Members without a picks row are shown as "Not submitted".
 */
export function buildAdminPreSeasonRows(
  members: Array<{ id: string; display_name: string }>,
  exportRows: PreSeasonExportRow[],
): AdminPreSeasonRow[] {
  const byMember = new Map<string, PreSeasonExportRow>()
  for (const r of exportRows) byMember.set(r.member_id, r)

  const rows: AdminPreSeasonRow[] = members.map((m) => {
    const r = byMember.get(m.id)
    if (!r) {
      return {
        member_id: m.id,
        member_name: m.display_name,
        submitted: false,
        submitted_by_admin: false,
        submitted_at: null,
        top4: [],
        tenth_place: '',
        relegated: [],
        promoted: [],
        promoted_playoff_winner: '',
      }
    }
    return {
      member_id: m.id,
      member_name: r.member_name,
      submitted: true,
      submitted_by_admin: r.submitted_by_admin,
      submitted_at: r.submitted_at,
      top4: r.top4,
      tenth_place: r.tenth_place,
      relegated: r.relegated,
      promoted: r.promoted,
      promoted_playoff_winner: r.promoted_playoff_winner,
    }
  })

  // Sort: not-submitted first (to grab George's attention), then alpha
  rows.sort((a, b) => {
    if (a.submitted !== b.submitted) return a.submitted ? 1 : -1
    return a.member_name.localeCompare(b.member_name)
  })

  return rows
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function AdminPreSeasonTable({
  season,
  plTeams,
  championship,
  rows,
}: AdminPreSeasonTableProps) {
  const submittedCount = rows.filter((r) => r.submitted).length
  const total = rows.length

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-semibold text-gray-900">Member submissions</h2>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
          {submittedCount}/{total} submitted
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Member
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Status
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Top 4
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                10th
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Relegated
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Promoted
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Playoff
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Submitted
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-gray-400 text-sm">
                  No members yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.member_id} className="bg-white hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {row.member_name}
                  </td>
                  <td className="px-4 py-3">
                    {row.submitted ? (
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          Submitted
                        </span>
                        {row.submitted_by_admin && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                            admin-entered
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                        Not submitted
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {row.submitted ? row.top4.join(', ') : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {row.submitted ? row.tenth_place : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {row.submitted ? row.relegated.join(', ') : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {row.submitted ? row.promoted.join(', ') : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {row.submitted ? row.promoted_playoff_winner : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {formatDate(row.submitted_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <LateJoinerPicksDialog
                      memberId={row.member_id}
                      memberName={row.member_name}
                      season={season}
                      plTeams={plTeams}
                      championship={championship}
                      existingPicks={
                        row.submitted
                          ? {
                              id: '',
                              member_id: row.member_id,
                              season,
                              top4: row.top4,
                              tenth_place: row.tenth_place,
                              relegated: row.relegated,
                              promoted: row.promoted,
                              promoted_playoff_winner: row.promoted_playoff_winner,
                              imported_by: null,
                              imported_at: '',
                              submitted_by_admin: row.submitted_by_admin,
                              submitted_at: row.submitted_at,
                            }
                          : null
                      }
                      trigger={
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 text-xs font-medium transition-colors"
                        >
                          {row.submitted ? 'Edit picks' : 'Set picks'}
                        </button>
                      }
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
