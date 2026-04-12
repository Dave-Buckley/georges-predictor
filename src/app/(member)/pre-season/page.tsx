import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentSeason, getUpcomingSeason } from '@/lib/pre-season/seasons'
import { CHAMPIONSHIP_TEAMS_2025_26 } from '@/lib/teams/championship-2025-26'
import type { PreSeasonPickRow, TeamRow } from '@/lib/supabase/types'
import PreSeasonForm from './_components/pre-season-form'
import PreSeasonReadOnly from './_components/pre-season-read-only'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: "Pre-Season — George's Predictor",
}

export default async function PreSeasonPage() {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const adminClient = createAdminClient()

  // Resolve member_id from auth.uid()
  const { data: memberRow } = await adminClient
    .from('members')
    .select('id, approval_status')
    .eq('user_id', user.id)
    .maybeSingle()

  const member = memberRow as { id: string; approval_status?: string } | null

  if (!member) {
    return (
      <div className="rounded-xl border border-amber-700/50 bg-amber-900/20 p-6 text-center">
        <p className="text-amber-200 text-sm">
          Your account is awaiting approval from George.
        </p>
      </div>
    )
  }

  if (member.approval_status && member.approval_status !== 'approved') {
    return (
      <div className="rounded-xl border border-amber-700/50 bg-amber-900/20 p-6 text-center">
        <p className="text-amber-200 text-sm">
          Your account is awaiting approval from George.
        </p>
      </div>
    )
  }

  const [upcoming, current] = await Promise.all([
    getUpcomingSeason(),
    getCurrentSeason(),
  ])

  // Preferred path: upcoming season with open window → submission form
  if (upcoming && new Date(upcoming.gw1_kickoff).getTime() > Date.now()) {
    const [{ data: plTeamsData }, { data: priorPicksData }] = await Promise.all([
      adminClient
        .from('teams')
        .select('id, external_id, name, short_name, tla, crest_url, updated_at')
        .order('name'),
      adminClient
        .from('pre_season_picks')
        .select('*')
        .eq('member_id', member.id)
        .eq('season', upcoming.season)
        .maybeSingle(),
    ])

    const plTeams = (plTeamsData ?? []) as TeamRow[]
    const priorPicks = (priorPicksData as PreSeasonPickRow | null) ?? null

    return (
      <PreSeasonForm
        season={upcoming}
        plTeams={plTeams.map((t) => ({ name: t.name }))}
        championship={CHAMPIONSHIP_TEAMS_2025_26}
        initial={priorPicks}
      />
    )
  }

  // Fallback: current season → read-only view of imported picks
  if (current) {
    const [{ data: plTeamsData }, { data: picksData }] = await Promise.all([
      adminClient
        .from('teams')
        .select('id, external_id, name, short_name, tla, crest_url, updated_at')
        .order('name'),
      adminClient
        .from('pre_season_picks')
        .select('*')
        .eq('member_id', member.id)
        .eq('season', current.season)
        .maybeSingle(),
    ])

    const plTeams = (plTeamsData ?? []) as TeamRow[]
    const picks = (picksData as PreSeasonPickRow | null) ?? null

    return <PreSeasonReadOnly season={current} picks={picks} plTeams={plTeams} />
  }

  // No season configured
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6 text-center">
      <p className="text-slate-300 text-sm">No active pre-season window right now.</p>
      <p className="text-slate-500 text-xs mt-2">
        The next window opens once George configures the upcoming season.
      </p>
    </div>
  )
}
