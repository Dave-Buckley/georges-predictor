'use client'

/**
 * Member pre-season submission form.
 *
 * Wraps PreSeasonPicker in a submit flow that invokes `submitPreSeasonPicks`.
 * Shows a lockout countdown banner + success/error feedback.
 */

import { useState, useTransition } from 'react'
import { AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { submitPreSeasonPicks } from '@/actions/pre-season'
import type { SeasonRow, PreSeasonPickRow } from '@/lib/supabase/types'
import {
  PreSeasonPicker,
  EMPTY_PICKER_STATE,
  isPickerComplete,
  toSubmitPayload,
  type PickerState,
} from './pre-season-picker'

interface PreSeasonFormProps {
  season: SeasonRow
  plTeams: Array<{ name: string }>
  championship: readonly string[]
  initial: PreSeasonPickRow | null
}

function initialStateFromPicks(picks: PreSeasonPickRow | null): PickerState {
  if (!picks) return EMPTY_PICKER_STATE

  const padTop4 = [...(picks.top4 ?? [])]
  while (padTop4.length < 4) padTop4.push(null as unknown as string)
  const padRelegated = [...(picks.relegated ?? [])]
  while (padRelegated.length < 3) padRelegated.push(null as unknown as string)
  const padPromoted = [...(picks.promoted ?? [])]
  while (padPromoted.length < 3) padPromoted.push(null as unknown as string)

  return {
    top4: padTop4.slice(0, 4).map((v) => v || null),
    tenth_place: picks.tenth_place || null,
    relegated: padRelegated.slice(0, 3).map((v) => v || null),
    promoted: padPromoted.slice(0, 3).map((v) => v || null),
    promoted_playoff_winner: picks.promoted_playoff_winner || null,
  }
}

function formatKickoff(isoString: string): string {
  try {
    return new Date(isoString).toLocaleString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/London',
    })
  } catch {
    return isoString
  }
}

export default function PreSeasonForm({
  season,
  plTeams,
  championship,
  initial,
}: PreSeasonFormProps) {
  const [state, setState] = useState<PickerState>(() => initialStateFromPicks(initial))
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  const complete = isPickerComplete(state)
  const hasPriorSubmission = !!initial

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSuccess(false)

    if (!complete) {
      setError('All 12 picks are required before submitting.')
      return
    }

    startTransition(async () => {
      const payload = toSubmitPayload(state, season.season)
      const fd = new FormData()
      fd.set('payload', JSON.stringify(payload))

      const result = await submitPreSeasonPicks(fd)
      if ('error' in result) {
        setError(result.error)
        return
      }
      setSuccess(true)
    })
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-white">
          Pre-Season Predictions — {season.label}
        </h1>
        <div className="flex items-start gap-2 rounded-lg border border-amber-700/50 bg-amber-900/20 p-3 text-sm text-amber-200">
          <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Open until GW1 kickoff</p>
            <p className="text-amber-300/80 text-xs mt-0.5">
              {formatKickoff(season.gw1_kickoff)} (London time). Predictions lock automatically at kickoff.
            </p>
          </div>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <PreSeasonPicker
          state={state}
          onChange={setState}
          plTeams={plTeams}
          championship={championship}
          disabled={isPending || success}
        />

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-900/30 border border-red-700/50 p-3 text-sm text-red-200">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-start gap-2 rounded-lg bg-green-900/30 border border-green-700/50 p-3 text-sm text-green-200">
            <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              Picks saved. You can come back and change them any time until GW1 kickoff.
            </span>
          </div>
        )}

        <div className="sticky bottom-0 -mx-4 px-4 py-4 bg-slate-950/95 backdrop-blur border-t border-slate-800">
          <button
            type="submit"
            disabled={!complete || isPending}
            className="w-full px-4 py-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending
              ? 'Saving…'
              : hasPriorSubmission
                ? 'Update predictions'
                : 'Submit predictions'}
          </button>
          {!complete && (
            <p className="text-xs text-slate-400 mt-2 text-center">
              Fill all 12 picks to enable submission.
            </p>
          )}
        </div>
      </form>
    </div>
  )
}
