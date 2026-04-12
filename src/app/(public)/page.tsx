/**
 * Home page `/` — landing for unauthenticated visitors.
 *
 * Renders the LandingHero banner + a compact top-5 standings preview +
 * a "View full standings" CTA + a "How it works" link.
 *
 * NOTE on end-of-season summary: Plan 04 will layer a conditional
 * `/end-of-season` view on top of this page (shown when the current season
 * is archived via `seasons.ended_at`). The structure here is intentionally
 * a straight landing so Plan 04 can branch the top-level render.
 *
 * NOTE on dynamic: Next 16 Turbopack force-renders this on every request
 * (matches `/standings` pattern).
 */
import Link from 'next/link'

import { createAdminClient } from '@/lib/supabase/admin'
import { MemberLink } from '@/components/shared/member-link'
import { LandingHero } from '@/components/hero/landing-hero'

export const dynamic = 'force-dynamic'

interface StandingRow {
  id: string
  display_name: string
  starting_points: number
  rank: number
}

async function getTopStandings(limit = 5): Promise<StandingRow[]> {
  const supabase = createAdminClient()

  // COLUMN ALLOWLIST — same discipline as /standings. No predictions /
  // LOS picks / bonus details leak to unauthenticated viewers.
  const { data: membersRaw } = await supabase
    .from('members')
    .select('id, display_name, starting_points')
    .order('starting_points', { ascending: false })

  const rawMembers = (membersRaw ?? []) as Array<{
    id: string
    display_name: string
    starting_points: number | null
  }>

  return rawMembers
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
    .slice(0, limit)
}

export default async function HomePage() {
  const top = await getTopStandings(5)

  return (
    <div className="text-white">
      <LandingHero showCta />

      <main className="max-w-4xl mx-auto px-4 py-10 space-y-10">
        {/* Top-5 preview */}
        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-lg sm:text-xl font-semibold text-slate-200">
              Top of the table
            </h2>
            <Link
              href="/standings"
              className="text-sm text-pl-green hover:text-white transition"
            >
              View full standings →
            </Link>
          </div>
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
                {top.map((m) => (
                  <tr
                    key={m.id}
                    className={m.rank === 1 ? 'bg-pl-purple/20' : ''}
                  >
                    <td className="px-4 py-3 font-medium text-slate-300">
                      {m.rank}
                    </td>
                    <td className="px-4 py-3 text-white font-medium">
                      <MemberLink
                        displayName={m.display_name}
                        className="text-white font-medium"
                      />
                    </td>
                    <td className="px-4 py-3 text-right text-pl-green font-bold">
                      {m.starting_points}
                    </td>
                  </tr>
                ))}
                {top.length === 0 && (
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

        {/* CTA row */}
        <section className="rounded-2xl bg-gradient-to-br from-pl-purple to-pl-purple-dark border border-pl-purple-light p-6 sm:p-8 text-center space-y-4">
          <h3 className="text-xl sm:text-2xl font-bold text-white">
            New round, new table, new chances.
          </h3>
          <p className="text-slate-200 text-sm sm:text-base">
            Read how to play, or jump in if you&apos;re already in the league.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/how-it-works"
              className="inline-block rounded-xl bg-pl-green px-6 py-3 font-semibold text-pl-purple hover:bg-white transition"
            >
              How it works
            </Link>
            <Link
              href="/login"
              className="inline-block rounded-xl border border-pl-green px-6 py-3 font-semibold text-pl-green hover:bg-pl-green/10 transition"
            >
              Member login
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}
