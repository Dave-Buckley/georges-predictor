import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { MemberRow, GameweekRow, FixtureWithTeams } from '@/lib/supabase/types'
import PendingNotice from '@/components/member/pending-notice'
import DashboardOverview from '@/components/member/dashboard-overview'

// Force dynamic rendering — reads member data on every request
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // Middleware handles this — this is defense in depth
    redirect('/login')
  }

  const { data: member } = await supabase
    .from('members')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!member) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-400">
          Member data not found. Please contact George.
        </p>
      </div>
    )
  }

  const memberRow = member as MemberRow

  // Rejected members should not be here — redirect to home
  if (memberRow.approval_status === 'rejected') {
    redirect('/')
  }

  // Pending members see the approval notice
  if (memberRow.approval_status === 'pending') {
    return <PendingNotice />
  }

  // ─── Fetch current gameweek and upcoming fixtures for approved members ────────

  let currentGameweek: GameweekRow | undefined
  let upcomingFixtures: FixtureWithTeams[] | undefined

  // Find the earliest gameweek with SCHEDULED or TIMED fixtures
  const { data: upcomingFixtureRows } = await supabase
    .from('fixtures')
    .select('gameweek_id')
    .in('status', ['SCHEDULED', 'TIMED'])
    .order('kickoff_time')
    .limit(1)

  let targetGameweekId: string | null = null

  if (upcomingFixtureRows && upcomingFixtureRows.length > 0) {
    targetGameweekId = upcomingFixtureRows[0].gameweek_id
  } else {
    // Fall back to the latest completed gameweek
    const { data: latestGw } = await supabase
      .from('gameweeks')
      .select('id')
      .eq('status', 'complete')
      .order('number', { ascending: false })
      .limit(1)

    if (latestGw && latestGw.length > 0) {
      targetGameweekId = latestGw[0].id
    }
  }

  if (targetGameweekId) {
    const { data: gwData } = await supabase
      .from('gameweeks')
      .select('*')
      .eq('id', targetGameweekId)
      .single()

    if (gwData) {
      currentGameweek = gwData as GameweekRow

      // Fetch first 5 upcoming fixtures for this gameweek
      const { data: fixturesData } = await supabase
        .from('fixtures')
        .select('*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*), gameweek:gameweeks!gameweek_id(*)')
        .eq('gameweek_id', targetGameweekId)
        .in('status', ['SCHEDULED', 'TIMED'])
        .order('kickoff_time')
        .limit(5)

      upcomingFixtures = (fixturesData ?? []) as FixtureWithTeams[]
    }
  }

  // Approved members see the full dashboard
  return (
    <DashboardOverview
      member={memberRow}
      currentGameweek={currentGameweek}
      upcomingFixtures={upcomingFixtures}
    />
  )
}
