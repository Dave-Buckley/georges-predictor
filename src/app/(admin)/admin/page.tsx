import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { SyncStatus } from '@/components/admin/sync-status'
import { CloseGameweekDialog } from '@/components/admin/close-gameweek-dialog'
import { getCurrentSeason, getUpcomingSeason } from '@/lib/pre-season/seasons'
import type { MemberRow, AdminNotificationRow, SyncLogRow, GameweekRow } from '@/lib/supabase/types'
import { DownloadFullExport } from './_components/DownloadFullExport'

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

    // ── Pre-season card state ───────────────────────────────────────────────
    // Three possible cards, urgency: submissions (info) → actuals (action) →
    // pending awards (action). We compute all three then pick the first
    // applicable one at render-time.
    const [upcomingSeason, currentSeason] = await Promise.all([
      getUpcomingSeason(),
      getCurrentSeason(),
    ])

    let preSeasonCard: null | {
      kind: 'submissions' | 'actuals' | 'awards'
      message: string
      detail: string
      season: number
    } = null

    if (upcomingSeason && new Date(upcomingSeason.gw1_kickoff) > new Date()) {
      // Submissions window open — count submissions
      const approvedMembers = members.filter((m) => m.approval_status === 'approved')
      const { data: picksData } = await supabase
        .from('pre_season_picks')
        .select('member_id')
        .eq('season', upcomingSeason.season)
      const submitted = (picksData ?? []).length
      if (submitted < approvedMembers.length) {
        preSeasonCard = {
          kind: 'submissions',
          message: `Pre-season submissions: ${submitted}/${approvedMembers.length}`,
          detail: 'Enter picks for any late-joiners before GW1 kicks off.',
          season: upcomingSeason.season,
        }
      }
    } else if (currentSeason) {
      // Post-GW1: check actuals + awards state
      if (!currentSeason.actuals_locked_at) {
        // Only show this card when all of this season's PL fixtures are done —
        // otherwise it's noise. Cheap proxy: the season must be the current
        // season and we check for any still-scheduled fixtures at all.
        const { data: scheduledFixtures } = await supabase
          .from('fixtures')
          .select('id')
          .neq('status', 'FINISHED')
          .limit(1)
        const allDone = (scheduledFixtures ?? []).length === 0
        if (allDone) {
          preSeasonCard = {
            kind: 'actuals',
            message: 'Pre-season: enter final standings',
            detail: `The ${currentSeason.label} season is complete — lock actuals so awards can be calculated.`,
            season: currentSeason.season,
          }
        }
      } else {
        // Actuals are locked — show a card if any awards remain unconfirmed
        const { data: unconfirmedAwards } = await supabase
          .from('pre_season_awards')
          .select('id')
          .eq('season', currentSeason.season)
          .eq('confirmed', false)
        const pending = (unconfirmedAwards ?? []).length
        if (pending > 0) {
          preSeasonCard = {
            kind: 'awards',
            message: `Pre-season: ${pending} award${pending !== 1 ? 's' : ''} pending confirmation`,
            detail: 'Review each member and apply their award.',
            season: currentSeason.season,
          }
        }
      }
    }

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
      preSeasonCard,
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
      preSeasonCard: null,
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
    preSeasonCard,
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

        {/* Pre-Season card — shown when submissions open / actuals needed / awards pending */}
        {preSeasonCard && (
          <div
            className={`${
              preSeasonCard.kind === 'submissions'
                ? 'bg-blue-50 border-blue-200'
                : 'bg-amber-50 border-amber-200'
            } border rounded-2xl p-5 flex items-center justify-between`}
          >
            <div>
              <p
                className={`font-semibold ${
                  preSeasonCard.kind === 'submissions' ? 'text-blue-900' : 'text-amber-900'
                }`}
              >
                {preSeasonCard.message}
              </p>
              <p
                className={`text-sm mt-0.5 ${
                  preSeasonCard.kind === 'submissions' ? 'text-blue-700' : 'text-amber-700'
                }`}
              >
                {preSeasonCard.detail}
              </p>
            </div>
            <Link
              href="/admin/pre-season"
              className={`${
                preSeasonCard.kind === 'submissions'
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-amber-600 hover:bg-amber-700'
              } px-4 py-2 text-white text-sm font-semibold rounded-xl transition whitespace-nowrap`}
            >
              Open
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

      {/* Tools — full-season export, etc. */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Tools
        </h2>
        <DownloadFullExport />
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
