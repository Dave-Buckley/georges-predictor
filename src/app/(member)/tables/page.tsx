import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStandingsAtGameweek } from '@/lib/standings/get-standings-at-gameweek'
import type { GameweekRow } from '@/lib/supabase/types'
import { GameweekSelector } from './_components/gameweek-selector'
import { StandingsList } from './_components/standings-list'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: "Tables — George's Predictor",
}

interface PageProps {
  searchParams: Promise<{ gw?: string }>
}

function pickDefaultGameweek(gameweeks: GameweekRow[]): number {
  if (gameweeks.length === 0) return 1
  const complete = [...gameweeks].reverse().find((gw) => gw.status === 'complete')
  if (complete) return complete.number
  const active = gameweeks.find((gw) => gw.status === 'active')
  if (active) return active.number
  const scheduled = gameweeks.find((gw) => gw.status === 'scheduled')
  if (scheduled) return scheduled.number
  return gameweeks[gameweeks.length - 1].number
}

export default async function MemberTablesPage({ searchParams }: PageProps) {
  const { gw: gwParam } = await searchParams
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: viewer } = await supabase
    .from('members')
    .select('id')
    .eq('user_id', user.id)
    .single()
  const viewerMemberId = (viewer as { id: string } | null)?.id ?? null

  const admin = createAdminClient()
  const { data: gwsRaw } = await admin
    .from('gameweeks')
    .select('id, number, status, double_bubble, closed_at, season, closed_by, created_at, kickoff_backup_sent_at, reports_sent_at')
    .order('number')
  const gameweeks = (gwsRaw ?? []) as GameweekRow[]

  if (gameweeks.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Tables</h1>
        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-8 text-center text-slate-400 text-sm">
          No gameweeks available yet.
        </div>
      </div>
    )
  }

  const defaultGw = pickDefaultGameweek(gameweeks)
  const requested = gwParam ? parseInt(gwParam, 10) : defaultGw
  const selectedGwNumber = isNaN(requested) ? defaultGw : requested

  const standings = await getStandingsAtGameweek(selectedGwNumber)

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-white">Tables</h1>
        <p className="text-sm text-slate-400">
          League standings at the end of each gameweek.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-slate-300">Gameweek:</label>
        <GameweekSelector gameweeks={gameweeks} selectedGw={selectedGwNumber} />
        {standings?.doubleBubbleActive && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-200 border border-purple-400/40">
            ⚡ Double Bubble ×2
          </span>
        )}
        {standings?.status === 'complete' && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
            Complete
          </span>
        )}
        {standings?.status === 'active' && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-pl-green/20 text-pl-green border border-pl-green/40">
            Active
          </span>
        )}
        {standings?.status === 'scheduled' && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
            Upcoming
          </span>
        )}
      </div>

      {standings ? (
        <StandingsList
          rows={standings.rows}
          viewerMemberId={viewerMemberId}
          weeklyLabel={`GW${standings.gwNumber}`}
        />
      ) : (
        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-8 text-center text-slate-400 text-sm">
          Gameweek {selectedGwNumber} not found.
        </div>
      )}
    </div>
  )
}
