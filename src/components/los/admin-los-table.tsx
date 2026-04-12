'use client'

import { useState, useTransition } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, AlertTriangle, CheckCircle, UserX, UserCheck, RotateCcw } from 'lucide-react'
import {
  overrideEliminate,
  reinstateMember,
  resetCompetitionManually,
} from '@/actions/admin/los'

export interface AdminLosMember {
  member_id: string
  display_name: string
  email: string | null
  status: 'active' | 'eliminated'
  eliminated_at_gw: number | null
  eliminated_reason: string | null
  teamsUsed: Array<{ id: string; name: string; short_name: string | null; crest_url: string | null; gameweek_number: number }>
  currentPick: {
    team_id: string
    team_name: string
    crest_url: string | null
  } | null
}

interface AdminLosTableProps {
  competitionId: string
  competitionNumber: number
  startsAtGw: number
  season: number
  currentGwNumber: number | null
  members: AdminLosMember[]
}

type DialogMode =
  | { kind: 'none' }
  | { kind: 'eliminate'; member: AdminLosMember }
  | { kind: 'reinstate'; member: AdminLosMember }
  | { kind: 'reset' }

/**
 * Admin LOS management table.
 *
 * Columns: Member, Status, Current Pick, Teams Used, Eliminated GW, Actions.
 *
 * Ordering:
 *   - Active members first (teams-used-count ASC, alpha tiebreak)
 *   - Eliminated members after (eliminated_at_gw DESC, alpha tiebreak)
 */
export function AdminLosTable({
  competitionId,
  competitionNumber,
  startsAtGw,
  season,
  currentGwNumber,
  members,
}: AdminLosTableProps) {
  const [dialog, setDialog] = useState<DialogMode>({ kind: 'none' })
  const [eliminateReason, setEliminateReason] = useState<
    'admin_override' | 'draw' | 'lose' | 'missed'
  >('admin_override')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const sorted = [...members].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'active' ? -1 : 1
    if (a.status === 'active') {
      const usedDiff = a.teamsUsed.length - b.teamsUsed.length
      if (usedDiff !== 0) return usedDiff
      return a.display_name.localeCompare(b.display_name)
    }
    const aGw = a.eliminated_at_gw ?? 0
    const bGw = b.eliminated_at_gw ?? 0
    if (aGw !== bGw) return bGw - aGw
    return a.display_name.localeCompare(b.display_name)
  })

  function closeDialog() {
    setDialog({ kind: 'none' })
    setError(null)
    setEliminateReason('admin_override')
  }

  function handleEliminate() {
    if (dialog.kind !== 'eliminate') return
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('member_id', dialog.member.member_id)
      fd.set('competition_id', competitionId)
      fd.set('reason', eliminateReason)

      const result = await overrideEliminate(fd)
      if ('error' in result) {
        setError(result.error)
      } else {
        closeDialog()
        window.location.reload()
      }
    })
  }

  function handleReinstate() {
    if (dialog.kind !== 'reinstate') return
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('member_id', dialog.member.member_id)
      fd.set('competition_id', competitionId)

      const result = await reinstateMember(fd)
      if ('error' in result) {
        setError(result.error)
      } else {
        closeDialog()
        window.location.reload()
      }
    })
  }

  function handleReset() {
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('competition_id', competitionId)
      fd.set('season', String(season))
      fd.set('ended_at_gw', String(currentGwNumber ?? startsAtGw))

      const result = await resetCompetitionManually(fd)
      if ('error' in result) {
        setError(result.error)
      } else {
        closeDialog()
        window.location.reload()
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between rounded-xl bg-white border border-gray-200 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            Competition #{competitionNumber}
          </p>
          <p className="text-xs text-gray-500">Started GW{startsAtGw}</p>
        </div>
        <button
          type="button"
          onClick={() => setDialog({ kind: 'reset' })}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-medium transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset competition
        </button>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Member
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Current Pick
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Teams Used
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">
                  Eliminated GW
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map((m) => {
                const isActive = m.status === 'active'
                return (
                  <tr key={m.member_id} className={isActive ? '' : 'bg-gray-50/70'}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{m.display_name}</p>
                      {m.email && (
                        <p className="text-xs text-gray-400">{m.email}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-200 text-gray-500'
                        }`}
                      >
                        {isActive ? 'In' : 'Out'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {m.currentPick ? (
                        <div className="inline-flex items-center gap-2">
                          {m.currentPick.crest_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={m.currentPick.crest_url}
                              alt={m.currentPick.team_name}
                              width={20}
                              height={20}
                              style={{ width: 20, height: 20, objectFit: 'contain' }}
                            />
                          ) : null}
                          <span className="text-gray-700">
                            {m.currentPick.team_name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-xs font-semibold text-gray-700 mr-1">
                          {m.teamsUsed.length}
                        </span>
                        {m.teamsUsed.slice(0, 6).map((t) => (
                          <span
                            key={`${t.id}-${t.gameweek_number}`}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200 text-xs text-gray-600"
                            title={`${t.name} (GW${t.gameweek_number})`}
                          >
                            {t.crest_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={t.crest_url}
                                alt={t.name}
                                width={14}
                                height={14}
                                style={{ width: 14, height: 14, objectFit: 'contain' }}
                              />
                            ) : null}
                            <span>{t.short_name ?? t.name.slice(0, 3).toUpperCase()}</span>
                          </span>
                        ))}
                        {m.teamsUsed.length > 6 && (
                          <span className="text-xs text-gray-400">
                            +{m.teamsUsed.length - 6}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700">
                      {m.eliminated_at_gw ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isActive ? (
                        <button
                          type="button"
                          onClick={() => setDialog({ kind: 'eliminate', member: m })}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-medium transition-colors"
                        >
                          <UserX className="w-3 h-3" />
                          Eliminate
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDialog({ kind: 'reinstate', member: m })}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 text-xs font-medium transition-colors"
                        >
                          <UserCheck className="w-3 h-3" />
                          Reinstate
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">
                    No members enrolled in this competition.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Eliminate dialog */}
      <Dialog.Root
        open={dialog.kind === 'eliminate'}
        onOpenChange={(o) => !o && closeDialog()}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
          <Dialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-lg font-bold text-gray-900">
                Eliminate member
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </Dialog.Close>
            </div>

            <Dialog.Description className="sr-only">
              Confirm elimination of this member from the current LOS competition.
            </Dialog.Description>

            <div className="space-y-4">
              {dialog.kind === 'eliminate' && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">
                    You&apos;re about to eliminate{' '}
                    <span className="font-semibold">
                      {dialog.member.display_name}
                    </span>{' '}
                    from Competition #{competitionNumber}.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Reason
                </label>
                <select
                  value={eliminateReason}
                  onChange={(e) =>
                    setEliminateReason(
                      e.target.value as 'admin_override' | 'draw' | 'lose' | 'missed'
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                >
                  <option value="admin_override">Admin override</option>
                  <option value="draw">Draw</option>
                  <option value="lose">Lose</option>
                  <option value="missed">Missed submission</option>
                </select>
              </div>

              {error && (
                <p className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
                  {error}
                </p>
              )}

              <div className="flex gap-3 justify-end pt-1">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  type="button"
                  onClick={handleEliminate}
                  disabled={isPending}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-60"
                >
                  {isPending ? 'Eliminating…' : 'Confirm eliminate'}
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Reinstate dialog */}
      <Dialog.Root
        open={dialog.kind === 'reinstate'}
        onOpenChange={(o) => !o && closeDialog()}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
          <Dialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-lg font-bold text-gray-900">
                Reinstate member
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </Dialog.Close>
            </div>

            <Dialog.Description className="sr-only">
              Confirm reinstating this member back into the current LOS competition.
            </Dialog.Description>

            <div className="space-y-4">
              {dialog.kind === 'reinstate' && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-green-800">
                    Put{' '}
                    <span className="font-semibold">
                      {dialog.member.display_name}
                    </span>{' '}
                    back in Competition #{competitionNumber}?
                  </p>
                </div>
              )}

              {error && (
                <p className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
                  {error}
                </p>
              )}

              <div className="flex gap-3 justify-end pt-1">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  type="button"
                  onClick={handleReinstate}
                  disabled={isPending}
                  className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold disabled:opacity-60"
                >
                  {isPending ? 'Reinstating…' : 'Confirm reinstate'}
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Reset competition dialog */}
      <Dialog.Root
        open={dialog.kind === 'reset'}
        onOpenChange={(o) => !o && closeDialog()}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
          <Dialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-lg font-bold text-gray-900">
                Reset competition
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </Dialog.Close>
            </div>

            <Dialog.Description className="sr-only">
              Manually close out the current LOS competition and start a fresh one.
            </Dialog.Description>

            <div className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-semibold">This ends Competition #{competitionNumber}.</p>
                  <p className="mt-0.5">
                    A fresh competition will start at GW{(currentGwNumber ?? startsAtGw) + 1}.
                    No winner will be recorded — use this only for edge cases.
                  </p>
                </div>
              </div>

              {error && (
                <p className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
                  {error}
                </p>
              )}

              <div className="flex gap-3 justify-end pt-1">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={isPending}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-60"
                >
                  {isPending ? 'Resetting…' : 'Yes, reset'}
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
