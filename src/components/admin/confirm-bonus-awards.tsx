'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, Clock } from 'lucide-react'
import { confirmBonusAward, bulkConfirmBonusAwards } from '@/actions/admin/bonuses'

interface BonusAwardItem {
  id: string
  member_display_name: string
  bonus_type_name: string
  fixture_label: string | null
  awarded: boolean | null
}

interface ConfirmBonusAwardsProps {
  gameweekId: string
  gameweekNumber: number
  awards: BonusAwardItem[]
}

export function ConfirmBonusAwards({
  gameweekId,
  gameweekNumber,
  awards,
}: ConfirmBonusAwardsProps) {
  const [showUnreviewedOnly, setShowUnreviewedOnly] = useState(false)

  const filteredAwards = showUnreviewedOnly
    ? awards.filter((a) => a.awarded === null)
    : awards

  const pendingCount = awards.filter((a) => a.awarded === null).length

  if (awards.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
        <p className="text-gray-500 font-medium">No bonus awards pending for this gameweek</p>
        <p className="text-gray-400 text-sm mt-1">
          Awards will appear here after members submit their bonus picks and the gameweek closes.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with bulk actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-900">
            GW{gameweekNumber} Bonus Awards
          </h3>
          {pendingCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
              {pendingCount} pending
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showUnreviewedOnly}
              onChange={(e) => setShowUnreviewedOnly(e.target.checked)}
              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            Show unreviewed only
          </label>

          {pendingCount > 0 && (
            <form
              action={bulkConfirmBonusAwards as unknown as (formData: FormData) => void}
              onSubmit={(e) => {
                // Optimistic: form submits normally (server action)
                void e
              }}
            >
              <input type="hidden" name="gameweek_id" value={gameweekId} />
              <input type="hidden" name="action" value="approve_all" />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 text-xs font-medium transition-colors"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Approve All Eligible
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Awards table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Member
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Bonus Pick
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Status
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredAwards.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400 text-sm">
                  No awards to show
                </td>
              </tr>
            ) : (
              filteredAwards.map((award) => (
                <tr key={award.id} className="bg-white hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {award.member_display_name}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    <div>
                      <span className="font-medium text-gray-800">{award.bonus_type_name}</span>
                      {award.fixture_label && (
                        <p className="text-xs text-gray-400 mt-0.5">{award.fixture_label}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {award.awarded === null ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                        <Clock className="w-3 h-3" />
                        Pending
                      </span>
                    ) : award.awarded ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        <CheckCircle className="w-3 h-3" />
                        Approved
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                        <XCircle className="w-3 h-3" />
                        Rejected
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {award.awarded === null ? (
                      <div className="flex items-center justify-end gap-2">
                        <form action={confirmBonusAward as unknown as (formData: FormData) => void}>
                          <input type="hidden" name="award_id" value={award.id} />
                          <input type="hidden" name="awarded" value="true" />
                          <button
                            type="submit"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 text-xs font-medium transition-colors"
                          >
                            <CheckCircle className="w-3 h-3" />
                            Approve
                          </button>
                        </form>
                        <form action={confirmBonusAward as unknown as (formData: FormData) => void}>
                          <input type="hidden" name="award_id" value={award.id} />
                          <input type="hidden" name="awarded" value="false" />
                          <button
                            type="submit"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-medium transition-colors"
                          >
                            <XCircle className="w-3 h-3" />
                            Reject
                          </button>
                        </form>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 text-right block">Reviewed</span>
                    )}
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
