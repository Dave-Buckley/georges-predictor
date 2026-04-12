/**
 * Step 7: Pre-season window.
 *
 * Purely informational — submission lockout is driven by seasons.gw1_kickoff
 * already defined in step 3. This step confirms the window is open.
 */
import Link from 'next/link'
import { StepLayout } from './step-layout'

interface Step7Props {
  newSeason: number
}

export function Step7Preseason({ newSeason }: Step7Props) {
  return (
    <StepLayout
      step={7}
      title="Pre-season window is open"
      actions={
        <Link
          href={`/admin/season-rollover?step=8&season=${newSeason}`}
          className="px-5 py-2 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition"
        >
          Continue →
        </Link>
      }
    >
      <p className="text-gray-700">
        The pre-season window for season {newSeason} is now open. Members can submit their picks
        immediately — the lockout fires automatically at the GW1 kickoff you set in step 3.
      </p>
      <div className="mt-4 rounded-xl bg-blue-50 border border-blue-200 p-4 text-sm text-blue-900 space-y-2">
        <p>
          You can monitor submissions and enter picks for late joiners from{' '}
          <Link href="/admin/pre-season" className="text-blue-700 underline">
            /admin/pre-season
          </Link>
          .
        </p>
      </div>
    </StepLayout>
  )
}

export default Step7Preseason
