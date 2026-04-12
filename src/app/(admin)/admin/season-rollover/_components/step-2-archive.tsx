/**
 * Step 2: Archive current season.
 *
 * Shows a compact summary of final standings (top 5 + member count) and
 * invokes archiveSeason on submit. Idempotent — can be re-run safely.
 */
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { archiveSeason } from '@/actions/admin/season-rollover'
import { StepLayout } from './step-layout'

interface Step2Props {
  season: number
}

export async function Step2Archive({ season }: Step2Props) {
  const admin = createAdminClient()
  const { data: membersRaw } = await admin
    .from('members')
    .select('id, display_name, starting_points')
    .eq('approval_status', 'approved')
    .order('starting_points', { ascending: false })
    .limit(5)

  const top5 =
    ((membersRaw as Array<{ id: string; display_name: string; starting_points: number }> | null) ??
      [])
  const { data: allMembersRaw } = await admin
    .from('members')
    .select('id')
    .eq('approval_status', 'approved')
  const memberCount = ((allMembersRaw as Array<{ id: string }> | null) ?? []).length

  async function onArchive(formData: FormData) {
    'use server'
    const result = await archiveSeason(formData)
    if ('error' in result) {
      // Surface via redirect query — the redirect below handles success case;
      // for errors we bounce back to step 2 with an error hint.
      redirect(`/admin/season-rollover?step=2&error=${encodeURIComponent(result.error)}`)
    }
    redirect('/admin/season-rollover?step=3')
  }

  return (
    <StepLayout
      step={2}
      title={`Archive the ${season} season`}
      actions={
        <form action={onArchive}>
          <input type="hidden" name="season" value={season} />
          <button
            type="submit"
            className="px-5 py-2 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition"
          >
            Archive season →
          </button>
        </form>
      }
    >
      <p className="text-gray-700">
        Archiving sets <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">ended_at</code>{' '}
        on the season record. Historical data is preserved — rows stay in place and are queried by
        season number. This step is idempotent.
      </p>

      <div className="mt-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">
          Final standings — top {top5.length} of {memberCount}
        </h3>
        <ol className="space-y-1">
          {top5.map((m, i) => (
            <li key={m.id} className="text-sm text-gray-700 flex justify-between">
              <span>
                <span className="font-semibold text-purple-700">{i + 1}.</span> {m.display_name}
              </span>
              <span className="font-mono text-gray-900">{m.starting_points ?? 0}</span>
            </li>
          ))}
          {top5.length === 0 && <li className="text-sm text-gray-500">No members yet.</li>}
        </ol>
      </div>
    </StepLayout>
  )
}

export default Step2Archive
