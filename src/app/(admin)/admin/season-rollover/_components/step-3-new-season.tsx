/**
 * Step 3: Define the new season.
 *
 * Form inputs for year + GW1 kickoff datetime. Submit upserts the seasons
 * row (idempotent on season PK).
 */
import { redirect } from 'next/navigation'
import { defineNewSeason } from '@/actions/admin/season-rollover'
import { StepLayout } from './step-layout'

interface Step3Props {
  /** The just-archived season; defaults the next year input. */
  season: number
}

export function Step3NewSeason({ season }: Step3Props) {
  const defaultNext = season + 1

  async function onSubmit(formData: FormData) {
    'use server'
    const result = await defineNewSeason(formData)
    if ('error' in result) {
      redirect(`/admin/season-rollover?step=3&error=${encodeURIComponent(result.error)}`)
    }
    redirect(`/admin/season-rollover?step=4&season=${formData.get('season')}`)
  }

  return (
    <StepLayout
      step={3}
      title="Define the new season"
      actions={
        <button
          type="submit"
          form="new-season-form"
          className="px-5 py-2 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition"
        >
          Save & continue →
        </button>
      }
    >
      <p className="text-gray-700">
        Pick the new season year and GW1 kickoff time. Saving is an idempotent upsert — editing
        the inputs and re-submitting updates the existing row.
      </p>
      <form id="new-season-form" action={onSubmit} className="space-y-4 mt-4">
        <div>
          <label htmlFor="season" className="block text-sm font-semibold text-gray-900 mb-1">
            Season year
          </label>
          <input
            id="season"
            name="season"
            type="number"
            defaultValue={defaultNext}
            min={season}
            max={season + 2}
            required
            className="w-full sm:w-48 rounded-xl border border-gray-300 px-3 py-2 text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">
            Typically {defaultNext} (last season was {season}).
          </p>
        </div>
        <div>
          <label
            htmlFor="gw1_kickoff"
            className="block text-sm font-semibold text-gray-900 mb-1"
          >
            GW1 kickoff (local time)
          </label>
          <input
            id="gw1_kickoff"
            name="gw1_kickoff"
            type="datetime-local"
            required
            className="w-full sm:w-64 rounded-xl border border-gray-300 px-3 py-2 text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">
            Pre-season lockout is enforced at this timestamp.
          </p>
        </div>
      </form>
    </StepLayout>
  )
}

export default Step3NewSeason
