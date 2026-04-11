import type { FixtureWithTeams, GameweekRow } from '@/lib/supabase/types'
import { isMidweekFixture, isToday } from '@/lib/fixtures/timezone'
import FixtureCard from '@/components/fixtures/fixture-card'

interface GameweekViewProps {
  fixtures: FixtureWithTeams[]
  gameweek: GameweekRow
}

/**
 * Renders all fixtures for a given gameweek, grouped into midweek/weekend sections.
 * If all fixtures fall in the same group, the section header is omitted.
 */
export default function GameweekView({ fixtures, gameweek }: GameweekViewProps) {
  if (fixtures.length === 0) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-8 text-center">
        <p className="text-slate-400">No fixtures loaded for this gameweek.</p>
      </div>
    )
  }

  // Sort by kickoff ascending
  const sorted = [...fixtures].sort(
    (a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime()
  )

  const midweek = sorted.filter((f) => isMidweekFixture(f.kickoff_time))
  const weekend = sorted.filter((f) => !isMidweekFixture(f.kickoff_time))

  const hasBothGroups = midweek.length > 0 && weekend.length > 0

  return (
    <div className="space-y-6">
      {/* Gameweek header with optional "Complete" badge */}
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-bold text-white">Gameweek {gameweek.number}</h2>
        {gameweek.status === 'complete' && (
          <span className="px-2.5 py-0.5 rounded-full bg-green-600/90 text-white text-xs font-semibold">
            Complete
          </span>
        )}
        {gameweek.status === 'active' && (
          <span className="px-2.5 py-0.5 rounded-full bg-purple-600/90 text-white text-xs font-semibold">
            Active
          </span>
        )}
      </div>

      {/* Midweek section */}
      {midweek.length > 0 && (
        <div className="space-y-3">
          {hasBothGroups && (
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide px-1">
              Midweek
            </h3>
          )}
          <div className="space-y-2">
            {midweek.map((fixture) => (
              <FixtureCard
                key={fixture.id}
                fixture={fixture}
                showCountdown={isToday(fixture.kickoff_time)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Weekend section */}
      {weekend.length > 0 && (
        <div className="space-y-3">
          {hasBothGroups && (
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide px-1">
              Weekend
            </h3>
          )}
          <div className="space-y-2">
            {weekend.map((fixture) => (
              <FixtureCard
                key={fixture.id}
                fixture={fixture}
                showCountdown={isToday(fixture.kickoff_time)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
