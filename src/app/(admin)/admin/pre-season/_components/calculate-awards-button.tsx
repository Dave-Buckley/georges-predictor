'use client'

/**
 * Simple client button that invokes calculatePreSeasonAwards via FormData.
 * Kept as a dedicated client component so we can show loading + error state
 * without pulling the whole awards UI into a client boundary.
 */

import { useState, useTransition } from 'react'
import { Calculator, AlertCircle, CheckCircle } from 'lucide-react'
import { calculatePreSeasonAwards } from '@/actions/admin/pre-season'

interface Props {
  season: number
  hasAwards: boolean
}

export function CalculateAwardsButton({ season, hasAwards }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  async function handleClick() {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const fd = new FormData()
      fd.set('season', String(season))
      const r = await calculatePreSeasonAwards(fd)
      if ('error' in r) {
        setError(r.error)
      } else {
        setResult(
          `${r.awardsCreated} award${r.awardsCreated !== 1 ? 's' : ''} calculated. ` +
            `${r.flagsEmitted.all_correct} perfect, ${r.flagsEmitted.category} category-correct.`,
        )
        startTransition(() => {
          window.location.reload()
        })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {hasAwards ? 'Re-calculate pre-season awards' : 'Calculate pre-season awards'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {hasAwards
              ? 'Already-confirmed awards keep their points; others refresh to the latest calculation.'
              : 'Runs once the season-end actuals are locked. Idempotent — safe to re-run.'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleClick}
          disabled={busy}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold disabled:opacity-50 whitespace-nowrap"
        >
          <Calculator className="w-4 h-4" />
          {busy ? 'Calculating…' : hasAwards ? 'Re-calculate' : 'Calculate'}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="flex items-start gap-2 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
          <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{result}</span>
        </div>
      )}
    </div>
  )
}
