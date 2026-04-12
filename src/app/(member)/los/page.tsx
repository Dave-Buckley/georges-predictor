import { Crown } from 'lucide-react'
import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { LosStatusCard, type LosCurrentPick } from '@/components/los/los-status-card'
import { LosStandings, type LosStandingRow } from '@/components/los/los-standings'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Last One Standing — George\'s Predictor',
}

interface CompMemberRow {
  member_id: string
  status: 'active' | 'eliminated'
  eliminated_at_gw: number | null
  members: {
    id: string
    display_name: string
  }
}

interface PickRow {
  team_id: string
  gameweek_id: string
  gameweeks: { id: string; number: number } | null
  teams: { id: string; name: string; short_name: string | null; crest_url: string | null } | null
}

export default async function MemberLosPage() {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-8 text-center">
        <p className="text-slate-400">Please log in to view Last One Standing.</p>
      </div>
    )
  }

  const { data: member } = await supabase
    .from('members')
    .select('id, approval_status')
    .eq('user_id', user.id)
    .single()

  if (!member || (member as { approval_status?: string }).approval_status !== 'approved') {
    return (
      <div className="rounded-xl border border-amber-700/50 bg-amber-900/20 p-8 text-center">
        <p className="text-amber-300">
          Your account is awaiting approval from George.
        </p>
      </div>
    )
  }

  const memberId = (member as { id: string }).id

  // Active competition — use admin client for the standings list (roster info
  // is public; RLS on los_competition_members still protects fine-grained data).
  const adminClient = createAdminClient()

  const { data: activeComp } = await adminClient
    .from('los_competitions')
    .select('id, competition_num, starts_at_gw, season')
    .eq('status', 'active')
    .maybeSingle()

  if (!activeComp) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Crown className="w-6 h-6 text-yellow-400" />
          Last One Standing
        </h1>
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-8 text-center">
          <p className="text-slate-300">
            No active Last One Standing competition right now.
          </p>
          <p className="text-slate-500 text-sm mt-2">
            A new cycle begins once the current one finishes.
          </p>
        </div>
      </div>
    )
  }

  const comp = activeComp as { id: string; competition_num: number; starts_at_gw: number; season: number }

  // Current gameweek
  const { data: currentGw } = await adminClient
    .from('gameweeks')
    .select('id, number')
    .eq('status', 'active')
    .order('number', { ascending: false })
    .limit(1)
    .maybeSingle()

  const currentGwId = (currentGw as { id?: string } | null)?.id ?? null

  // My LOS status
  const { data: myRow } = await adminClient
    .from('los_competition_members')
    .select('status, eliminated_at_gw')
    .eq('competition_id', comp.id)
    .eq('member_id', memberId)
    .maybeSingle()

  const myStatus =
    ((myRow as { status?: 'active' | 'eliminated' } | null)?.status ?? 'active') as
      | 'active'
      | 'eliminated'
  const eliminatedAtGw =
    (myRow as { eliminated_at_gw?: number | null } | null)?.eliminated_at_gw ?? null

  // My picks (all history in this cycle)
  const { data: myPicksData } = await adminClient
    .from('los_picks')
    .select(
      `team_id, gameweek_id,
       gameweeks:gameweeks!gameweek_id(id, number),
       teams:teams!team_id(id, name, short_name, crest_url)`
    )
    .eq('competition_id', comp.id)
    .eq('member_id', memberId)

  const myPicks = (myPicksData ?? []) as unknown as PickRow[]

  const currentPickRow = currentGwId
    ? myPicks.find((p) => p.gameweek_id === currentGwId)
    : undefined

  const currentPick: LosCurrentPick | null = currentPickRow?.teams && currentPickRow.gameweeks
    ? {
        team_name: currentPickRow.teams.name,
        team_short_name: currentPickRow.teams.short_name,
        crest_url: currentPickRow.teams.crest_url,
        gameweek_number: currentPickRow.gameweeks.number,
      }
    : null

  // teams-used count: unique team_ids in cycle
  const uniqueTeamIds = new Set(myPicks.map((p) => p.team_id))
  const teamsUsedCount = uniqueTeamIds.size
  // 20 PL teams; cycle resets at 20 per availableTeams() helper
  const teamsRemaining = teamsUsedCount >= 20 ? 20 : 20 - teamsUsedCount

  // All competition members for standings
  const { data: allMembersData } = await adminClient
    .from('los_competition_members')
    .select(
      `member_id, status, eliminated_at_gw,
       members:members!member_id(id, display_name)`
    )
    .eq('competition_id', comp.id)

  const allMembers = (allMembersData ?? []) as unknown as CompMemberRow[]

  // Fetch teams-used count per member
  const { data: allPicksData } = await adminClient
    .from('los_picks')
    .select('member_id, team_id')
    .eq('competition_id', comp.id)

  const allPicks = (allPicksData ?? []) as Array<{ member_id: string; team_id: string }>

  const usageByMember = new Map<string, Set<string>>()
  for (const p of allPicks) {
    if (!usageByMember.has(p.member_id)) usageByMember.set(p.member_id, new Set())
    usageByMember.get(p.member_id)!.add(p.team_id)
  }

  const standings: LosStandingRow[] = allMembers.map((m) => ({
    member_id: m.member_id,
    display_name: m.members.display_name,
    teamsUsedCount: usageByMember.get(m.member_id)?.size ?? 0,
    status: m.status,
    eliminatedAtGw: m.eliminated_at_gw,
  }))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white flex items-center gap-2">
        <Crown className="w-6 h-6 text-yellow-400" />
        Last One Standing
      </h1>

      <LosStatusCard
        status={myStatus}
        currentPick={currentPick}
        teamsUsedCount={teamsUsedCount}
        teamsRemaining={teamsRemaining}
        competitionNumber={comp.competition_num}
        startsAtGw={comp.starts_at_gw}
        eliminatedAtGw={eliminatedAtGw}
      />

      <LosStandings members={standings} viewerMemberId={memberId} />
    </div>
  )
}
