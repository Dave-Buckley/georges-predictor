import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { SyncStatus } from '@/components/admin/sync-status'
import type { MemberRow, AdminNotificationRow, SyncLogRow } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

async function getDashboardData() {
  try {
    const supabase = createAdminClient()

    const [membersResult, notificationsResult, syncLogResult] = await Promise.all([
      supabase.from('members').select('id, approval_status'),
      supabase
        .from('admin_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('sync_log')
        .select('*')
        .order('synced_at', { ascending: false })
        .limit(1)
        .single(),
    ])

    const members = (membersResult.data ?? []) as Pick<MemberRow, 'id' | 'approval_status'>[]
    const notifications = (notificationsResult.data ?? []) as AdminNotificationRow[]
    // sync_log single() returns error if no rows — that's fine, latestSync will be null
    const latestSync = syncLogResult.data as SyncLogRow | null

    return {
      totalMembers: members.length,
      pendingCount: members.filter((m) => m.approval_status === 'pending').length,
      approvedCount: members.filter((m) => m.approval_status === 'approved').length,
      notifications,
      latestSync,
    }
  } catch {
    return { totalMembers: 0, pendingCount: 0, approvedCount: 0, notifications: [], latestSync: null }
  }
}

export default async function AdminDashboardPage() {
  const { totalMembers, pendingCount, approvedCount, notifications, latestSync } =
    await getDashboardData()

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Here&apos;s what needs your attention.</p>
      </div>

      {/* Fixture Sync */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Fixture Sync
        </h2>
        <SyncStatus lastSync={latestSync} />
      </section>

      {/* Action items */}
      <section className="mb-8 space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Action required
        </h2>

        {pendingCount > 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p className="font-semibold text-amber-900">
                {pendingCount} member{pendingCount !== 1 ? 's' : ''} waiting for approval
              </p>
              <p className="text-amber-700 text-sm mt-0.5">
                Review and approve or reject their registration.
              </p>
            </div>
            <Link
              href="/admin/members?filter=pending"
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl transition whitespace-nowrap"
            >
              Review
            </Link>
          </div>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
            <p className="text-green-800 font-medium">
              No pending approvals — you&apos;re all caught up!
            </p>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-2xl p-5 text-gray-400">
          <p className="font-medium text-gray-500">Bonuses</p>
          <p className="text-sm mt-0.5">Not yet available — coming in a future update.</p>
        </div>
      </section>

      {/* Stats */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Members
        </h2>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total', value: totalMembers },
            { label: 'Approved', value: approvedCount },
            { label: 'Pending', value: pendingCount },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="bg-white border border-gray-200 rounded-2xl p-5 text-center"
            >
              <p className="text-3xl font-bold text-gray-900">{value}</p>
              <p className="text-gray-500 text-sm mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Recent notifications */}
      {notifications.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Recent notifications
          </h2>
          <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100">
            {notifications.map((n) => (
              <div key={n.id} className="p-4 flex items-start gap-3">
                <span
                  className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                    n.is_read ? 'bg-gray-200' : 'bg-purple-500'
                  }`}
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">{n.title}</p>
                  {n.message && (
                    <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(n.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
