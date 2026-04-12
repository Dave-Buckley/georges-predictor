'use client'

/**
 * Admin season-end actuals entry form (Phase 9 Plan 03).
 *
 * Reuses the shared PreSeasonPicker controlled component (same 12-slot UI
 * as the member form + late-joiner dialog) — the shape is identical to the
 * pre-season pick shape, just with actuals semantics.
 *
 * Submits to setSeasonActuals via JSON payload in FormData.
 */

import { useState, useTransition } from 'react'
import { AlertCircle, CheckCircle, Lock } from 'lucide-react'
import {
  PreSeasonPicker,
  EMPTY_PICKER_STATE,
  isPickerComplete,
  type PickerState,
} from '@/app/(member)/pre-season/_components/pre-season-picker'
import { setSeasonActuals } from '@/actions/admin/pre-season'

interface SeasonActualsFormProps {
  season: number
  plTeams: Array<{ name: string }>
  championship: readonly string[]
  existingActuals: {
    final_top4: string[]
    final_tenth: string | null
    final_relegated: string[]
    final_promoted: string[]
    final_playoff_winner: string | null
  }
  actualsLockedAt: string | null
}

function initialStateFromActuals(
  a: SeasonActualsFormProps['existingActuals'],
): PickerState {
  const pad = (arr: string[], len: number): (string | null)[] => {
    const next: (string | null)[] = [...arr]
    while (next.length < len) next.push(null)
    return next.slice(0, len)
  }
  return {
    top4: pad(a.final_top4 ?? [], 4),
    tenth_place: a.final_tenth ?? null,
    relegated: pad(a.final_relegated ?? [], 3),
    promoted: pad(a.final_promoted ?? [], 3),
    promoted_playoff_winner: a.final_playoff_winner ?? null,
  }
}

export function SeasonActualsForm({
  season,
  plTeams,
  championship,
  existingActuals,
  actualsLockedAt,
}: SeasonActualsFormProps) {
  const [state, setState] = useState<PickerState>(() =>
    initialStateFromActuals(existingActuals),
  )
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  const hasAny =
    state.top4.some(Boolean) ||
    state.tenth_place !== null ||
    state.relegated.some(Boolean) ||
    state.promoted.some(Boolean) ||
    state.promoted_playoff_winner !== null

  const complete = isPickerComplete(state)

  function handleSubmit() {
    setError(null)
    setSuccess(false)

    if (!complete) {
      setError('All 12 actuals are required to lock the season.')
      return
    }

    if (
      !confirm(
        'Locking actuals will make award calculation available. You can edit actuals later, but confirmed awards will be preserved. Continue?',
      )
    ) {
      return
    }

    startTransition(async () => {
      const payload = {
        season,
        final_top4: state.top4.filter(Boolean) as string[],
        final_tenth: state.tenth_place ?? '',
        final_relegated: state.relegated.filter(Boolean) as string[],
        final_promoted: state.promoted.filter(Boolean) as string[],
        final_playoff_winner: state.promoted_playoff_winner ?? '',
      }
      const fd = new FormData()
      fd.set('payload', JSON.stringify(payload))
      const result = await setSeasonActuals(fd)
      if ('error' in result) {
        setError(result.error)
        return
      }
      setSuccess(true)
    })
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900">Season-end actuals</h2>
        {actualsLockedAt && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <Lock className="w-3 h-3" />
            Locked {new Date(actualsLockedAt).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        )}
      </div>

      <p className="text-xs text-gray-500 mb-4">
        Enter the final {season}-{(season + 1).toString().slice(2)} standings.
        Once locked, you can calculate pre-season awards.
      </p>

      <div className="bg-slate-900 rounded-xl p-4">
        <PreSeasonPicker
          state={state}
          onChange={setState}
          plTeams={plTeams}
          championship={championship}
          disabled={isPending}
        />
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
          <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>Actuals saved. You can now calculate pre-season awards.</span>
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!complete || isPending}
          className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? 'Saving…' : hasAny && actualsLockedAt ? 'Update actuals' : 'Lock actuals'}
        </button>
      </div>
    </div>
  )
}
