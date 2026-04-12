/**
 * Step 5: Championship list.
 *
 * Two paths:
 *   (a) Carry-forward from the just-archived season (clones rows via upsert).
 *   (b) Manual setup later — skip to step 6.
 *
 * Carry-forward invokes carryForwardChampionshipTeams and advances.
 */
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { carryForwardChampionshipTeams } from '@/actions/admin/season-rollover'
import { StepLayout } from './step-layout'

interface Step5Props {
  fromSeason: number
  toSeason: number
}

export function Step5Championship({ fromSeason, toSeason }: Step5Props) {
  async function onCarry(formData: FormData) {
    'use server'
    const result = await carryForwardChampionshipTeams(formData)
    if ('error' in result) {
      redirect(`/admin/season-rollover?step=5&error=${encodeURIComponent(result.error)}`)
    }
    redirect(`/admin/season-rollover?step=6&season=${formData.get('to_season')}`)
  }

  return (
    <StepLayout
      step={5}
      title="Championship team list"
      actions={
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/season-rollover?step=6&season=${toSeason}`}
            className="px-4 py-2 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition"
          >
            Skip & set up manually
          </Link>
          <form action={onCarry}>
            <input type="hidden" name="from_season" value={fromSeason} />
            <input type="hidden" name="to_season" value={toSeason} />
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition"
            >
              Carry forward →
            </button>
          </form>
        </div>
      }
    >
      <p className="text-gray-700">
        Pre-season picks need a Championship team list. You can clone last season&apos;s list
        (quick start) or set it up manually from{' '}
        <Link href="/admin/pre-season" className="text-purple-700 underline">
          /admin/pre-season
        </Link>{' '}
        later.
      </p>
      <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
        <p>
          <strong>Tip:</strong> if the 3 relegated / 3 promoted teams have already been swapped
          via the end-of-season rollover on /admin/pre-season, clone-forward is safe — duplicates
          are ignored.
        </p>
      </div>
    </StepLayout>
  )
}

export default Step5Championship
