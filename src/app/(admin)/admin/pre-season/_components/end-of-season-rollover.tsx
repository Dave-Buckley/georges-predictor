'use client'

/**
 * End-of-season rollover button (Phase 9 Plan 03).
 *
 * One-button auto-swap of 3 relegated PL teams + 3 promoted Championship
 * teams between `teams` and `championship_teams`, using the already-entered
 * season-end actuals. Guarded by a preview + confirm dialog so George can
 * see exactly what will move before he commits.
 */

import { useState, useTransition } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Shuffle, AlertCircle, CheckCircle, X } from 'lucide-react'
import { endOfSeasonRollover } from '@/actions/admin/championship'

interface Props {
  fromSeason: number
  /** Null when rollover is not yet available (actuals not locked / awards not all confirmed). */
  actualsLocked: boolean
  awardsAllConfirmed: boolean
  /** Preview — reads the already-entered actuals so George can see the swap. */
  relegated: string[]
  promoted: string[]
}

export function EndOfSeasonRollover({
  fromSeason,
  actualsLocked,
  awardsAllConfirmed,
  relegated,
  promoted,
}: Props) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [, startTransition] = useTransition()

  const disabled = !actualsLocked || !awardsAllConfirmed
  const disabledReason = !actualsLocked
    ? 'Lock season-end actuals first'
    : !awardsAllConfirmed
      ? 'Confirm all pre-season awards first'
      : null

  async function runRollover() {
    setError(null)
    setBusy(true)
    try {
      const fd = new FormData()
      fd.set('from_season', String(fromSeason))
      const result = await endOfSeasonRollover(fd)
      if ('error' in result) {
        setError(result.error)
        return
      }
      setSuccess(true)
      startTransition(() => {
        setTimeout(() => window.location.reload(), 1500)
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
      <div className="flex items-start gap-3">
        <Shuffle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-red-900">
            End-of-season rollover
          </h2>
          <p className="text-sm text-red-700 mt-1">
            Auto-swap the 3 relegated Premier League teams into the{' '}
            {fromSeason + 1}-{(fromSeason + 2).toString().slice(2)} Championship,
            and the 3 promoted Championship teams into the Premier League.
          </p>
          <p className="text-xs text-red-600 mt-2">
            One-click operation. You&apos;ll see a preview before anything moves.
          </p>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger asChild>
            <button
              type="button"
              disabled={disabled}
              title={disabledReason ?? ''}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Shuffle className="w-4 h-4" />
              {disabledReason ?? 'End of season rollover'}
            </button>
          </Dialog.Trigger>

          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/60 z-40" />
            <Dialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <Dialog.Title className="text-lg font-bold text-gray-900">
                  Confirm end-of-season rollover
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
                Preview of end-of-season team swaps.
              </Dialog.Description>

              <div className="space-y-4">
                <div className="rounded-xl bg-red-50 border border-red-200 p-4">
                  <p className="text-sm font-semibold text-red-900 mb-2">
                    Will be removed from Premier League and added to Championship{' '}
                    {fromSeason + 1}-{(fromSeason + 2).toString().slice(2)}:
                  </p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {relegated.map((name) => (
                      <li key={name} className="text-sm text-red-800">
                        {name}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl bg-green-50 border border-green-200 p-4">
                  <p className="text-sm font-semibold text-green-900 mb-2">
                    Will be removed from Championship and added to Premier League:
                  </p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {promoted.map((name) => (
                      <li key={name} className="text-sm text-green-800">
                        {name}
                      </li>
                    ))}
                  </ul>
                </div>

                {error && (
                  <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {success && (
                  <div className="flex items-start gap-2 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
                    <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>Rollover complete. Reloading…</span>
                  </div>
                )}
              </div>

              <div className="mt-5 flex justify-end gap-3">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </Dialog.Close>
                {!success && (
                  <button
                    type="button"
                    onClick={runRollover}
                    disabled={busy}
                    className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold disabled:opacity-50"
                  >
                    {busy ? 'Rolling over…' : 'Yes, roll over'}
                  </button>
                )}
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </div>
  )
}
