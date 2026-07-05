'use client'

import { useState, useEffect, type CSSProperties } from 'react'
import { Lock, Star, Shield } from 'lucide-react'
import type { FixtureWithTeams } from '@/lib/supabase/types'
import { formatKickoffTime, formatKickoffDate, isToday } from '@/lib/fixtures/timezone'
import TeamBadge from '@/components/fixtures/team-badge'
import PredictionInputs from '@/components/predictions/prediction-inputs'

interface ScoreBreakdown {
  predicted_home: number
  predicted_away: number
  actual_home: number
  actual_away: number
  result_correct: boolean
  score_correct: boolean
  points_awarded: number
}

interface FixtureCardProps {
  fixture: FixtureWithTeams
  showCountdown?: boolean
  prediction?: { home_score: number | null; away_score: number | null } | null
  onScoreChange?: (fixtureId: string, home: number | null, away: number | null) => void
  isLocked?: boolean          // Override: when true, fixture is past kickoff
  hasSubmitted?: boolean      // This specific fixture has a saved prediction
  scoreBreakdown?: ScoreBreakdown | null
  isBonusPick?: boolean                                // This fixture is the selected bonus fixture
  onBonusToggle?: (fixtureId: string) => void         // Callback when star is tapped
  bonusActive?: boolean                               // Whether a bonus is active this GW
  isGoldenGlory?: boolean                             // Golden Glory visual treatment
  // ─── Last One Standing (LOS) per-fixture pick ──────────────────────────────
  losEligible?: boolean                               // Member is in LOS and can pick this GW
  losSelectedTeamId?: string | null                   // The team this member has picked this GW
  losAvailableTeamIds?: Set<string> | null            // Teams still pickable this cycle (null = all)
  onLosSelect?: (teamId: string) => void              // Callback when a home/away shield is tapped
}

/**
 * Single fixture display card with visual lockout states.
 *
 * States:
 *   - Normal (SCHEDULED/TIMED, future): white card
 *   - Closing soon (within 30min of kickoff): amber left border
 *   - Countdown (today + showCountdown=true): live countdown timer
 *   - Locked (kickoff passed, not in play): greyed + lock icon
 *   - LIVE / PAUSED: pulsing red dot + "LIVE" badge
 *   - FINISHED: final score + "FT" badge, greyed
 *   - POSTPONED / SUSPENDED / CANCELLED / AWARDED: status badge, greyed
 *
 * No prediction inputs — Phase 3 will populate the prediction area.
 */
export default function FixtureCard({
  fixture,
  showCountdown: showCountdownProp = false,
  prediction = null,
  onScoreChange,
  isLocked: isLockedProp,
  hasSubmitted = false,
  scoreBreakdown = null,
  isBonusPick = false,
  onBonusToggle,
  bonusActive = false,
  isGoldenGlory = false,
  losEligible = false,
  losSelectedTeamId = null,
  losAvailableTeamIds = null,
  onLosSelect,
}: FixtureCardProps) {
  const [now, setNow] = useState<Date>(() => new Date())

  const kickoff = new Date(fixture.kickoff_time)
  const fixtureIsToday = isToday(fixture.kickoff_time)
  const shouldShowCountdown = showCountdownProp && fixtureIsToday

  // Refresh every second only when countdown is visible
  useEffect(() => {
    if (!shouldShowCountdown) return
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [shouldShowCountdown])

  // ─── Derive visual state ─────────────────────────────────────────────────────

  const status = fixture.status
  const isLive = status === 'IN_PLAY' || status === 'PAUSED'
  const isFinished = status === 'FINISHED'
  const isPostponed = status === 'POSTPONED' || status === 'SUSPENDED'
  const isCancelled = status === 'CANCELLED' || status === 'AWARDED'
  const isScheduled = status === 'SCHEDULED' || status === 'TIMED'

  const pastKickoff = now >= kickoff
  const msToKickoff = kickoff.getTime() - now.getTime()
  const withinWarningWindow = isScheduled && !pastKickoff && msToKickoff <= 30 * 60 * 1000

  // isLocked from prop takes precedence; fallback to internal calculation
  const isLocked = isLockedProp !== undefined ? isLockedProp : (isScheduled && pastKickoff)
  const isGrey = isLocked || isLive || isFinished || isPostponed || isCancelled

  // ─── Card border / background ────────────────────────────────────────────────

  let cardClasses = 'rounded-xl border p-4 transition-colors '
  if (isLive) {
    cardClasses += 'border-red-500/50 bg-slate-800/80 '
  } else if (isBonusPick && isGoldenGlory) {
    cardClasses += 'border-l-4 border-l-yellow-400 border-yellow-400/50 bg-slate-800/80 '
  } else if (isBonusPick) {
    cardClasses += 'border-l-4 border-l-amber-500 border-amber-500/50 bg-slate-800/80 '
  } else if (withinWarningWindow) {
    cardClasses += 'border-l-4 border-l-amber-500 border-slate-700 bg-slate-800/80 '
  } else if (isGrey) {
    cardClasses += 'border-slate-700/50 bg-slate-800/50 '
  } else {
    cardClasses += 'border-slate-700 bg-slate-800 '
  }

  // ─── Home-team primary-colour left accent (Phase 11 Plan 01) ─────────────────
  // Applied only when no other left-border accent is already active so bonus /
  // warning / live states retain their dedicated colour semantics. Falls back
  // to transparent when the home team has no seeded primary_color.
  const homePrimaryColor = fixture.home_team.primary_color ?? null
  const hasDedicatedLeftAccent = isBonusPick || withinWarningWindow
  const cardStyle: CSSProperties =
    !hasDedicatedLeftAccent && homePrimaryColor
      ? { borderLeft: `4px solid ${homePrimaryColor}` }
      : !hasDedicatedLeftAccent
        ? { borderLeft: '4px solid transparent' }
        : {}

  // ─── Countdown formatting ────────────────────────────────────────────────────

  function formatCountdown(): string {
    if (msToKickoff <= 0) return '0:00'
    const totalSecs = Math.floor(msToKickoff / 1000)
    const mins = Math.floor(totalSecs / 60)
    const secs = totalSecs % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // ─── Score / time area ───────────────────────────────────────────────────────

  function renderCentreArea() {
    if (isFinished) {
      return (
        <div className="flex flex-col items-center">
          <div className="text-xl font-bold text-white">
            {fixture.home_score ?? 0} &ndash; {fixture.away_score ?? 0}
          </div>
          <span className="mt-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-600 text-slate-300">
            FT
          </span>
        </div>
      )
    }

    if (isLive) {
      return (
        <div className="flex flex-col items-center gap-1">
          {(fixture.home_score !== null && fixture.away_score !== null) && (
            <div className="text-xl font-bold text-white">
              {fixture.home_score} &ndash; {fixture.away_score}
            </div>
          )}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600/90 text-white text-xs font-bold animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-white" />
            LIVE
          </span>
        </div>
      )
    }

    if (isPostponed) {
      return (
        <div className="flex flex-col items-center">
          <span className="px-2 py-0.5 rounded-full bg-orange-600/80 text-white text-xs font-semibold">
            Postponed
          </span>
        </div>
      )
    }

    if (isCancelled) {
      return (
        <div className="flex flex-col items-center">
          <span className="px-2 py-0.5 rounded-full bg-slate-600 text-slate-300 text-xs font-semibold capitalize">
            {status.charAt(0) + status.slice(1).toLowerCase()}
          </span>
        </div>
      )
    }

    // SCHEDULED / TIMED — show time
    return (
      <div className="flex flex-col items-center gap-0.5">
        <div className={`flex items-center gap-1 ${isLocked ? 'text-slate-500' : 'text-slate-200'}`}>
          {isLocked && <Lock className="w-3.5 h-3.5 text-slate-500" />}
          <span className="font-semibold text-sm">{formatKickoffTime(fixture.kickoff_time)}</span>
        </div>
        <span className="text-xs text-slate-500">{formatKickoffDate(fixture.kickoff_time)}</span>
        {withinWarningWindow && (
          <span className="text-xs font-semibold text-amber-400 mt-0.5">Closing soon</span>
        )}
        {shouldShowCountdown && !pastKickoff && (
          <span className="text-xs font-mono text-slate-400">{formatCountdown()}</span>
        )}
      </div>
    )
  }

  // ─── Bonus star visibility ────────────────────────────────────────────────────
  // Show star only when bonus is active, a toggle callback exists, and fixture is
  // not in a terminal/locked state (no point picking a kicked-off fixture as bonus)
  const isTerminal = isFinished || isPostponed || isCancelled || isLocked || isLive
  const showBonusStar = bonusActive && !!onBonusToggle && !isTerminal

  // ─── LOS home/away selector state ─────────────────────────────────────────────
  // Show two shields (home / away) so the member can back a team to win this GW.
  // A team already used earlier in the cycle is not in losAvailableTeamIds and
  // renders disabled. The currently-selected team is always allowed.
  const showLosSelector = losEligible && !!onLosSelect && !isTerminal
  const homeLosSelected = losSelectedTeamId === fixture.home_team_id
  const awayLosSelected = losSelectedTeamId === fixture.away_team_id
  const homeLosAvailable =
    !losAvailableTeamIds || losAvailableTeamIds.has(fixture.home_team_id) || homeLosSelected
  const awayLosAvailable =
    !losAvailableTeamIds || losAvailableTeamIds.has(fixture.away_team_id) || awayLosSelected

  return (
    <div className={cardClasses} style={cardStyle}>
      {/* Top badges row: Rescheduled + bonus star */}
      {(fixture.is_rescheduled || showBonusStar) && (
        <div className="mb-2 flex justify-between items-center">
          {fixture.is_rescheduled ? (
            <span className="px-2 py-0.5 rounded-full bg-blue-600/80 text-white text-xs font-semibold">
              Rescheduled
            </span>
          ) : (
            <span />
          )}

          {/* Bonus star button */}
          {showBonusStar && (
            <button
              type="button"
              onClick={() => onBonusToggle!(fixture.id)}
              aria-label={isBonusPick ? 'Remove bonus pick' : 'Set as bonus fixture'}
              className="p-2 rounded-lg transition-colors hover:bg-slate-700/60 active:bg-slate-700"
              style={{ minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {isBonusPick ? (
                <Star
                  className={`w-5 h-5 fill-current ${isGoldenGlory ? 'text-yellow-400' : 'text-amber-400'}`}
                />
              ) : (
                <Star className="w-5 h-5 text-slate-500" />
              )}
            </button>
          )}
        </div>
      )}

      {/* Main row: home — score/time — away */}
      <div className="flex items-center justify-between gap-2">
        {/* Home team */}
        <div className={`flex-1 flex flex-col items-start ${isGrey ? 'opacity-50' : ''}`}>
          <TeamBadge team={fixture.home_team} size="md" />
        </div>

        {/* Centre area */}
        <div className="flex-shrink-0 w-28 flex justify-center">
          {renderCentreArea()}
        </div>

        {/* Away team */}
        <div className={`flex-1 flex flex-col items-end ${isGrey ? 'opacity-50' : ''}`}>
          <TeamBadge team={fixture.away_team} size="md" />
        </div>
      </div>

      {/* Last One Standing — pick the home or away team to survive this week */}
      {showLosSelector && (
        <div className="mt-3 rounded-lg border border-yellow-500/25 bg-yellow-950/20 px-3 py-2.5">
          <p className="text-[11px] font-semibold text-yellow-300/90 uppercase tracking-wide mb-2 flex items-center gap-1">
            <Shield className="w-3.5 h-3.5" />
            Last One Standing — back a team to win
          </p>
          <div className="grid grid-cols-2 gap-2">
            <LosSideButton
              label={fixture.home_team.short_name ?? fixture.home_team.name}
              sideLabel="Home"
              selected={homeLosSelected}
              available={homeLosAvailable}
              onClick={() => onLosSelect!(fixture.home_team_id)}
            />
            <LosSideButton
              label={fixture.away_team.short_name ?? fixture.away_team.name}
              sideLabel="Away"
              selected={awayLosSelected}
              available={awayLosAvailable}
              onClick={() => onLosSelect!(fixture.away_team_id)}
            />
          </div>
        </div>
      )}

      {/* Prediction area — populated when inside PredictionForm context */}
      <div className="mt-3 prediction-area" data-fixture-id={fixture.id}>
        {onScoreChange ? (
          <PredictionInputs
            fixtureId={fixture.id}
            homeScore={prediction?.home_score ?? null}
            awayScore={prediction?.away_score ?? null}
            onChange={onScoreChange}
            disabled={isLocked}
            hasSubmitted={hasSubmitted}
          />
        ) : null}

        {/* Bonus pick badge — shown when this fixture is the active bonus pick */}
        {isBonusPick && (
          <div className={`mt-2 rounded-lg px-3 py-2 text-center ${
            isGoldenGlory
              ? 'bg-gradient-to-r from-yellow-900/60 to-amber-900/60 border border-yellow-500/50'
              : 'bg-amber-900/40 border border-amber-600/50'
          }`}>
            {isGoldenGlory ? (
              <>
                <p className="text-xs font-bold text-yellow-300 uppercase tracking-wide">Golden Glory Bonus</p>
                <p className="text-xs text-yellow-400/80 mt-0.5">20pts correct result · 60pts exact score!</p>
              </>
            ) : (
              <p className="text-xs font-semibold text-amber-300 uppercase tracking-wide">Bonus Fixture</p>
            )}
          </div>
        )}

        {/* Score breakdown — shown only when scoreBreakdown is provided (finished fixture with result) */}
        {scoreBreakdown ? (
          <div className="mt-2 rounded-lg bg-slate-900/60 border border-slate-700/50 px-3 py-2 space-y-1.5">
            <p className="text-xs text-slate-400 text-center">
              Predicted{' '}
              <span className="text-slate-200 font-medium">
                {scoreBreakdown.predicted_home}–{scoreBreakdown.predicted_away}
              </span>
              {' '}| Actual{' '}
              <span className="text-slate-200 font-medium">
                {scoreBreakdown.actual_home}–{scoreBreakdown.actual_away}
              </span>
            </p>
            <div className="flex justify-center">
              {scoreBreakdown.score_correct ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-700/80 text-green-100">
                  Correct Score = 30pts
                </span>
              ) : scoreBreakdown.result_correct ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-700/80 text-amber-100">
                  Correct Result = 10pts
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-600/80 text-slate-300">
                  Wrong = 0pts
                </span>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ─── LOS side button ───────────────────────────────────────────────────────────
// One of the two (home / away) shield buttons for a fixture's LOS pick.
// Disabled + struck through when the team was already used earlier this cycle.
function LosSideButton({
  label,
  sideLabel,
  selected,
  available,
  onClick,
}: {
  label: string
  sideLabel: string
  selected: boolean
  available: boolean
  onClick: () => void
}) {
  const disabled = !available && !selected
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={
        disabled
          ? `${label} already used this cycle`
          : selected
            ? `Remove Last One Standing pick ${label}`
            : `Pick ${label} for Last One Standing`
      }
      className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium transition-colors ${
        selected
          ? 'bg-yellow-500 text-slate-900 border border-yellow-400'
          : disabled
            ? 'bg-slate-800/60 text-slate-600 border border-slate-700/50 line-through cursor-not-allowed'
            : 'bg-slate-800 text-slate-200 border border-slate-600 hover:border-yellow-500/60 hover:bg-slate-700/60'
      }`}
      style={{ minHeight: 44 }}
    >
      <Shield
        className={`w-4 h-4 flex-shrink-0 ${selected ? 'fill-slate-900/20' : ''}`}
      />
      <span className="flex flex-col items-start leading-tight min-w-0">
        <span className="text-[10px] uppercase tracking-wide opacity-70">{sideLabel}</span>
        <span className="truncate max-w-[7rem]">{label}</span>
      </span>
    </button>
  )
}
