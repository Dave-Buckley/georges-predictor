/**
 * Public /standings page — league table + latest GW results + top-3 weekly.
 *
 * Rendered without authentication. Uses `createAdminClient()` with an
 * explicit column allowlist — NO predictions, LOS picks, or bonus details
 * are exposed to unauthenticated viewers.
 *
 * Reuses `gatherGameweekData()` from Phase 10 Plan 01 for the top-3 weekly
 * calculation so this page and the weekly reports show the same numbers.
 *
 * Caching: `export const dynamic = 'force-dynamic'` — matches project-wide
 * caching idiom (grep for `dynamic = 'force-dynamic'` shows the pattern
 * used by every other server-rendered page in this codebase). Next 16.2.3
 * still honours this directive; `revalidatePath('/standings')` triggered
 * from `closeGameweek` ensures the page refreshes after each close.
 */
import Link from 'next/link'

import { createAdminClient } from '@/lib/supabase/admin'
import { gatherGameweekData } from '@/lib/reports/_data/gather-gameweek-data'
import { MemberLink } from '@/components/shared/member-link'
import { StandingsHero } from '@/components/hero/standings-hero'
import { CurrentGameweekBanner } from '@/components/shared/current-gameweek-banner'
import { getCurrentGameweek } from '@/lib/gameweeks/current'

export const dynamic = 'force-dynamic'

// ─── Types ───────────────────────────────────────────────────────────────────

interface StandingRow {
  id: string
  display_name: string
  starting_points: number
  rank: number
}

interface FixtureRow {
  id: string
  home: string
  away: string
  home_score: number | null
  away_score: number | null
  status: string
}

interface LatestGw {
  id: string
  number: number
  closed_at: string
}

// ─── Data ────────────────────────────────────────────────────────────────────

async function getStandingsPageData(): Promise<{
  standings: StandingRow[]
  latestGw: LatestGw | null
  fixtures: FixtureRow[]
  topWeekly: Array<{ displayName: string; weeklyPoints: number }>
}> {
  const supabase = createAdminClient()

  // COLUMN ALLOWLIST — explicit projection. No predictions / LOS / bonus
  // fields reach the unauthenticated viewer.
  const { data: membersRaw } = await supabase
    .from('members')
    .select('id, display_name, starting_points')
    .order('starting_points', { ascending: false })

  const rawMembers = (membersRaw ?? []) as Array<{
    id: string
    display_name: string
    starting_points: number | null
  }>

  const standings: StandingRow[] = rawMembers
    .map((m) => ({
      id: m.id,
      display_name: m.display_name,
      starting_points: m.starting_points ?? 0,
    }))
    .sort((a, b) => {
      if (b.starting_points !== a.starting_points) {
        return b.starting_points - a.starting_points
      }
      return a.display_name.localeCompare(b.display_name)
    })
    .map((m, i) => ({ ...m, rank: i + 1 }))

  // Latest "fully played" gameweek — all fixtures in terminal status
  // (FINISHED / CANCELLED / POSTPONED). Independent of admin close workflow
  // so mid-season launches with historical fixture data still render results.
  const { data: allGws } = await supabase
    .from('gameweeks')
    .select('id, number, closed_at')
    .order('number', { ascending: false })

  let latestGw: LatestGw | null = null
  for (const gw of (allGws ?? []) as LatestGw[]) {
    const { count: pendingCount } = await supabase
      .from('fixtures')
      .select('id', { count: 'exact', head: true })
      .eq('gameweek_id', gw.id)
      .not('status', 'in', '(FINISHED,CANCELLED,POSTPONED)')
    if ((pendingCount ?? 0) === 0) {
      // every fixture has reached a terminal state
      const { count: anyCount } = await supabase
        .from('fixtures')
        .select('id', { count: 'exact', head: true })
        .eq('gameweek_id', gw.id)
      if ((anyCount ?? 0) > 0) {
        latestGw = gw
        break
      }
    }
  }

  let fixtures: FixtureRow[] = []
  let topWeekly: Array<{ displayName: string; weeklyPoints: number }> = []

  if (latestGw) {
    const { data: fixturesRaw } = await supabase
      .from('fixtures')
      .select(
        'id, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name), home_score, away_score, status',
      )
      .eq('gameweek_id', latestGw.id)

    const rawFixtures = (fixturesRaw ?? []) as Array<{
      id: string
      home_team: { name: string } | { name: string }[] | null
      away_team: { name: string } | { name: string }[] | null
      home_score: number | null
      away_score: number | null
      status: string
    }>

    fixtures = rawFixtures.map((f) => {
      const home = Array.isArray(f.home_team)
        ? f.home_team[0]?.name ?? ''
        : f.home_team?.name ?? ''
      const away = Array.isArray(f.away_team)
        ? f.away_team[0]?.name ?? ''
        : f.away_team?.name ?? ''
      return {
        id: f.id,
        home,
        away,
        home_score: f.home_score,
        away_score: f.away_score,
        status: f.status,
      }
    })

    // Reuse the Phase 10 aggregator — same numbers as the weekly reports.
    try {
      const gw = await gatherGameweekData(latestGw.id)
      topWeekly = gw.topWeekly.map((t) => ({
        displayName: t.displayName,
        weeklyPoints: t.weeklyPoints,
      }))
    } catch {
      topWeekly = []
    }
  }

  return { standings, latestGw, fixtures, topWeekly }
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function StandingsPage() {
  const [{ standings, latestGw, fixtures, topWeekly }, current] = await Promise.all([
    getStandingsPageData(),
    getCurrentGameweek(),
  ])

  return (
    <div className="text-white">
      <StandingsHero />
      <CurrentGameweekBanner current={current} />
      <main className="max-w-4xl mx-auto px-4 py-10 space-y-10">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="space-y-2">
        <p className="text-slate-400 text-sm">
          Premier League predictions season 2025/26.{' '}
          <Link href="/signup" className="text-purple-400 hover:text-purple-300">
            Join the competition
          </Link>
          {' or '}
          <Link href="/login" className="text-purple-400 hover:text-purple-300">
            log in
          </Link>
          {' — '}
          <Link href="/how-it-works" className="text-pl-green hover:text-white">
            how it works
          </Link>
          .
        </p>
      </header>

      {/* ── Standings table ──────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-200">Standings</h2>
        <div className="rounded-2xl border border-slate-700 bg-slate-900 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800/60">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider w-12">
                  Rank
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Member
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Points
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {standings.map((m) => (
                <tr key={m.id} className={m.rank === 1 ? 'bg-purple-500/10' : ''}>
                  <td className="px-4 py-3 font-medium text-slate-300">
                    {m.rank}
                  </td>
                  <td className="px-4 py-3 text-white font-medium">
                    <MemberLink displayName={m.display_name} className="text-white font-medium" />
                  </td>
                  <td className="px-4 py-3 text-right text-purple-300 font-bold">
                    {m.starting_points}
                  </td>
                </tr>
              ))}
              {standings.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No members yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Latest GW results ────────────────────────────────────────────── */}
      {latestGw ? (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-200">
              GW{latestGw.number} Results
            </h2>
            <div className="rounded-2xl border border-slate-700 bg-slate-900 overflow-hidden divide-y divide-slate-800">
              {fixtures.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <span className="flex-1 text-right text-slate-200 font-medium">
                    {f.home}
                  </span>
                  <span className="flex-shrink-0 text-white font-bold tabular-nums">
                    {f.home_score ?? '-'}
                    {' - '}
                    {f.away_score ?? '-'}
                  </span>
                  <span className="flex-1 text-left text-slate-200 font-medium">
                    {f.away}
                  </span>
                </div>
              ))}
              {fixtures.length === 0 && (
                <div className="px-4 py-6 text-center text-slate-500 text-sm">
                  No fixtures recorded for this gameweek.
                </div>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-200">
              Top 3 this week
            </h2>
            <div className="rounded-2xl border border-slate-700 bg-slate-900 overflow-hidden divide-y divide-slate-800">
              {topWeekly.map((t, i) => (
                <div
                  key={t.displayName}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <span className="text-slate-300 font-medium">
                    {i + 1}.{' '}
                    <MemberLink displayName={t.displayName} className="text-slate-300 font-medium" />
                  </span>
                  <span className="text-purple-300 font-bold tabular-nums">
                    {t.weeklyPoints} pts
                  </span>
                </div>
              ))}
              {topWeekly.length === 0 && (
                <div className="px-4 py-6 text-center text-slate-500 text-sm">
                  No weekly scores yet.
                </div>
              )}
            </div>
          </section>
        </>
      ) : (
        <section className="rounded-2xl border border-slate-700 bg-slate-900 p-8 text-center">
          <p className="text-slate-300 font-medium">
            Awaiting first gameweek — results will appear here as soon as the
            season gets underway.
          </p>
        </section>
      )}
      </main>
    </div>
  )
}
