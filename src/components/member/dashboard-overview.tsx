import Link from 'next/link'
import type { MemberRow, GameweekRow, FixtureWithTeams } from '@/lib/supabase/types'
import { formatKickoffTime, formatKickoffDate } from '@/lib/fixtures/timezone'
import TeamBadge from '@/components/fixtures/team-badge'

interface DashboardOverviewProps {
  member: MemberRow
  currentGameweek?: GameweekRow
  upcomingFixtures?: FixtureWithTeams[]
}

/**
 * Dashboard for approved members.
 * Shows rank card, upcoming fixtures, recent results, and deadline info.
 * Per CONTEXT.md: "Not just a league table, not just fixtures — a balanced overview."
 */
export default function DashboardOverview({
  member,
  currentGameweek,
  upcomingFixtures,
}: DashboardOverviewProps) {
  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Welcome back, {member.display_name}
        </h1>
        <p className="text-slate-400 mt-1">Your competition overview at a glance.</p>
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Your Rank card */}
        <div className="rounded-2xl bg-slate-800 border border-slate-700 p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide">
              Your Rank
            </h2>
            <svg
              className="w-5 h-5 text-purple-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div>
            <p className="text-4xl font-bold text-white">
              {member.starting_points > 0 ? `${member.starting_points} pts` : '—'}
            </p>
            <p className="text-slate-500 text-sm mt-1">
              {member.starting_points > 0
                ? 'Points carried forward'
                : 'Awaiting season start'}
            </p>
          </div>
        </div>

        {/* Upcoming Deadline card */}
        <div className="rounded-2xl bg-slate-800 border border-slate-700 p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide">
              Upcoming Deadline
            </h2>
            <svg
              className="w-5 h-5 text-amber-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div>
            <p className="text-xl font-semibold text-slate-300">
              No upcoming deadlines
            </p>
            <p className="text-slate-500 text-sm mt-1">
              Deadlines will appear here once the season is underway.
            </p>
          </div>
        </div>
      </div>

      {/* Current Gameweek Fixtures section */}
      <div className="rounded-2xl bg-slate-800 border border-slate-700 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide">
              {currentGameweek ? `Gameweek ${currentGameweek.number}` : "This Week's Fixtures"}
            </h2>
            {currentGameweek?.status === 'complete' && (
              <span className="px-2 py-0.5 rounded-full bg-green-600/90 text-white text-xs font-semibold">
                Complete
              </span>
            )}
            {currentGameweek?.status === 'active' && (
              <span className="px-2 py-0.5 rounded-full bg-purple-600/90 text-white text-xs font-semibold">
                Active
              </span>
            )}
          </div>
          {currentGameweek && (
            <Link
              href={`/gameweeks/${currentGameweek.number}`}
              className="text-sm text-purple-400 hover:text-purple-300 transition font-medium"
            >
              View all
            </Link>
          )}
        </div>

        {/* Fixtures list */}
        {currentGameweek && upcomingFixtures && upcomingFixtures.length > 0 ? (
          <div className="space-y-2">
            {upcomingFixtures.map((fixture) => (
              <div
                key={fixture.id}
                className="flex items-center justify-between gap-2 py-2 border-b border-slate-700/50 last:border-0"
              >
                {/* Home team */}
                <div className="flex-1 flex justify-end">
                  <TeamBadge team={fixture.home_team} size="sm" />
                </div>

                {/* Kickoff info */}
                <div className="flex flex-col items-center flex-shrink-0 w-32">
                  <span className="text-sm font-semibold text-slate-200">
                    {formatKickoffTime(fixture.kickoff_time)}
                  </span>
                  <span className="text-xs text-slate-500">
                    {formatKickoffDate(fixture.kickoff_time)}
                  </span>
                </div>

                {/* Away team */}
                <div className="flex-1 flex justify-start">
                  <TeamBadge team={fixture.away_team} size="sm" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-400 text-sm">
            {currentGameweek
              ? 'No upcoming fixtures this gameweek.'
              : 'Fixtures not loaded yet — check back once George syncs the fixture list.'}
          </p>
        )}

        {currentGameweek && (
          <Link
            href={`/gameweeks/${currentGameweek.number}`}
            className="inline-block text-sm text-purple-400 hover:text-purple-300 transition"
          >
            View all fixtures for Gameweek {currentGameweek.number} &rarr;
          </Link>
        )}
      </div>

      {/* Recent Results card */}
      <div className="rounded-2xl bg-slate-800 border border-slate-700 p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide">
            Recent Results
          </h2>
          <svg
            className="w-5 h-5 text-blue-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
        </div>
        <div>
          <p className="text-slate-400 text-sm">
            Match results and your scores will appear here.
          </p>
        </div>
      </div>
    </div>
  )
}
