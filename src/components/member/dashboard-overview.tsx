import type { MemberRow } from '@/lib/supabase/types'

interface DashboardOverviewProps {
  member: MemberRow
}

/**
 * Dashboard for approved members.
 * Shows rank card, upcoming fixtures, recent results, and deadline info.
 * Per CONTEXT.md: "Not just a league table, not just fixtures — a balanced overview."
 * Phase 2+ will populate fixtures/results from real data.
 */
export default function DashboardOverview({ member }: DashboardOverviewProps) {
  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Welcome back, {member.display_name}
        </h1>
        <p className="text-slate-400 mt-1">Here&apos;s your competition overview.</p>
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
                ? 'Starting points (full table coming in Phase 4)'
                : 'Season not started yet'}
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
              Prediction deadlines will appear here once fixtures are loaded.
            </p>
          </div>
        </div>

        {/* This Week's Fixtures card */}
        <div className="rounded-2xl bg-slate-800 border border-slate-700 p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide">
              This Week&apos;s Fixtures
            </h2>
            <svg
              className="w-5 h-5 text-green-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div>
            <p className="text-slate-400 text-sm">
              Fixtures will appear here once the season begins.
            </p>
          </div>
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
              Results will appear here as fixtures complete.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
