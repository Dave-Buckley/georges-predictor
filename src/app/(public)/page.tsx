import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { MemberRow } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

async function getTopMembers(): Promise<Pick<MemberRow, 'display_name' | 'starting_points'>[]> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('members')
      .select('display_name, starting_points')
      .eq('approval_status', 'approved')
      .order('starting_points', { ascending: false })
      .limit(5)

    if (error || !data) return []
    return data
  } catch {
    return []
  }
}

export default async function LandingPage() {
  const topMembers = await getTopMembers()
  const hasLeagueData = topMembers.length > 0

  return (
    <div className="flex flex-col">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center px-4 py-24 text-center overflow-hidden">
        {/* Background gradient accent */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(124,58,237,0.18) 0%, transparent 70%)',
          }}
        />

        {/* Badge */}
        <div className="relative inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 mb-6">
          <span className="h-2 w-2 rounded-full bg-purple-400 animate-pulse" />
          <span className="text-purple-300 text-sm font-medium tracking-wide">
            Season 2024/25
          </span>
        </div>

        <h1 className="relative text-5xl sm:text-6xl md:text-7xl font-extrabold text-white tracking-tight leading-none mb-6">
          George&apos;s{' '}
          <span className="text-purple-400">Predictor</span>
        </h1>

        <p className="relative max-w-2xl text-xl sm:text-2xl text-slate-300 leading-relaxed mb-10">
          The Premier League prediction competition where bragging rights meet real money.
          Pick your scores, track the table, claim the prize.
        </p>

        {/* CTA buttons */}
        <div className="relative flex flex-col sm:flex-row gap-4 w-full max-w-xs sm:max-w-none sm:justify-center">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-2xl bg-purple-600 hover:bg-purple-500 active:bg-purple-700 px-8 py-5 text-white font-bold text-xl shadow-lg shadow-purple-500/30 transition-all focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-slate-950"
          >
            Join the Competition
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-2xl border border-slate-600 bg-slate-800/60 hover:bg-slate-700/60 px-8 py-5 text-white font-bold text-xl transition-all focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-950"
          >
            Member Login
          </Link>
        </div>
      </section>

      {/* ── Stats strip ──────────────────────────────────────────────────── */}
      <section className="border-y border-slate-800 bg-slate-900/50 px-4 py-6">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-3xl font-extrabold text-purple-400">PL</p>
            <p className="text-slate-400 text-sm mt-1">Premier League</p>
          </div>
          <div>
            <p className="text-3xl font-extrabold text-purple-400">38</p>
            <p className="text-slate-400 text-sm mt-1">Gameweeks</p>
          </div>
          <div>
            <p className="text-3xl font-extrabold text-green-400">Cash</p>
            <p className="text-slate-400 text-sm mt-1">Prize Pool</p>
          </div>
        </div>
      </section>

      {/* ── League table teaser ───────────────────────────────────────────── */}
      <section className="max-w-2xl mx-auto w-full px-4 py-16">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">Current Standings</h2>
            <span className="text-xs text-slate-500 uppercase tracking-widest">Top 5</span>
          </div>

          <div className="rounded-2xl border border-slate-700 bg-slate-900 overflow-hidden">
            {hasLeagueData ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-800/60">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider w-8">
                      #
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
                  {topMembers.map((member, index) => (
                    <tr
                      key={member.display_name}
                      className={index === 0 ? 'bg-purple-500/5' : ''}
                    >
                      <td className="px-4 py-4 text-center">
                        {index === 0 ? (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-purple-500 text-white font-bold text-xs">
                            1
                          </span>
                        ) : (
                          <span className="text-slate-500 font-medium">{index + 1}</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-white font-medium">{member.display_name}</td>
                      <td className="px-4 py-4 text-right text-purple-300 font-bold">
                        {member.starting_points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-purple-500/10 flex items-center justify-center text-2xl">
                  ??
                </div>
                <p className="text-white font-semibold text-lg">Season starting soon</p>
                <p className="text-slate-400 text-sm max-w-xs">
                  The league table will appear here once the season kicks off.
                  Sign up now to secure your spot!
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section className="border-t border-slate-800 bg-slate-900/30 px-4 py-16">
        <div className="max-w-3xl mx-auto space-y-10">
          <h2 className="text-2xl font-bold text-white text-center">How It Works</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                step: '1',
                title: 'Sign Up',
                desc: 'Pick your name from the list or enter a new one, add your email, and wait for George to approve your account.',
              },
              {
                step: '2',
                title: 'Predict',
                desc: 'Before each gameweek deadline, submit your score predictions for every Premier League match.',
              },
              {
                step: '3',
                title: 'Win',
                desc: 'Earn points for correct results and exact scores. Top of the table at the end of the season wins the prize.',
              },
            ].map(({ step, title, desc }) => (
              <div
                key={step}
                className="rounded-2xl border border-slate-700 bg-slate-900 p-6 space-y-3"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <span className="text-purple-400 font-extrabold text-lg">{step}</span>
                </div>
                <h3 className="text-white font-semibold text-lg">{title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ───────────────────────────────────────────────────── */}
      <section className="px-4 py-16 text-center">
        <div className="max-w-lg mx-auto space-y-6">
          <h2 className="text-3xl font-bold text-white">Ready to compete?</h2>
          <p className="text-slate-400 text-lg">Join the group and prove you know football.</p>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-2xl bg-purple-600 hover:bg-purple-500 px-10 py-5 text-white font-bold text-xl shadow-lg shadow-purple-500/30 transition-all focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-slate-950"
          >
            Join the Competition
          </Link>
        </div>
      </section>
    </div>
  )
}
