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
import { StandingsTable } from './_components/standings-table'

export const dynamic = 'force-dynamic'

// ─── Types ───────────────────────────────────────────────────────────────────

interface StandingRow {
  id: string
  display_name: string
  starting_points: number
  weekly_points: number
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

  // Defer building standings until weekly-points map is populated (below).
  const standingsBase = rawMembers.map((m) => ({
    id: m.id,
    display_name: m.display_name,
    starting_points: m.starting_points ?? 0,
  }))

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
  const weeklyPointsById = new Map<string, number>()

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
      for (const s of gw.standings) {
        weeklyPointsById.set(s.memberId, s.weeklyPoints)
      }
    } catch {
      topWeekly = []
    }
  }

  // The client table handles sort + rank — we just hand it the rows.
  const standings: StandingRow[] = standingsBase.map((m) => ({
    ...m,
    weekly_points: weeklyPointsById.get(m.id) ?? 0,
  }))

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

      {/* ── Weekly winner callout ────────────────────────────────────────── */}
      {latestGw && topWeekly.length > 0 && (
        <section className="rounded-2xl border border-pl-green/30 bg-gradient-to-br from-pl-green/10 to-purple-500/10 p-5 space-y-3">
          <p className="text-xs font-semibold text-pl-green uppercase tracking-wider">
            Gameweek {latestGw.number} weekly winner
          </p>
          <div className="flex items-baseline gap-3 flex-wrap">
            <MemberLink
              displayName={topWeekly[0].displayName}
              className="text-2xl font-bold text-white"
            />
            <span className="text-pl-green font-bold tabular-nums text-lg">
              {topWeekly[0].weeklyPoints} pts
            </span>
          </div>
          {topWeekly.length > 1 && (
            <p className="text-sm text-slate-300">
              Runner-up:{' '}
              <MemberLink
                displayName={topWeekly[1].displayName}
                className="text-slate-200 font-medium"
              />
              <span className="text-slate-400"> — {topWeekly[1].weeklyPoints} pts</span>
              {topWeekly.length > 2 && (
                <>
                  {' '}&middot; Third:{' '}
                  <MemberLink
                    displayName={topWeekly[2].displayName}
                    className="text-slate-200 font-medium"
                  />
                  <span className="text-slate-400"> — {topWeekly[2].weeklyPoints} pts</span>
                </>
              )}
            </p>
          )}
        </section>
      )}

      {/* ── Standings table ──────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-200">Standings</h2>
        <p className="text-xs text-slate-500">
          Tap a column header to sort.
        </p>
        <StandingsTable
          rows={standings.map(({ id, display_name, starting_points, weekly_points }) => ({
            id,
            display_name,
            starting_points,
            weekly_points,
          }))}
          weeklyLabel={latestGw ? `GW${latestGw.number}` : 'This Week'}
        />
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
