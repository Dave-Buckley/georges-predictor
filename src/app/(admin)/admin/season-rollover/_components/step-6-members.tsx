/**
 * Step 6: Members points reset.
 *
 * Shows the count of approved members + warning about the reset.
 * Must confirm the checkbox before submission.
 *
 * PITFALL 6: carryForwardMembers ONLY touches approved members with
 * user_id NOT NULL. Pending, rejected, and unclaimed-import rows are left
 * alone. This is surfaced to the admin via the copy below.
 */
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { carryForwardMembers } from '@/actions/admin/season-rollover'
import { StepLayout } from './step-layout'

interface Step6Props {
  newSeason: number
}

export async function Step6Members({ newSeason }: Step6Props) {
  const admin = createAdminClient()

  const { data: approvedRaw } = await admin
    .from('members')
    .select('id, user_id')
    .eq('approval_status', 'approved')
  const approved = ((approvedRaw as Array<{ id: string; user_id: string | null }> | null) ?? [])
  const claimedCount = approved.filter((m) => m.user_id !== null).length

  const { data: pendingRaw } = await admin
    .from('members')
    .select('id')
    .eq('approval_status', 'pending')
  const pendingCount = ((pendingRaw as Array<{ id: string }> | null) ?? []).length

  async function onSubmit(formData: FormData) {
    'use server'
    const result = await carryForwardMembers(formData)
    if ('error' in result) {
      redirect(`/admin/season-rollover?step=6&error=${encodeURIComponent(result.error)}`)
    }
    redirect(`/admin/season-rollover?step=7&season=${newSeason}`)
  }

  return (
    <StepLayout
      step={6}
      title="Reset member points"
      actions={
        <form action={onSubmit}>
          <button
            type="submit"
            className="px-5 py-2 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition"
          >
            Reset points →
          </button>
        </form>
      }
    >
      <p className="text-gray-700">
        Starting the new season resets running-total <strong>starting_points</strong> to 0 for
        every approved member who has claimed their account.
      </p>
      <ul className="mt-3 space-y-1 text-sm">
        <li className="text-gray-900">
          <strong>{claimedCount}</strong> approved members will have points reset to 0
        </li>
        <li className="text-gray-500">
          <strong>{pendingCount}</strong> pending registration{pendingCount !== 1 ? 's' : ''} —
          left untouched
        </li>
      </ul>
      <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900 space-y-2">
        <p>
          <strong>This resets points to 0 for all approved members.</strong> Pending
          registrations are untouched. Unclaimed imported placeholders (members with no user_id)
          are untouched. Historical per-season aggregates are preserved via the gameweek /
          prediction tables.
        </p>
      </div>
    </StepLayout>
  )
}

export default Step6Members
