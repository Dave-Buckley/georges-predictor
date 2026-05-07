'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, XCircle, Clock, Pencil, Save, X as XIcon } from 'lucide-react'
import type { FixtureWithTeams } from '@/lib/supabase/types'
import { MemberLink } from '@/components/shared/member-link'
import { confirmBonusAward } from '@/actions/admin/bonuses'
import { adjustPoints } from '@/actions/admin/adjustments'

interface PredictionEntry {
  member_id: string
  fixture_id: string
  home_score: number
  away_score: number
}

interface BonusInfo {
  awardId: string
  typeName: string
  fixtureLabel: string | null
  awarded: boolean | null
  pointsAwarded: number
}

interface MemberRow {
  id: string
  display_name: string
  bonus: BonusInfo | null
  weeklyPoints: number
}

interface PredictionsTableProps {
  gameweekId: string
  gameweekNumber: number
  members: MemberRow[]
  fixtures: FixtureWithTeams[]
  predictions: PredictionEntry[]
}

/**
 * Admin grid showing all members' predictions for a gameweek, plus inline
 * Bonus Y/N approval and a manual Total Score editor per member.
 *
 * Rows = approved members (sorted alphabetically by display_name)
 * Columns = fixtures in the gameweek (sorted by kickoff_time), then bonus
 *           pick / approval, then editable weekly total, then status.
 */
export function PredictionsTable({
  gameweekId,
  gameweekNumber,
  members,
  fixtures,
  predictions,
}: PredictionsTableProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [actionError, setActionError] = useState<string | null>(null)

  if (members.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
        <p className="text-gray-500 text-sm">No approved members found.</p>
      </div>
    )
  }

  if (fixtures.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
        <p className="text-gray-500 text-sm">No fixtures in this gameweek.</p>
      </div>
    )
  }

  // Build a lookup: member_id + fixture_id -> prediction
  const predictionMap = new Map<string, PredictionEntry>()
  for (const pred of predictions) {
    predictionMap.set(`${pred.member_id}:${pred.fixture_id}`, pred)
  }

  // Members who have submitted at least one prediction
  const submittedMemberIds = new Set(predictions.map((p) => p.member_id))

  // Sort alphabetically (server may have done this already, but ensure it)
  const sortedMembers = [...members].sort((a, b) =>
    a.display_name.localeCompare(b.display_name),
  )

  const startEdit = (row: MemberRow) => {
    setEditingMemberId(row.id)
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
    fd.set('note', `Edited from All Predictions (GW${gameweekNumber})`)

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

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {/* Sticky member name column header */}
                <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap min-w-[160px] border-r border-gray-200">
                  Member
                </th>
                {/* Fixture columns */}
                {fixtures.map((fixture) => {
                  const homeTla = fixture.home_team.tla ?? fixture.home_team.short_name ?? fixture.home_team.name.slice(0, 3).toUpperCase()
                  const awayTla = fixture.away_team.tla ?? fixture.away_team.short_name ?? fixture.away_team.name.slice(0, 3).toUpperCase()
                  return (
                    <th
                      key={fixture.id}
                      className="px-3 py-3 text-center font-semibold text-gray-600 whitespace-nowrap min-w-[80px] border-r border-gray-100"
                      title={`${fixture.home_team.name} vs ${fixture.away_team.name}`}
                    >
                      <div className="text-xs leading-tight">
                        <div>{homeTla}</div>
                        <div className="text-gray-400 text-[10px]">vs</div>
                        <div>{awayTla}</div>
                      </div>
                    </th>
                  )
                })}
                {/* Status column */}
                <th className="px-3 py-3 text-center font-semibold text-gray-600 whitespace-nowrap min-w-[90px] border-r border-gray-200 bg-gray-50">
                  Status
                </th>
                {/* Bonus Y/N */}
                <th className="px-3 py-3 text-left font-semibold text-gray-600 whitespace-nowrap min-w-[200px] border-r border-gray-200 bg-gray-50">
                  Bonus Y/N
                </th>
                {/* Total Score */}
                <th className="px-3 py-3 text-right font-semibold text-gray-600 whitespace-nowrap min-w-[120px] bg-gray-50">
                  Total Score
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedMembers.map((member, rowIdx) => {
                const hasSubmitted = submittedMemberIds.has(member.id)
                const isEvenRow = rowIdx % 2 === 0
                const isEditing = editingMemberId === member.id
                const isGoldenGlory = member.bonus?.typeName === 'Golden Glory'

                return (
                  <tr
                    key={member.id}
                    className={isEvenRow ? 'bg-white' : 'bg-gray-50/50'}
                  >
                    {/* Sticky member name */}
                    <td className={`sticky left-0 z-10 px-4 py-2.5 font-medium text-gray-800 whitespace-nowrap border-r border-gray-200 ${isEvenRow ? 'bg-white' : 'bg-gray-50/50'}`}>
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
                            hasSubmitted ? 'bg-green-500' : 'bg-red-400'
                          }`}
                          title={hasSubmitted ? 'Has submitted' : 'No predictions submitted'}
                        />
                        <MemberLink displayName={member.display_name} className="text-sm" />
                      </div>
                    </td>

                    {/* Prediction cells */}
                    {fixtures.map((fixture) => {
                      const pred = predictionMap.get(`${member.id}:${fixture.id}`)
                      const hasResult =
                        fixture.home_score !== null && fixture.away_score !== null
                      const isExact =
                        hasResult &&
                        pred !== undefined &&
                        pred.home_score === fixture.home_score &&
                        pred.away_score === fixture.away_score
                      const sign = (h: number, a: number) =>
                        h > a ? 'H' : h < a ? 'A' : 'D'
                      const isResultCorrect =
                        hasResult &&
                        pred !== undefined &&
                        !isExact &&
                        sign(pred.home_score, pred.away_score) ===
                          sign(fixture.home_score!, fixture.away_score!)

                      return (
                        <td
                          key={fixture.id}
                          className={`px-3 py-2.5 text-center text-sm border-r border-gray-100 ${
                            isExact
                              ? 'bg-green-50 text-green-800 font-semibold'
                              : isResultCorrect
                                ? 'bg-blue-50 text-blue-800 font-semibold'
                                : pred
                                  ? 'text-gray-700'
                                  : 'text-gray-300'
                          }`}
                          title={
                            isExact
                              ? 'Correct score (30 pts)'
                              : isResultCorrect
                                ? 'Correct result (10 pts)'
                                : undefined
                          }
                        >
                          {pred ? `${pred.home_score}-${pred.away_score}` : '—'}
                        </td>
                      )
                    })}

                    {/* Status */}
                    <td className="px-3 py-2.5 text-center border-r border-gray-200">
                      {hasSubmitted ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          Submitted
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-500">
                          Pending
                        </span>
                      )}
                    </td>

                    {/* Bonus Y/N */}
                    <td className="px-3 py-2.5 border-r border-gray-200">
                      {member.bonus ? (
                        <div className="space-y-1">
                          <div className="text-xs">
                            <span className="font-medium text-gray-800">
                              {member.bonus.typeName}
                            </span>
                            {member.bonus.fixtureLabel && (
                              <span className="text-gray-400">
                                {' '}· {member.bonus.fixtureLabel}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-wrap">
                            {isGoldenGlory ? (
                              <>
                                <button
                                  type="button"
                                  disabled={isPending}
                                  onClick={() => submitBonus(member.bonus!.awardId, true, 10)}
                                  className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-medium transition-colors disabled:opacity-50 ${
                                    member.bonus.awarded === true && member.bonus.pointsAwarded === 10
                                      ? 'bg-green-100 border-green-400 text-green-800'
                                      : 'bg-green-50 hover:bg-green-100 border-green-200 text-green-700'
                                  }`}
                                >
                                  10pt
                                </button>
                                <button
                                  type="button"
                                  disabled={isPending}
                                  onClick={() => submitBonus(member.bonus!.awardId, true, 30)}
                                  className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                                    member.bonus.awarded === true && member.bonus.pointsAwarded === 30
                                      ? 'bg-emerald-200 border-emerald-500 text-emerald-900'
                                      : 'bg-emerald-100 hover:bg-emerald-200 border-emerald-300 text-emerald-800'
                                  }`}
                                >
                                  30pt
                                </button>
                                <button
                                  type="button"
                                  disabled={isPending}
                                  onClick={() => submitBonus(member.bonus!.awardId, false, 0)}
                                  className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-medium transition-colors disabled:opacity-50 ${
                                    member.bonus.awarded === false
                                      ? 'bg-red-100 border-red-400 text-red-800'
                                      : 'bg-red-50 hover:bg-red-100 border-red-200 text-red-700'
                                  }`}
                                >
                                  No
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  disabled={isPending}
                                  onClick={() => submitBonus(member.bonus!.awardId, true)}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium transition-colors disabled:opacity-50 ${
                                    member.bonus.awarded === true
                                      ? 'bg-green-100 border-green-400 text-green-800'
                                      : 'bg-green-50 hover:bg-green-100 border-green-200 text-green-700'
                                  }`}
                                >
                                  <CheckCircle className="w-3 h-3" /> Yes
                                </button>
                                <button
                                  type="button"
                                  disabled={isPending}
                                  onClick={() => submitBonus(member.bonus!.awardId, false)}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium transition-colors disabled:opacity-50 ${
                                    member.bonus.awarded === false
                                      ? 'bg-red-100 border-red-400 text-red-800'
                                      : 'bg-red-50 hover:bg-red-100 border-red-200 text-red-700'
                                  }`}
                                >
                                  <XCircle className="w-3 h-3" /> No
                                </button>
                              </>
                            )}
                            {member.bonus.awarded === null && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">
                                <Clock className="w-3 h-3" /> Pending
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">No pick</span>
                      )}
                    </td>

                    {/* Total Score (editable) */}
                    <td className="px-3 py-2.5 text-right">
                      {isEditing ? (
                        <div className="inline-flex items-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') submitEdit(member.id)
                              if (e.key === 'Escape') cancelEdit()
                            }}
                            autoFocus
                            className="w-20 px-2 py-1 text-sm text-right border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-400 tabular-nums"
                          />
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => submitEdit(member.id)}
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
                          onClick={() => startEdit(member)}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-gray-100 group"
                          title="Edit weekly score"
                        >
                          <span className="font-bold text-gray-900 tabular-nums">
                            {member.weeklyPoints}
                          </span>
                          <Pencil className="w-3 h-3 text-gray-400 group-hover:text-gray-700" />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Tap the total to override it — your change is saved as an adjustment so the standings stay in sync.
      </p>
    </div>
  )
}
