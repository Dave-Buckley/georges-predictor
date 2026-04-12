import { Crown } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { AdminLosTable, type AdminLosMember } from '@/components/los/admin-los-table'
import { resetCompetitionManually } from '@/actions/admin/los'

export const dynamic = 'force-dynamic'

interface CompetitionRow {
  id: string
  competition_num: number
  starts_at_gw: number
  season: number
  status: string
}

interface CompetitionMemberRow {
  member_id: string
  status: 'active' | 'eliminated'
  eliminated_at_gw: number | null
  eliminated_reason: string | null
  members: {
    id: string
    display_name: string
    email: string | null
  }
}

interface PickRow {
  id: string
  member_id: string
  team_id: string
  gameweek_id: string
  gameweeks: { id: string; number: number }
  teams: {
    id: string
    name: string
    short_name: string | null
    crest_url: string | null
  }
}

async function getAdminLosData() {
  const supabase = createAdminClient()

  const { data: activeComp } = await supabase
    .from('los_competitions')
    .select('id, competition_num, starts_at_gw, season, status')
    .eq('status', 'active')
    .maybeSingle()

  const { data: currentGw } = await supabase
    .from('gameweeks')
    .select('id, number')
    .eq('status', 'active')
    .order('number', { ascending: false })
    .limit(1)
    .maybeSingle()

  const currentGwNumber = (currentGw as { number?: number } | null)?.number ?? null
  const currentGwId = (currentGw as { id?: string } | null)?.id ?? null

  if (!activeComp) {
    return {
      activeComp: null,
      currentGwNumber,
      members: [] as AdminLosMember[],
    }
  }

  const comp = activeComp as CompetitionRow

  const { data: compMembersData } = await supabase
    .from('los_competition_members')
    .select(
      `member_id, status, eliminated_at_gw, eliminated_reason,
       members:members!member_id(id, display_name, email)`
    )
    .eq('competition_id', comp.id)

  const compMembers = (compMembersData ?? []) as unknown as CompetitionMemberRow[]

  const { data: picksData } = await supabase
    .from('los_picks')
    .select(
      `id, member_id, team_id, gameweek_id,
       gameweeks:gameweeks!gameweek_id(id, number),
       teams:teams!team_id(id, name, short_name, crest_url)`
    )
    .eq('competition_id', comp.id)

  const picks = (picksData ?? []) as unknown as PickRow[]

  const picksByMember = new Map<string, PickRow[]>()
  for (const p of picks) {
    if (!picksByMember.has(p.member_id)) picksByMember.set(p.member_id, [])
    picksByMember.get(p.member_id)!.push(p)
  }

  const members: AdminLosMember[] = compMembers.map((cm) => {
    const mp = picksByMember.get(cm.member_id) ?? []
    const teamsUsed = mp.map((p) => ({
      id: p.teams.id,
      name: p.teams.name,
      short_name: p.teams.short_name,
      crest_url: p.teams.crest_url,
      gameweek_number: p.gameweeks.number,
    }))

    const currentPickRow = currentGwId
      ? mp.find((p) => p.gameweek_id === currentGwId)
      : undefined

    return {
      member_id: cm.member_id,
      display_name: cm.members.display_name,
      email: cm.members.email,
      status: cm.status,
      eliminated_at_gw: cm.eliminated_at_gw,
      eliminated_reason: cm.eliminated_reason,
      teamsUsed,
      currentPick: currentPickRow
        ? {
            team_id: currentPickRow.teams.id,
            team_name: currentPickRow.teams.name,
            crest_url: currentPickRow.teams.crest_url,
          }
        : null,
    }
  })

  return { activeComp: comp, currentGwNumber, members }
}

export default async function AdminLosPage() {
  const { activeComp, currentGwNumber, members } = await getAdminLosData()

  return (
    <div className="p-6 lg:p-8 max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Crown className="w-6 h-6 text-yellow-500" />
          Last One Standing
        </h1>
        <p className="text-gray-500 mt-1">
          Manage the sub-competition: override eliminations, reinstate members, or
          reset the cycle.
        </p>
      </div>

      {!activeComp ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center space-y-4">
          <p className="text-gray-700 font-medium">
            No active Last One Standing competition.
          </p>
          <p className="text-sm text-gray-500">
            Start a new competition manually — useful after a mid-season import or
            if the previous cycle ended without a winner.
          </p>
          <form
            action={resetCompetitionManually as unknown as (fd: FormData) => void}
            className="inline-block"
          >
            {/* No competition_id to reset — the server action requires one; this
                falls back to a manual bootstrap path. For now, show informational
                message so George knows to wait for the sync pipeline to auto-seed. */}
            <p className="text-xs text-gray-400">
              A competition is seeded automatically when members are approved and a
              gameweek is created. If this is missing, check the migration + member
              approval flow.
            </p>
          </form>
        </div>
      ) : (
        <AdminLosTable
          competitionId={activeComp.id}
          competitionNumber={activeComp.competition_num}
          startsAtGw={activeComp.starts_at_gw}
          season={activeComp.season}
          currentGwNumber={currentGwNumber}
          members={members}
        />
      )}
    </div>
  )
}
