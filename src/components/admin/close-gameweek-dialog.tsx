'use client'

import { useState, useTransition, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, AlertTriangle, CheckCircle, Lock, Unlock } from 'lucide-react'
import { getCloseGameweekSummary, closeGameweek, reopenGameweek } from '@/actions/admin/gameweeks'
import type { CloseGameweekSummary } from '@/actions/admin/gameweeks'

interface CloseGameweekDialogProps {
  gameweekId: string
  gameweekNumber: number
  isClosed: boolean
}

type CloseStep = 'summary' | 'success'
type ReopenStep = 'confirm' | 'reopening'

export function CloseGameweekDialog({
  gameweekId,
  gameweekNumber,
  isClosed,
}: CloseGameweekDialogProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Close flow state
  const [closeStep, setCloseStep] = useState<CloseStep>('summary')
  const [summary, setSummary] = useState<CloseGameweekSummary | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)

  // Reopen flow state
  const [reopenStep, setReopenStep] = useState<ReopenStep>('confirm')

  function handleOpenChange(val: boolean) {
    setOpen(val)
    if (!val) {
      // Reset all state on close
      setError(null)
      setCloseStep('summary')
      setSummary(null)
      setReopenStep('confirm')
    }
  }

  // Load summary when close dialog opens
  useEffect(() => {
    if (open && !isClosed && closeStep === 'summary' && !summary) {
      setLoadingSummary(true)
      setError(null)
      getCloseGameweekSummary(gameweekId).then((result) => {
        setLoadingSummary(false)
        if ('error' in result) {
          setError(result.error)
        } else {
          setSummary(result)
        }
      })
    }
  }, [open, isClosed, closeStep, summary, gameweekId])

  function handleClose() {
    setError(null)
    startTransition(async () => {
      const formData = new FormData()
      formData.set('gameweek_id', gameweekId)
      const result = await closeGameweek(formData)
      if ('error' in result) {
        setError(result.error)
      } else {
        setCloseStep('success')
      }
    })
  }

  function handleReopen() {
    setError(null)
    setReopenStep('reopening')
    startTransition(async () => {
      const formData = new FormData()
      formData.set('gameweek_id', gameweekId)
      const result = await reopenGameweek(formData)
      if ('error' in result) {
        setError(result.error)
        setReopenStep('confirm')
      } else {
        setOpen(false)
        window.location.reload()
      }
    })
  }

  // ── Trigger button ────────────────────────────────────────────────────────────
  const triggerButton = isClosed ? (
    <button
      type="button"
      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors"
    >
      <Unlock className="w-4 h-4" />
      Reopen Gameweek
    </button>
  ) : (
    <button
      type="button"
      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors shadow-sm"
    >
      <Lock className="w-4 h-4" />
      Close Gameweek
    </button>
  )

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>{triggerButton}</Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">

          {/* ── CLOSE FLOW ──────────────────────────────────────────────────── */}
          {!isClosed && (
            <>
              <div className="flex items-center justify-between mb-5">
                <Dialog.Title className="text-lg font-bold text-gray-900">
                  {closeStep === 'success' ? 'Gameweek closed' : `Close Gameweek ${gameweekNumber}`}
                </Dialog.Title>
                {closeStep !== 'success' && (
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                      aria-label="Close"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </Dialog.Close>
                )}
              </div>

              <Dialog.Description className="sr-only">
                Review pre-close summary for Gameweek {gameweekNumber} before closing
              </Dialog.Description>

              {/* Summary step */}
              {closeStep === 'summary' && (
                <div className="space-y-4">
                  {loadingSummary && (
                    <div className="py-8 text-center text-gray-400 text-sm">
                      Loading summary...
                    </div>
                  )}

                  {!loadingSummary && summary && (
                    <>
                      {/* Fixtures summary */}
                      <div className="p-4 bg-gray-50 rounded-xl space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total fixtures</span>
                          <span className="font-semibold text-gray-900">{summary.totalFixtures}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Finished / voided</span>
                          <span className="font-semibold text-gray-900">{summary.finishedFixtures}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Points distributed</span>
                          <span className="font-semibold text-gray-900">{summary.totalPointsDistributed}</span>
                        </div>
                      </div>

                      {/* Blocking fixtures */}
                      {summary.blockingFixtures.length > 0 && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                          <div className="flex items-start gap-2 mb-2">
                            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                            <p className="text-sm font-semibold text-red-800">
                              {summary.blockingFixtures.length} fixture{summary.blockingFixtures.length !== 1 ? 's' : ''} not finished
                            </p>
                          </div>
                          <ul className="space-y-1 pl-6">
                            {summary.blockingFixtures.map((f) => (
                              <li key={f.id} className="text-xs text-red-700">
                                {f.label}{' '}
                                <span className="font-medium">({f.status})</span>
                              </li>
                            ))}
                          </ul>
                          <p className="text-xs text-red-600 mt-2 pl-6">
                            These fixtures must finish or be voided before closing.
                          </p>
                        </div>
                      )}

                      {/* Pending bonus awards */}
                      {summary.pendingBonusAwards > 0 && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-amber-800">
                            <span className="font-semibold">{summary.pendingBonusAwards} bonus award{summary.pendingBonusAwards !== 1 ? 's' : ''} pending review</span>
                            {' — '}confirm or reject in Bonuses before closing.
                          </p>
                        </div>
                      )}

                      {/* Bonus confirmation status */}
                      {summary.pendingBonusAwards === 0 && (
                        <div className={`p-3 rounded-xl flex items-center gap-2 text-sm ${
                          summary.bonusConfirmed
                            ? 'bg-green-50 border border-green-200'
                            : 'bg-amber-50 border border-amber-200'
                        }`}>
                          {summary.bonusConfirmed ? (
                            <>
                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                              <span className="text-green-800 font-medium">Bonus confirmed</span>
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                              <span className="text-amber-800">Bonus not confirmed for this gameweek</span>
                            </>
                          )}
                        </div>
                      )}

                      {/* Warning: no fixtures scored */}
                      {summary.totalFixtures > 0 && summary.totalPointsDistributed === 0 && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                          <p className="text-sm text-amber-800">No points have been distributed yet — scoring may be incomplete.</p>
                        </div>
                      )}
                    </>
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
                      type="button"
                      onClick={handleClose}
                      disabled={isPending || loadingSummary || !summary?.canClose}
                      className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isPending ? 'Closing…' : `Close Gameweek ${gameweekNumber}`}
                    </button>
                  </div>

                  {summary && !summary.canClose && !error && (
                    <p className="text-xs text-center text-gray-400">
                      Resolve the issues above before closing this gameweek.
                    </p>
                  )}
                </div>
              )}

              {/* Success step */}
              {closeStep === 'success' && (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-green-900">
                        Gameweek {gameweekNumber} has been closed
                      </p>
                      <p className="text-xs text-green-700 mt-0.5">
                        All scores are locked. The gameweek cannot be edited without reopening.
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Dialog.Close asChild>
                      <button
                        type="button"
                        className="px-4 py-2 rounded-lg bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium"
                      >
                        Done
                      </button>
                    </Dialog.Close>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── REOPEN FLOW ─────────────────────────────────────────────────── */}
          {isClosed && (
            <>
              <div className="flex items-center justify-between mb-5">
                <Dialog.Title className="text-lg font-bold text-gray-900">
                  Reopen Gameweek {gameweekNumber}
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
                Confirm reopening Gameweek {gameweekNumber}
              </Dialog.Description>

              <div className="space-y-4">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-900">Are you sure?</p>
                    <p className="text-sm text-amber-800 mt-0.5">
                      Reopening Gameweek {gameweekNumber} will unlock it for editing. Any reports or summaries may need regenerating.
                    </p>
                  </div>
                </div>

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
                    type="button"
                    onClick={handleReopen}
                    disabled={isPending || reopenStep === 'reopening'}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
                  >
                    {isPending || reopenStep === 'reopening' ? 'Reopening…' : 'Yes, reopen'}
                  </button>
                </div>
              </div>
            </>
          )}

        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
