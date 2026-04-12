import { createAdminClient } from '@/lib/supabase/admin'
import { ImportForm } from '@/components/admin/import-form'
import { PreSeasonImportForm } from '@/components/admin/pre-season-import-form'

export const dynamic = 'force-dynamic'

async function getImportStatus(): Promise<{
  importedCount: number
  registeredCount: number
  preSeasonPicksCount: number
}> {
  try {
    const supabase = createAdminClient()

    const [importedResult, registeredResult, picksResult] = await Promise.all([
      // Placeholder members (not yet signed up)
      supabase
        .from('members')
        .select('id', { count: 'exact', head: true })
        .is('user_id', null),
      // Registered and approved members
      supabase
        .from('members')
        .select('id', { count: 'exact', head: true })
        .not('user_id', 'is', null)
        .eq('approval_status', 'approved'),
      // Pre-season picks rows
      supabase
        .from('pre_season_picks')
        .select('id', { count: 'exact', head: true }),
    ])

    return {
      importedCount: importedResult.count ?? 0,
      registeredCount: registeredResult.count ?? 0,
      preSeasonPicksCount: picksResult.count ?? 0,
    }
  } catch {
    return { importedCount: 0, registeredCount: 0, preSeasonPicksCount: 0 }
  }
}

async function getTotalMemberCount(): Promise<number> {
  try {
    const supabase = createAdminClient()
    const { count } = await supabase
      .from('members')
      .select('id', { count: 'exact', head: true })
    return count ?? 0
  } catch {
    return 0
  }
}

export default async function AdminImportPage() {
  const [{ importedCount, registeredCount, preSeasonPicksCount }, totalMembers] =
    await Promise.all([getImportStatus(), getTotalMemberCount()])

  return (
    <div className="p-6 lg:p-8 max-w-3xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mid-Season Import</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Paste member standings and pre-season picks to get the competition ready.
        </p>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Imported</p>
          <p className="text-2xl font-bold text-gray-900">{importedCount}</p>
          <p className="text-xs text-gray-400 mt-0.5">awaiting signup</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Registered</p>
          <p className="text-2xl font-bold text-green-600">{registeredCount}</p>
          <p className="text-xs text-gray-400 mt-0.5">active members</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Pre-Season Picks</p>
          <p className="text-2xl font-bold text-purple-600">{preSeasonPicksCount}</p>
          <p className="text-xs text-gray-400 mt-0.5">rows imported</p>
        </div>
      </div>

      {/* Member Standings section */}
      <section className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Member Standings</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Paste names and current points. Members will appear in the signup dropdown instantly.
          </p>
        </div>
        <ImportForm importedCount={importedCount} registeredCount={registeredCount} />
      </section>

      {/* Pre-Season Picks section */}
      <section className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Pre-Season Picks</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Import each member&apos;s pre-season predictions for the Championship.
          </p>
        </div>
        <PreSeasonImportForm
          importedCount={preSeasonPicksCount}
          memberCount={totalMembers}
        />
      </section>

      {/* Bucks note */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-sm text-amber-800">
          <span className="font-semibold">Note about &quot;Bucks&quot; (Dave):</span> Add Dave separately via{' '}
          <a href="/admin/members" className="underline hover:no-underline">
            Members &gt; Add Member
          </a>
          , then set his starting points to match the current league leader. Dave needs to be in the
          system to QA the app alongside George before other members sign up.
        </p>
      </div>
    </div>
  )
}
