/**
 * /end-of-season — public summary shown after the current season archives
 * and before the next one launches.
 *
 * Queries the most recently archived season (ended_at NOT NULL) and renders:
 *   - Hero: "{YYYY-YY} Season — Final Standings"
 *   - Champion spotlight: top 3 with display names + totals
 *   - Full final standings table
 *   - LOS winners per competition for that season
 *   - Prize awards summary
 *   - Pre-season all-correct list
 *
 * Fallback (no archived season): friendly "check back" copy.
 */
import Link from 'next/link'

import { createAdminClient } from '@/lib/supabase/admin'
import { MemberLink } from '@/components/shared/member-link'

export const dynamic = 'force-dynamic'

interface ArchivedSeason {
  season: number
  label: string | null
  ended_at: string
}

interface FinalStanding {
  id: string
  display_name: string
  starting_points: number
  rank: number
}

async function loadEndOfSeasonData(): Promise<{
  season: ArchivedSeason | null
  standings: FinalStanding[]
  losWinners: Array<{ id: string; display_name: string }>
  prizeAwards: Array<{ prize_label: string; display_name: string; points: number }>
  preSeasonWinners: Array<{ display_name: string; kind: string }>
}> {
  const admin = createAdminClient()

  // 1. Most recently archived season
  const { data: seasonRaw } = await admin
    .from('seasons')
    .select('season, label, ended_at')
    .not('ended_at', 'is', null)
    .order('season', { ascending: false })
    .limit(1)
    .maybeSingle()

  const season = seasonRaw as ArchivedSeason | null
  if (!season) {
    return {
      season: null,
      standings: [],
      losWinners: [],
      prizeAwards: [],
      preSeasonWinners: [],
    }
  }

  // 2. Final standings — use members.starting_points as the canonical total
  //    (consistent with /standings). This reflects the as-of-archive state.
  const { data: membersRaw } = await admin
    .from('members')
    .select('id, display_name, starting_points')
    .eq('approval_status', 'approved')
    .order('starting_points', { ascending: false })

  const members =
    ((membersRaw as Array<{
      id: string
      display_name: string
      starting_points: number | null
    }> | null) ?? []).map((m) => ({
      id: m.id,
      display_name: m.display_name,
      starting_points: m.starting_points ?? 0,
    }))

  // Dense rank by starting_points (ties share rank)
  const sorted = [...members].sort((a, b) => {
    if (b.starting_points !== a.starting_points) {
      return b.starting_points - a.starting_points
    }
    return a.display_name.localeCompare(b.display_name)
  })
  let rank = 0
  let prevPts = Number.POSITIVE_INFINITY
  const standings: FinalStanding[] = sorted.map((m, i) => {
    if (m.starting_points < prevPts) {
      rank = i + 1
      prevPts = m.starting_points
    }
    return { ...m, rank }
  })

  // 3. LOS winners for this season
  const { data: losRaw } = await admin
    .from('los_competitions')
    .select('winner_id, members:members!winner_id(id, display_name)')
    .eq('season', season.season)
    .not('winner_id', 'is', null)
  const losWinners = ((losRaw as Array<{
    winner_id: string
    members: { id: string; display_name: string } | null
  }> | null) ?? [])
    .map((r) => r.members)
    .filter((m): m is { id: string; display_name: string } => Boolean(m))

  // 4. Prize awards for this season — labels via prizes table
  const { data: prizesRaw } = await admin
    .from('prize_awards')
    .select(
      'points, members:members!member_id(display_name), prizes:prizes!prize_id(label)',
    )
    .eq('status', 'confirmed')
  const prizeAwards = ((prizesRaw as Array<{
    points: number | null
    members: { display_name: string } | null
    prizes: { label: string } | null
  }> | null) ?? [])
    .filter((r) => r.members && r.prizes)
    .map((r) => ({
      prize_label: r.prizes!.label,
      display_name: r.members!.display_name,
      points: r.points ?? 0,
    }))

  // 5. Pre-season all-correct winners
  const { data: psRaw } = await admin
    .from('pre_season_awards')
    .select('members:members!member_id(display_name), kind')
    .eq('season', season.season)
    .eq('confirmed', true)
  const preSeasonWinners = ((psRaw as Array<{
    members: { display_name: string } | null
    kind: string
  }> | null) ?? [])
    .filter((r) => r.members)
    .map((r) => ({ display_name: r.members!.display_name, kind: r.kind }))

  return { season, standings, losWinners, prizeAwards, preSeasonWinners }
}

export default async function EndOfSeasonPage() {
  const { season, standings, losWinners, prizeAwards, preSeasonWinners } =
    await loadEndOfSeasonData()

  if (!season) {
    return (
      <div className="text-white">
        <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
          <h1 className="text-2xl font-bold text-white">No archived season yet</h1>
          <p className="text-slate-300">
            Check back after the first season completes — the end-of-season summary lands here
            once George archives the year.
          </p>
          <Link
            href="/standings"
            className="inline-block rounded-xl bg-pl-green px-5 py-2 font-semibold text-pl-purple hover:bg-white transition"
          >
            View live standings →
          </Link>
        </div>
      </div>
    )
  }

  const seasonLabel = season.label ?? `${season.season}-${(season.season + 1) % 100}`
  const topThree = standings.slice(0, 3)

  return (
    <div className="text-white">
      {/* Hero */}
      <section className="bg-gradient-to-br from-pl-purple via-pl-purple-dark to-slate-900 py-12 sm:py-16 text-center">
        <div className="max-w-4xl mx-auto px-4 space-y-3">
          <p className="text-pl-green text-sm uppercase tracking-widest font-semibold">
            Season archived {new Date(season.ended_at).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </p>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight">
            {seasonLabel} Season — Final Standings
          </h1>
          <p className="text-slate-200">Congratulations to everyone who played.</p>
        </div>
      </section>

      <main className="max-w-4xl mx-auto px-4 py-10 space-y-10">
        {/* Champion spotlight */}
        {topThree.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white">Champion spotlight</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {topThree.map((m, i) => (
                <div
                  key={m.id}
                  className={`rounded-2xl p-5 text-center space-y-2 ${
                    i === 0
                      ? 'bg-pl-purple border-2 border-pl-green'
                      : 'bg-slate-900 border border-slate-700'
                  }`}
                >
                  <div className="text-3xl">
                    {i === 0 ? '🏆' : i === 1 ? '🥈' : '🥉'}
                  </div>
                  <div className="text-xs uppercase tracking-widest text-slate-400">
                    {i === 0 ? 'Champion' : `${m.rank}nd` || `${m.rank}rd`}
                  </div>
                  <div className="text-lg font-bold">
                    <MemberLink displayName={m.display_name} className="text-white" />
                  </div>
                  <div className="text-pl-green text-2xl font-black">{m.starting_points}</div>
                  <div className="text-xs text-slate-400">points</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Final standings table */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">Final standings</h2>
          <div className="rounded-2xl border border-slate-700 bg-slate-900 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/60">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider w-16">
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
                  <tr key={m.id} className={m.rank === 1 ? 'bg-pl-purple/20' : ''}>
                    <td className="px-4 py-2.5 font-medium text-slate-300">{m.rank}</td>
                    <td className="px-4 py-2.5">
                      <MemberLink displayName={m.display_name} className="text-white" />
                    </td>
                    <td className="px-4 py-2.5 text-right text-pl-green font-bold">
                      {m.starting_points}
                    </td>
                  </tr>
                ))}
                {standings.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                      No standings for this season.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* LOS winners */}
        {losWinners.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">Last One Standing winners</h2>
            <ul className="rounded-2xl border border-slate-700 bg-slate-900 divide-y divide-slate-800">
              {losWinners.map((w) => (
                <li key={w.id} className="px-4 py-3 text-sm">
                  👑{' '}
                  <MemberLink displayName={w.display_name} className="text-white font-medium" />
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Prize awards */}
        {prizeAwards.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">Prize awards</h2>
            <ul className="rounded-2xl border border-slate-700 bg-slate-900 divide-y divide-slate-800">
              {prizeAwards.map((p, i) => (
                <li key={i} className="px-4 py-3 text-sm flex items-center justify-between">
                  <span>
                    <strong className="text-pl-green">{p.prize_label}</strong>:{' '}
                    <MemberLink displayName={p.display_name} className="text-white" />
                  </span>
                  <span className="text-pl-green font-mono">{p.points}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Pre-season winners */}
        {preSeasonWinners.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">Pre-season awards</h2>
            <ul className="rounded-2xl border border-slate-700 bg-slate-900 divide-y divide-slate-800">
              {preSeasonWinners.map((w, i) => (
                <li key={i} className="px-4 py-3 text-sm">
                  ⭐{' '}
                  <MemberLink displayName={w.display_name} className="text-white font-medium" />
                  <span className="text-slate-400 ml-2 text-xs uppercase tracking-widest">
                    {w.kind}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  )
}
