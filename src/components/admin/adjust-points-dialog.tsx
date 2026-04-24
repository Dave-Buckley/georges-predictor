'use client'

import { useEffect, useState, useTransition } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, CheckCircle, Edit3 } from 'lucide-react'
import {
  adjustPoints,
  getMemberGameweekTotal,
  getMemberOverallTotal,
} from '@/actions/admin/adjustments'

interface MemberOption {
  id: string
  display_name: string
}

interface GameweekOption {
  id: string
  number: number
}

interface AdjustPointsDialogProps {
  members: MemberOption[]
  gameweeks: GameweekOption[]
  /** Gameweek preselected when opened (e.g. current GW). Optional. */
  defaultGameweekId?: string | null
  /** Custom trigger button. If omitted a default primary button is rendered. */
  trigger?: React.ReactNode
}

type Scope = 'gameweek' | 'overall'

export function AdjustPointsDialog({
  members,
  gameweeks,
  defaultGameweekId,
  trigger,
}: AdjustPointsDialogProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const [memberId, setMemberId] = useState<string>('')
  const [scope, setScope] = useState<Scope>('gameweek')
  const [gameweekId, setGameweekId] = useState<string>(defaultGameweekId ?? '')
  const [newTotal, setNewTotal] = useState<string>('')
  const [note, setNote] = useState<string>('')

  // Looked-up current state shown next to "new total" input
  const [currentTotal, setCurrentTotal] = useState<number | null>(null)
  const [doubleBubble, setDoubleBubble] = useState<boolean>(false)

  // Derived "loading" flag: once enough inputs are selected but the fetch
  // hasn't resolved yet, currentTotal is still null — show "…".
  const hasEnoughInput =
    !!memberId && (scope === 'overall' || !!gameweekId)
  const loadingCurrent = hasEnoughInput && currentTotal === null && !error

  // Fetch the current total whenever member/scope/gameweek changes. Resets of
  // currentTotal (when user picks a different member etc.) are done in the
  // change handlers so this effect only schedules async work.
  useEffect(() => {
    if (!open || !memberId) return
    if (scope === 'gameweek' && !gameweekId) return

    let cancelled = false

    const promise =
      scope === 'overall'
        ? getMemberOverallTotal(memberId).then((res) => {
            if (cancelled) return
            if ('error' in res) {
              setError(res.error)
              setCurrentTotal(null)
            } else {
              setCurrentTotal(res.currentTotal)
              setDoubleBubble(false)
            }
          })
        : getMemberGameweekTotal(memberId, gameweekId).then((res) => {
            if (cancelled) return
            if ('error' in res) {
              setError(res.error)
              setCurrentTotal(null)
            } else {
              setCurrentTotal(res.currentTotal)
              setDoubleBubble(res.doubleBubble)
            }
          })

    void promise

    return () => {
      cancelled = true
    }
  }, [open, memberId, scope, gameweekId])

  // Input-change handlers reset the dependent state synchronously so the stale
  // value doesn't flash while the next fetch is in flight.
  function onMemberChange(id: string) {
    setMemberId(id)
    setCurrentTotal(null)
    setError(null)
  }
  function onScopeChange(next: Scope) {
    setScope(next)
    setCurrentTotal(null)
    setError(null)
  }
  function onGameweekChange(id: string) {
    setGameweekId(id)
    setCurrentTotal(null)
    setError(null)
  }

  function reset() {
    setMemberId('')
    setScope('gameweek')
    setGameweekId(defaultGameweekId ?? '')
    setNewTotal('')
    setNote('')
    setError(null)
    setSuccessMsg(null)
    setCurrentTotal(null)
    setDoubleBubble(false)
  }

  function handleOpenChange(val: boolean) {
    setOpen(val)
    if (!val) reset()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!memberId) {
      setError('Pick a member')
      return
    }
    if (scope === 'gameweek' && !gameweekId) {
      setError('Pick a gameweek')
      return
    }
    const n = parseInt(newTotal, 10)
    if (isNaN(n) || n < 0) {
      setError('Enter a whole number ≥ 0')
      return
    }

    startTransition(async () => {
      const fd = new FormData()
      fd.set('member_id', memberId)
      fd.set('scope', scope)
      if (scope === 'gameweek' && gameweekId) fd.set('gameweek_id', gameweekId)
      fd.set('new_total', String(n))
      if (note.trim()) fd.set('note', note.trim())

      const result = await adjustPoints(fd)
      if ('error' in result) {
        setError(result.error)
        return
      }

      const memberName =
        members.find((m) => m.id === memberId)?.display_name ?? 'Member'
      const deltaText = result.delta === 0
        ? 'No change needed — total was already correct.'
        : `${result.delta > 0 ? '+' : ''}${result.delta} applied to ${memberName}.`
      setSuccessMsg(deltaText)
    })
  }

  const selectedMember = members.find((m) => m.id === memberId)

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        {trigger ?? (
          <button
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-colors shadow-sm"
          >
            <Edit3 className="w-4 h-4" />
            Adjust points
          </button>
        )}
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
          <div className="flex items-center justify-between mb-5">
            <Dialog.Title className="text-lg font-bold text-gray-900">
              {successMsg ? 'Points updated' : 'Adjust points'}
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
            Manually override a member&apos;s points for a gameweek or their overall total.
          </Dialog.Description>

          {successMsg ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-900">Points updated</p>
                  <p className="text-xs text-green-700 mt-0.5">{successMsg}</p>
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    reset()
                  }}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
                >
                  Another adjustment
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    // full refresh so the new total appears everywhere
                    window.location.reload()
                  }}
                  className="px-4 py-2 rounded-lg bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Member */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Member
                </label>
                <select
                  value={memberId}
                  onChange={(e) => onMemberChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                >
                  <option value="">— Pick a member —</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.display_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Scope */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  What are you changing?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onScopeChange('gameweek')}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      scope === 'gameweek'
                        ? 'bg-purple-50 border-purple-300 text-purple-800'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    A gameweek
                  </button>
                  <button
                    type="button"
                    onClick={() => onScopeChange('overall')}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      scope === 'overall'
                        ? 'bg-purple-50 border-purple-300 text-purple-800'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Overall total
                  </button>
                </div>
              </div>

              {/* Gameweek (only if scope=gameweek) */}
              {scope === 'gameweek' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Gameweek
                  </label>
                  <select
                    value={gameweekId}
                    onChange={(e) => onGameweekChange(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                  >
                    <option value="">— Pick a gameweek —</option>
                    {gameweeks.map((gw) => (
                      <option key={gw.id} value={gw.id}>
                        Gameweek {gw.number}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Current total + new total */}
              {memberId && (scope === 'overall' || gameweekId) && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">Current {scope === 'overall' ? 'total' : 'weekly'}</p>
                    <p className="text-xl font-bold text-gray-900 mt-0.5">
                      {loadingCurrent ? '…' : currentTotal ?? '—'}
                    </p>
                    {scope === 'gameweek' && doubleBubble && (
                      <p className="text-[10px] text-purple-600 font-medium mt-0.5">
                        Double Bubble ×2 applied
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      New total
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={newTotal}
                      onChange={(e) => setNewTotal(e.target.value)}
                      placeholder="e.g. 42"
                      className="w-full px-3 py-2 text-lg font-bold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                  </div>
                </div>
              )}

              {/* Note */}
              {memberId && (scope === 'overall' || gameweekId) && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Reason (optional)
                  </label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={500}
                    placeholder="e.g. Missed Villa fixture; WhatsApp bonus was different"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                </div>
              )}

              {error && (
                <p className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</p>
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
                  type="submit"
                  disabled={
                    isPending ||
                    !memberId ||
                    (scope === 'gameweek' && !gameweekId) ||
                    newTotal === ''
                  }
                  className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold disabled:opacity-60"
                >
                  {isPending
                    ? 'Saving…'
                    : selectedMember
                      ? `Save for ${selectedMember.display_name}`
                      : 'Save'}
                </button>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
