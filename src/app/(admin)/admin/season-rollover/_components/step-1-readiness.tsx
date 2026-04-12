/**
 * Step 1: Readiness check.
 *
 * Server component — calls getArchiveReadiness and renders a 3-item
 * checklist. Next button is only enabled when readyToArchive is true.
 */
import Link from 'next/link'
import { getArchiveReadiness } from '@/actions/admin/season-rollover'
import { StepLayout } from './step-layout'

interface Step1Props {
  season: number
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-3">
      <span
        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
          ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}
      >
        {ok ? '✓' : '✗'}
      </span>
      <span className={`text-sm ${ok ? 'text-gray-900' : 'text-red-700'}`}>{label}</span>
    </li>
  )
}

export async function Step1Readiness({ season }: Step1Props) {
  const readiness = await getArchiveReadiness(season)
  const isError = 'error' in readiness

  const allGwsClosed = !isError && readiness.allGwsClosed
  const preSeasonConfirmed = !isError && readiness.preSeasonConfirmed
  const losResolved = !isError && readiness.losResolved
  const ready = !isError && readiness.readyToArchive

  return (
    <StepLayout
      step={1}
      title={`Season ${season} — readiness`}
      actions={
        ready ? (
          <Link
            href="/admin/season-rollover?step=2"
            className="px-5 py-2 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition"
          >
            Next →
          </Link>
        ) : (
          <span
            aria-disabled
            className="px-5 py-2 rounded-xl bg-gray-300 text-gray-500 text-sm font-semibold cursor-not-allowed"
          >
            Next →
          </span>
        )
      }
    >
      <p className="text-gray-700">
        Before archiving the {season} season, confirm all preconditions are met. Every check must
        pass before you can proceed to step 2.
      </p>
      <ul className="space-y-2 mt-4">
        <Check ok={allGwsClosed} label="All gameweeks closed" />
        <Check ok={preSeasonConfirmed} label="Pre-season awards confirmed" />
        <Check ok={losResolved} label="Last One Standing competition resolved" />
      </ul>
      {isError && (
        <p className="text-red-700 text-sm">Failed to load readiness: {readiness.error}</p>
      )}
      {!isError && !ready && (
        <p className="text-amber-700 text-sm bg-amber-50 border border-amber-200 rounded-xl p-3 mt-4">
          One or more checks are not yet satisfied. Return to the relevant admin page to resolve
          them, then reload this step.
        </p>
      )}
    </StepLayout>
  )
}

export default Step1Readiness
