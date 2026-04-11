'use client'

import { useState, useEffect } from 'react'
import { Lock } from 'lucide-react'
import type { FixtureWithTeams } from '@/lib/supabase/types'
import { formatKickoffTime, formatKickoffDate, isToday } from '@/lib/fixtures/timezone'
import TeamBadge from '@/components/fixtures/team-badge'

interface FixtureCardProps {
  fixture: FixtureWithTeams
  showCountdown?: boolean
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
export default function FixtureCard({ fixture, showCountdown: showCountdownProp = false }: FixtureCardProps) {
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

  const isLocked = isScheduled && pastKickoff
  const isGrey = isLocked || isLive || isFinished || isPostponed || isCancelled

  // ─── Card border / background ────────────────────────────────────────────────

  let cardClasses = 'rounded-xl border p-4 transition-colors '
  if (isLive) {
    cardClasses += 'border-red-500/50 bg-slate-800/80 '
  } else if (withinWarningWindow) {
    cardClasses += 'border-l-4 border-l-amber-500 border-slate-700 bg-slate-800/80 '
  } else if (isGrey) {
    cardClasses += 'border-slate-700/50 bg-slate-800/50 '
  } else {
    cardClasses += 'border-slate-700 bg-slate-800 '
  }

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

  return (
    <div className={cardClasses}>
      {/* Rescheduled badge */}
      {fixture.is_rescheduled && (
        <div className="mb-2 flex justify-end">
          <span className="px-2 py-0.5 rounded-full bg-blue-600/80 text-white text-xs font-semibold">
            Rescheduled
          </span>
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

      {/* Phase 3 prediction area placeholder */}
      <div className="mt-3 prediction-area" data-fixture-id={fixture.id} />
    </div>
  )
}
