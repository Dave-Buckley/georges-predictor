/**
 * Step 8: Launch the new season.
 *
 * The only step with global side effects beyond confirmations already
 * applied. Writes an admin_notifications audit row and revalidates every
 * member-facing path. After launch, redirects to /admin with a success query.
 */
import { redirect } from 'next/navigation'
import { launchNewSeason } from '@/actions/admin/season-rollover'
import { StepLayout } from './step-layout'

interface Step8Props {
  newSeason: number
}

export function Step8Launch({ newSeason }: Step8Props) {
  async function onLaunch(formData: FormData) {
    'use server'
    const result = await launchNewSeason(formData)
    if ('error' in result) {
      redirect(`/admin/season-rollover?step=8&error=${encodeURIComponent(result.error)}`)
    }
    redirect('/admin?launched=1')
  }

  return (
    <StepLayout
      step={8}
      title={`Launch season ${newSeason}`}
      actions={
        <form action={onLaunch}>
          <input type="hidden" name="season" value={newSeason} />
          <button
            type="submit"
            className="px-5 py-2 rounded-xl bg-pl-green text-pl-purple text-sm font-bold hover:bg-white transition"
          >
            🚀 Launch season →
          </button>
        </form>
      }
    >
      <p className="text-gray-700">
        This is the only step with global side effects. Launching the season flips the active
        season flag, emits a <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">season_launched</code>{' '}
        notification, and revalidates every member-facing path (/, /standings, /dashboard).
      </p>
      <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900 space-y-2">
        <p>
          <strong>Rolling back a launch requires manual DB intervention.</strong> Make sure you
          have confirmed steps 1–7 before tapping Launch.
        </p>
      </div>
      <p className="text-sm text-gray-500 mt-4">
        After launch you&apos;ll be redirected to the admin dashboard. Members will see the new
        season as the default view.
      </p>
    </StepLayout>
  )
}

export default Step8Launch
