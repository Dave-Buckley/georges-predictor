'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, XCircle, Clock, Pencil, Save, X as XIcon } from 'lucide-react'
import { confirmBonusAward } from '@/actions/admin/bonuses'
import { adjustPoints } from '@/actions/admin/adjustments'

interface BonusInfo {
  awardId: string
  typeName: string
  fixtureLabel: string | null
  awarded: boolean | null
  pointsAwarded: number
}

export interface TableRow {
  memberId: string
  displayName: string
  predictionPoints: number
  weeklyPoints: number
  totalPoints: number
  hasPredictions: boolean
  bonus: BonusInfo | null
}

interface TablesViewProps {
  gameweekId: string
  gameweekNumber: number
  rows: TableRow[]
}

export function TablesView({ gameweekId, gameweekNumber, rows }: TablesViewProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [actionError, setActionError] = useState<string | null>(null)

  const startEdit = (row: TableRow) => {
    setEditingMemberId(row.memberId)
    setEditValue(String(row.weeklyPoints))
    setActionError(null)
  }

  const cancelEdit = () => {
    setEditingMemberId(null)
    setEditValue('')
  }

  const submitEdit = (memberId: string) => {
    const newTotal = parseInt(editValue, 10)
    if (isNaN(newTotal) || newTotal < 0) {
      setActionError('Enter a whole number ≥ 0')
      return
    }
    setActionError(null)
    const fd = new FormData()
    fd.set('member_id', memberId)
    fd.set('scope', 'gameweek')
    fd.set('gameweek_id', gameweekId)
    fd.set('new_total', String(newTotal))
    fd.set('note', `Edited from Tables (GW${gameweekNumber})`)

    startTransition(async () => {
      const res = await adjustPoints(fd)
      if ('error' in res) {
        setActionError(res.error)
        return
      }
      setEditingMemberId(null)
      setEditValue('')
      router.refresh()
    })
  }

  const submitBonus = (
    awardId: string,
    awarded: boolean,
    pointsOverride?: number,
  ) => {
    setActionError(null)
    const fd = new FormData()
    fd.set('award_id', awardId)
    fd.set('awarded', String(awarded))
    if (pointsOverride !== undefined) {
      fd.set('points_awarded', String(pointsOverride))
    }
    startTransition(async () => {
      const res = await confirmBonusAward(fd)
      if ('error' in res) {
        setActionError(res.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
          {actionError}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-12">
                #
              </th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Player
              </th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Bonus
              </th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Predictions
              </th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Weekly
              </th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Total
              </th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row, idx) => {
              const isEditing = editingMemberId === row.memberId
              const isGoldenGlory = row.bonus?.typeName === 'Golden Glory'

              return (
                <tr
                  key={row.memberId}
                  className={
                    row.hasPredictions ? 'bg-white' : 'bg-gray-50/60'
                  }
                >
                  <td className="px-3 py-3 text-gray-500 font-medium tabular-nums">
                    {idx + 1}
                  </td>
                  <td className="px-3 py-3 font-medium text-gray-900">
                    {row.displayName}
                  </td>

                  <td className="px-3 py-3">
                    {row.bonus ? (
                      <div className="space-y-1.5">
                        <div className="text-xs">
                          <span className="font-medium text-gray-800">
                            {row.bonus.typeName}
                          </span>
                          {row.bonus.fixtureLabel && (
                            <span className="text-gray-400">
                              {' '}
                              · {row.bonus.fixtureLabel}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {row.bonus.awarded === null ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-700">
                              <Clock className="w-3 h-3" /> Pending
                            </span>
                          ) : row.bonus.awarded ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-green-100 text-green-700">
                              <CheckCircle className="w-3 h-3" /> Yes (
                              {row.bonus.pointsAwarded}pt)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-red-100 text-red-700">
                              <XCircle className="w-3 h-3" /> No
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-wrap">
                          {isGoldenGlory ? (
                            <>
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() =>
                                  submitBonus(row.bonus!.awardId, true, 10)
                                }
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium transition-colors disabled:opacity-50 ${
                                  row.bonus.awarded === true &&
                                  row.bonus.pointsAwarded === 10
                                    ? 'bg-green-100 border-green-400 text-green-800'
                                    : 'bg-green-50 hover:bg-green-100 border-green-200 text-green-700'
                                }`}
                              >
                                10pt
                              </button>
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() =>
                                  submitBonus(row.bonus!.awardId, true, 30)
                                }
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                                  row.bonus.awarded === true &&
                                  row.bonus.pointsAwarded === 30
                                    ? 'bg-emerald-200 border-emerald-500 text-emerald-900'
                                    : 'bg-emerald-100 hover:bg-emerald-200 border-emerald-300 text-emerald-800'
                                }`}
                              >
                                30pt
                              </button>
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() =>
                                  submitBonus(row.bonus!.awardId, false, 0)
                                }
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium transition-colors disabled:opacity-50 ${
                                  row.bonus.awarded === false
                                    ? 'bg-red-100 border-red-400 text-red-800'
                                    : 'bg-red-50 hover:bg-red-100 border-red-200 text-red-700'
                                }`}
                              >
                                Reject
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() =>
                                  submitBonus(row.bonus!.awardId, true)
                                }
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium transition-colors disabled:opacity-50 ${
                                  row.bonus.awarded === true
                                    ? 'bg-green-100 border-green-400 text-green-800'
                                    : 'bg-green-50 hover:bg-green-100 border-green-200 text-green-700'
                                }`}
                              >
                                <CheckCircle className="w-3 h-3" /> Yes
                              </button>
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() =>
                                  submitBonus(row.bonus!.awardId, false)
                                }
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium transition-colors disabled:opacity-50 ${
                                  row.bonus.awarded === false
                                    ? 'bg-red-100 border-red-400 text-red-800'
                                    : 'bg-red-50 hover:bg-red-100 border-red-200 text-red-700'
                                }`}
                              >
                                <XCircle className="w-3 h-3" /> No
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>

                  <td className="px-3 py-3 text-right tabular-nums text-gray-700">
                    {row.predictionPoints}
                  </td>

                  <td className="px-3 py-3 text-right">
                    {isEditing ? (
                      <div className="inline-flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') submitEdit(row.memberId)
                            if (e.key === 'Escape') cancelEdit()
                          }}
                          autoFocus
                          className="w-20 px-2 py-1 text-sm text-right border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-400 tabular-nums"
                        />
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => submitEdit(row.memberId)}
                          className="p-1 rounded-md bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
                          aria-label="Save"
                        >
                          <Save className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="p-1 rounded-md text-gray-500 hover:bg-gray-100"
                          aria-label="Cancel"
                        >
                          <XIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEdit(row)}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-gray-100 group"
                        title="Edit weekly score"
                      >
                        <span className="font-bold text-gray-900 tabular-nums">
                          {row.weeklyPoints}
                        </span>
                        <Pencil className="w-3 h-3 text-gray-400 group-hover:text-gray-700" />
                      </button>
                    )}
                  </td>

                  <td className="px-3 py-3 text-right tabular-nums font-semibold text-gray-900">
                    {row.totalPoints}
                  </td>

                  <td className="px-3 py-3">
                    {row.hasPredictions ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        Submitted
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                        No prediction
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-gray-400 text-sm"
                >
                  No members yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500">
        Tap the weekly score to edit it — your change is recorded as an
        adjustment so the rest of the app stays in sync.
      </p>
    </div>
  )
}
