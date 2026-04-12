/**
 * Read-only view of a member's pre-season picks for the current season.
 * Shown after GW1 kickoff — submissions are locked.
 */

import { Lock } from 'lucide-react'
import TeamBadge from '@/components/fixtures/team-badge'
import type { PreSeasonPickRow, SeasonRow, TeamRow } from '@/lib/supabase/types'

interface PreSeasonReadOnlyProps {
  season: SeasonRow
  picks: PreSeasonPickRow | null
  plTeams: TeamRow[]
}

function normalize(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase()
}

function TeamDisplay({ name, plTeams }: { name: string; plTeams: TeamRow[] }) {
  const match = plTeams.find((t) => normalize(t.name) === normalize(name))
  if (match) {
    return <TeamBadge team={match} size="sm" />
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-slate-200">
      {/* Championship fallback — no crest */}
      <span className="w-5 h-5 rounded-full bg-slate-600 text-white text-[10px] font-bold inline-flex items-center justify-center flex-shrink-0">
        {name.slice(0, 3).toUpperCase()}
      </span>
      {name}
    </span>
  )
}

function Section({
  title,
  names,
  plTeams,
}: {
  title: string
  names: string[]
  plTeams: TeamRow[]
}) {
  if (names.length === 0) return null
  return (
    <section>
      <h3 className="text-sm font-semibold text-slate-200 mb-2">{title}</h3>
      <ul className="space-y-1.5">
        {names.map((name, i) => (
          <li key={`${name}-${i}`} className="rounded-lg bg-slate-800/60 px-3 py-2">
            <TeamDisplay name={name} plTeams={plTeams} />
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function PreSeasonReadOnly({
  season,
  picks,
  plTeams,
}: PreSeasonReadOnlyProps) {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-white">
          Pre-Season Predictions — {season.label}
        </h1>
        <div className="flex items-start gap-2 rounded-lg border border-slate-700 bg-slate-800/50 p-3 text-sm text-slate-300">
          <Lock className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-slate-200">Locked since GW1 kickoff</p>
            <p className="text-slate-400 text-xs mt-0.5">
              Predictions are fixed until the end of the season, when George confirms the awards.
            </p>
          </div>
        </div>
      </header>

      {!picks ? (
        <div className="rounded-xl border border-amber-700/50 bg-amber-900/20 p-6 text-center">
          <p className="text-amber-200 text-sm">
            No pre-season picks on record for {season.label}.
          </p>
          <p className="text-amber-300/70 text-xs mt-2">
            If you joined after GW1 kickoff, contact George to enter picks on your behalf.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <Section title="Top 4 finishers" names={picks.top4 ?? []} plTeams={plTeams} />
          <Section
            title="10th place"
            names={picks.tenth_place ? [picks.tenth_place] : []}
            plTeams={plTeams}
          />
          <Section title="Relegated" names={picks.relegated ?? []} plTeams={plTeams} />
          <Section
            title="Promoted from Championship"
            names={picks.promoted ?? []}
            plTeams={plTeams}
          />
          <Section
            title="Championship playoff winner"
            names={
              picks.promoted_playoff_winner ? [picks.promoted_playoff_winner] : []
            }
            plTeams={plTeams}
          />
        </div>
      )}
    </div>
  )
}
