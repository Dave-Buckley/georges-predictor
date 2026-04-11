import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { SyncStatus } from '@/components/admin/sync-status'
import { CloseGameweekDialog } from '@/components/admin/close-gameweek-dialog'
import type { MemberRow, AdminNotificationRow, SyncLogRow, GameweekRow } from '@/lib/supabase/types'

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
    const latestSync = syncLogResult.data as SyncLogRow | null

    // ── Active gameweek data ──────────────────────────────────────────────────
    // Find the most-recently active or complete gameweek (highest number not 'scheduled')
    const { data: activeGwData } = await supabase
      .from('gameweeks')
      .select('*')
      .neq('status', 'scheduled')
      .order('number', { ascending: false })
      .limit(1)
      .single()

    const activeGw = activeGwData as GameweekRow | null

    // Upcoming gameweek (lowest number that IS 'scheduled') — for bonus setup card
    const { data: upcomingGwData } = await supabase
      .from('gameweeks')
      .select('*')
      .eq('status', 'scheduled')
      .order('number', { ascending: true })
      .limit(1)
      .single()

    const upcomingGw = upcomingGwData as GameweekRow | null

    let pendingBonusAwards = 0
    let allFixturesFinished = false
    let gwIsClosed = false
    let nextGwBonusConfirmed = false

    if (activeGw) {
      gwIsClosed = activeGw.closed_at !== null

      // Count pending bonus awards for active GW
      const { data: awards } = await supabase
        .from('bonus_awards')
        .select('id')
        .eq('gameweek_id', activeGw.id)
        .is('awarded', null)

      pendingBonusAwards = (awards ?? []).length

      // Check if all fixtures are finished (ready to close)
      const TERMINAL_STATUSES = ['FINISHED', 'CANCELLED', 'POSTPONED']
      const { data: fixtures } = await supabase
        .from('fixtures')
        .select('id, status')
        .eq('gameweek_id', activeGw.id)

      const allFixtures = (fixtures ?? []) as Array<{ id: string; status: string }>
      allFixturesFinished =
        allFixtures.length > 0 && allFixtures.every((f) => TERMINAL_STATUSES.includes(f.status))
    }

    // Check if the next upcoming GW has a confirmed bonus (for "Set Bonus" card)
    const bonusGw = upcomingGw ?? activeGw
    if (bonusGw) {
      const { data: bonusSchedule } = await supabase
        .from('bonus_schedule')
        .select('confirmed')
        .eq('gameweek_id', bonusGw.id)
        .single()

      nextGwBonusConfirmed = bonusSchedule?.confirmed ?? false
    }

    // Count pending prize awards
    const { data: pendingPrizes } = await supabase
      .from('prize_awards')
      .select('id')
      .eq('status', 'pending')

    const pendingPrizeCount = (pendingPrizes ?? []).length

    return {
      totalMembers: members.length,
      pendingCount: members.filter((m) => m.approval_status === 'pending').length,
      approvedCount: members.filter((m) => m.approval_status === 'approved').length,
      notifications,
      latestSync,
      activeGw,
      upcomingGw,
      bonusGw,
      pendingBonusAwards,
      allFixturesFinished,
      gwIsClosed,
      nextGwBonusConfirmed,
      pendingPrizeCount,
    }
  } catch {
    return {
      totalMembers: 0,
      pendingCount: 0,
      approvedCount: 0,
      notifications: [],
      latestSync: null,
      activeGw: null,
      upcomingGw: null,
      bonusGw: null,
      pendingBonusAwards: 0,
      allFixturesFinished: false,
      gwIsClosed: false,
      nextGwBonusConfirmed: false,
      pendingPrizeCount: 0,
    }
  }
}

export default async function AdminDashboardPage() {
  const {
    totalMembers,
    pendingCount,
    approvedCount,
    notifications,
    latestSync,
    activeGw,
    bonusGw,
    pendingBonusAwards,
    allFixturesFinished,
    gwIsClosed,
    nextGwBonusConfirmed,
    pendingPrizeCount,
  } = await getDashboardData()

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

        {/* Pending member approvals */}
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

        {/* Set Bonus card — shown when upcoming GW bonus isn't confirmed */}
        {bonusGw && !nextGwBonusConfirmed && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p className="font-semibold text-amber-900">
                GW{bonusGw.number} bonus not set
              </p>
              <p className="text-amber-700 text-sm mt-0.5">
                Confirm the bonus challenge before this gameweek begins.
              </p>
            </div>
            <Link
              href={`/admin/gameweeks/${bonusGw.number}`}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl transition whitespace-nowrap"
            >
              Set Bonus
            </Link>
          </div>
        )}

        {/* Confirm Bonus Awards card — shown when active GW has pending awards */}
        {activeGw && pendingBonusAwards > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p className="font-semibold text-amber-900">
                GW{activeGw.number}: {pendingBonusAwards} bonus award{pendingBonusAwards !== 1 ? 's' : ''} pending review
              </p>
              <p className="text-amber-700 text-sm mt-0.5">
                Confirm or reject bonus awards before closing the gameweek.
              </p>
            </div>
            <Link
              href="/admin/bonuses"
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl transition whitespace-nowrap"
            >
              Review Awards
            </Link>
          </div>
        )}

        {/* Close Gameweek card — shown when all fixtures finished and GW is not closed */}
        {activeGw && allFixturesFinished && !gwIsClosed && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p className="font-semibold text-green-900">
                GW{activeGw.number} ready to close
              </p>
              <p className="text-green-700 text-sm mt-0.5">
                All fixtures have finished. Review the summary and close the gameweek.
              </p>
            </div>
            <CloseGameweekDialog
              gameweekId={activeGw.id}
              gameweekNumber={activeGw.number}
              isClosed={false}
            />
          </div>
        )}

        {/* Gameweek Closed card — shown when active GW is already closed */}
        {activeGw && gwIsClosed && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p className="font-semibold text-blue-900">
                GW{activeGw.number} closed
              </p>
              <p className="text-blue-700 text-sm mt-0.5">
                {activeGw.closed_at
                  ? `Closed on ${new Date(activeGw.closed_at).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}`
                  : 'Gameweek is locked.'}
              </p>
            </div>
            <CloseGameweekDialog
              gameweekId={activeGw.id}
              gameweekNumber={activeGw.number}
              isClosed={true}
            />
          </div>
        )}

        {/* Review Prizes card — shown when there are pending prize awards */}
        {pendingPrizeCount > 0 && (
          <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p className="font-semibold text-purple-900">
                {pendingPrizeCount} prize{pendingPrizeCount !== 1 ? 's' : ''} triggered
              </p>
              <p className="text-purple-700 text-sm mt-0.5">
                Review and confirm prize awards.
              </p>
            </div>
            <Link
              href="/admin/prizes"
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl transition whitespace-nowrap"
            >
              Review Prizes
            </Link>
          </div>
        )}
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
