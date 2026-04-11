import type { FixtureWithTeams, GameweekRow } from '@/lib/supabase/types'
import { isMidweekFixture, isToday } from '@/lib/fixtures/timezone'
import FixtureCard from '@/components/fixtures/fixture-card'

interface ScoreBreakdown {
  predicted_home: number
  predicted_away: number
  actual_home: number
  actual_away: number
  result_correct: boolean
  score_correct: boolean
  points_awarded: number
}

interface GameweekViewProps {
  fixtures: FixtureWithTeams[]
  gameweek: GameweekRow
  predictions?: Record<string, { home_score: number | null; away_score: number | null }>
  onScoreChange?: (fixtureId: string, home: number | null, away: number | null) => void
  submittedFixtureIds?: Set<string>   // fixtures that have saved predictions
  scoreBreakdowns?: Record<string, ScoreBreakdown>
  bonusFixtureId?: string | null
  onBonusToggle?: (fixtureId: string) => void
  bonusActive?: boolean
  isGoldenGlory?: boolean
}

/**
 * Renders all fixtures for a given gameweek, grouped into midweek/weekend sections.
 * If all fixtures fall in the same group, the section header is omitted.
 *
 * When predictions + onScoreChange are provided (inside PredictionForm context),
 * each FixtureCard receives its prediction data and the score-change callback.
 */
export default function GameweekView({
  fixtures,
  gameweek,
  predictions,
  onScoreChange,
  submittedFixtureIds,
  scoreBreakdowns,
  bonusFixtureId,
  onBonusToggle,
  bonusActive,
  isGoldenGlory,
}: GameweekViewProps) {
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
            {midweek.map((fixture) => {
              const isPastKickoff = new Date() >= new Date(fixture.kickoff_time)
              return (
                <FixtureCard
                  key={fixture.id}
                  fixture={fixture}
                  showCountdown={isToday(fixture.kickoff_time)}
                  prediction={predictions?.[fixture.id] ?? null}
                  onScoreChange={onScoreChange}
                  isLocked={onScoreChange ? isPastKickoff : undefined}
                  hasSubmitted={submittedFixtureIds?.has(fixture.id) ?? false}
                  scoreBreakdown={scoreBreakdowns?.[fixture.id] ?? null}
                  isBonusPick={bonusFixtureId === fixture.id}
                  onBonusToggle={onBonusToggle}
                  bonusActive={bonusActive}
                  isGoldenGlory={isGoldenGlory}
                />
              )
            })}
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
            {weekend.map((fixture) => {
              const isPastKickoff = new Date() >= new Date(fixture.kickoff_time)
              return (
                <FixtureCard
                  key={fixture.id}
                  fixture={fixture}
                  showCountdown={isToday(fixture.kickoff_time)}
                  prediction={predictions?.[fixture.id] ?? null}
                  onScoreChange={onScoreChange}
                  isLocked={onScoreChange ? isPastKickoff : undefined}
                  hasSubmitted={submittedFixtureIds?.has(fixture.id) ?? false}
                  scoreBreakdown={scoreBreakdowns?.[fixture.id] ?? null}
                  isBonusPick={bonusFixtureId === fixture.id}
                  onBonusToggle={onBonusToggle}
                  bonusActive={bonusActive}
                  isGoldenGlory={isGoldenGlory}
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
