'use client'

import { useState, useTransition } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, AlertTriangle, CheckCircle } from 'lucide-react'
import { getOverrideImpact, applyResultOverride } from '@/actions/admin/scoring'

interface ResultOverrideDialogProps {
  fixtureId: string
  homeTeamName: string
  awayTeamName: string
  currentHomeScore: number | null
  currentAwayScore: number | null
  currentSource: string | null
}

type Step = 'entry' | 'confirm' | 'success'

export function ResultOverrideDialog({
  fixtureId,
  homeTeamName,
  awayTeamName,
  currentHomeScore,
  currentAwayScore,
  currentSource,
}: ResultOverrideDialogProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('entry')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Entry step state
  const [homeScore, setHomeScore] = useState<string>(
    currentHomeScore !== null ? String(currentHomeScore) : ''
  )
  const [awayScore, setAwayScore] = useState<string>(
    currentAwayScore !== null ? String(currentAwayScore) : ''
  )

  // Impact preview state (populated after step 1)
  const [impactCount, setImpactCount] = useState<number>(0)
  const [successCount, setSuccessCount] = useState<number>(0)

  const hasExistingResult = currentHomeScore !== null && currentAwayScore !== null
  const triggerLabel = hasExistingResult ? 'Override Result' : 'Set Result'

  function handleOpenChange(val: boolean) {
    setOpen(val)
    if (!val) {
      // Reset state when closing
      setStep('entry')
      setError(null)
      setHomeScore(currentHomeScore !== null ? String(currentHomeScore) : '')
      setAwayScore(currentAwayScore !== null ? String(currentAwayScore) : '')
    }
  }

  function handlePreviewImpact() {
    const h = parseInt(homeScore, 10)
    const a = parseInt(awayScore, 10)

    if (isNaN(h) || isNaN(a) || h < 0 || a < 0 || h > 20 || a > 20) {
      setError('Please enter valid scores (0–20)')
      return
    }

    setError(null)

    startTransition(async () => {
      const impact = await getOverrideImpact(fixtureId)
      if ('error' in impact) {
        setError(impact.error)
        return
      }
      setImpactCount(impact.prediction_count)
      setStep('confirm')
    })
  }

  function handleConfirm() {
    setError(null)

    startTransition(async () => {
      const formData = new FormData()
      formData.set('fixture_id', fixtureId)
      formData.set('home_score', homeScore)
      formData.set('away_score', awayScore)

      const result = await applyResultOverride(formData)

      if ('error' in result) {
        setError(result.error)
        setStep('entry')
        return
      }

      setSuccessCount(result.recalculated)
      setStep('success')
    })
  }

  function handleSuccessClose() {
    setOpen(false)
    window.location.reload()
  }

  const newHomeNum = parseInt(homeScore, 10)
  const newAwayNum = parseInt(awayScore, 10)

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-xs font-medium transition-colors"
        >
          {triggerLabel}
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
          <div className="flex items-center justify-between mb-5">
            <Dialog.Title className="text-lg font-bold text-gray-900">
              {step === 'success' ? 'Result saved' : triggerLabel}
            </Dialog.Title>
            {step !== 'success' && (
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
            {hasExistingResult
              ? `Override the result for ${homeTeamName} vs ${awayTeamName}`
              : `Set the result for ${homeTeamName} vs ${awayTeamName}`}
          </Dialog.Description>

          {/* ── Step 1: Entry ── */}
          {step === 'entry' && (
            <div className="space-y-4">
              {/* Fixture label */}
              <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
                <span className="font-semibold">{homeTeamName}</span>
                <span className="mx-2 text-gray-400">vs</span>
                <span className="font-semibold">{awayTeamName}</span>
                {hasExistingResult && (
                  <p className="text-xs text-gray-500 mt-1">
                    Current result: {currentHomeScore}–{currentAwayScore}
                    {currentSource && (
                      <span className="ml-1 text-gray-400">({currentSource})</span>
                    )}
                  </p>
                )}
              </div>

              {/* Score inputs */}
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    {homeTeamName}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={homeScore}
                    onChange={(e) => setHomeScore(e.target.value)}
                    className="w-full px-3 py-2 text-center text-lg font-bold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
                    placeholder="0"
                  />
                </div>
                <div className="text-gray-400 font-bold text-lg mt-5">–</div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    {awayTeamName}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={awayScore}
                    onChange={(e) => setAwayScore(e.target.value)}
                    className="w-full px-3 py-2 text-center text-lg font-bold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
                    placeholder="0"
                  />
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
                  onClick={handlePreviewImpact}
                  disabled={isPending || homeScore === '' || awayScore === ''}
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium disabled:opacity-60"
                >
                  {isPending ? 'Checking…' : 'Preview Impact'}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Confirmation ── */}
          {step === 'confirm' && (
            <div className="space-y-4">
              {/* Impact warning */}
              <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-900">
                    This will recalculate {impactCount} prediction{impactCount !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    All points for this fixture will be updated immediately.
                  </p>
                </div>
              </div>

              {/* Score comparison */}
              <div className="p-3 bg-gray-50 rounded-lg text-sm space-y-1.5">
                <div className="flex justify-between text-gray-500">
                  <span>Current result</span>
                  <span className="font-medium text-gray-700">
                    {hasExistingResult
                      ? `${currentHomeScore}–${currentAwayScore}`
                      : 'No result set'}
                  </span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>New result</span>
                  <span className="font-bold text-gray-900">
                    {!isNaN(newHomeNum) && !isNaN(newAwayNum)
                      ? `${newHomeNum}–${newAwayNum}`
                      : '—'}
                  </span>
                </div>
              </div>

              {error && (
                <p className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</p>
              )}

              <div className="flex gap-3 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setStep('entry')}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={isPending}
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium disabled:opacity-60"
                >
                  {isPending ? 'Saving…' : 'Confirm Override'}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Success ── */}
          {step === 'success' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-900">
                    Result saved
                  </p>
                  <p className="text-xs text-green-700 mt-0.5">
                    {successCount} prediction{successCount !== 1 ? 's' : ''} recalculated.
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSuccessClose}
                  className="px-4 py-2 rounded-lg bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
