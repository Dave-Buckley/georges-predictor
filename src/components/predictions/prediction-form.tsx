'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Users, AlertTriangle, CheckCircle2, XCircle, Loader2, Lock, Star, Zap, Trophy } from 'lucide-react'
import type { FixtureWithTeams, GameweekRow, GameweekStatus } from '@/lib/supabase/types'
import { submitPredictions } from '@/actions/predictions'
import { computeDisplayTotal } from '@/lib/scoring/calculate-bonus'
import GameweekNav from '@/components/fixtures/gameweek-nav'
import GameweekView from '@/components/fixtures/gameweek-view'
import LosTeamPicker, { type LosTeamOption } from '@/components/los/los-team-picker'
import { WhatsAppCopyButton } from '@/components/predictions/whatsapp-copy-button'

interface ScoreBreakdown {
  predicted_home: number
  predicted_away: number
  actual_home: number
  actual_away: number
  result_correct: boolean
  score_correct: boolean
  points_awarded: number
}

interface PredictionFormProps {
  fixtures: FixtureWithTeams[]
  gameweek: GameweekRow
  existingPredictions: Record<string, { home_score: number; away_score: number }>
  submissionCount: { submitted: number; total: number }
  navGameweeks: Array<{ number: number; status: GameweekStatus }>
  currentGw: number
  totalGw: number
  scoreBreakdowns?: Record<string, ScoreBreakdown>
  totalPoints?: number
  scoredFixtureCount?: number
  activeBonusType?: { id: string; name: string; description: string } | null
  existingBonusPick?: string | null
  bonusAwardDisplay?: { points_awarded: number; awarded: boolean | null; fixture_id: string | null } | null
  losContext?: {
    activeCompetition: { id: string; status: string } | null
    memberStatus: 'active' | 'eliminated' | null
    availableTeams: LosTeamOption[]
    currentPickTeamId: string | null
  } | null
  memberDisplayName?: string
  isLocked?: boolean
}

type FeedbackState = {
  type: 'success' | 'error'
  message: string
} | null

/**
 * Client-side wrapper managing all prediction state for a gameweek.
 *
 * - Initialises local scores from existingPredictions (server-fetched saved data)
 * - Tracks changes in local state (no auto-save — locked decision)
 * - On submit: collects filled/unlocked entries → calls submitPredictions server action
 * - Shows submission counter bar, late-kickoff warning, success/error feedback
 * - Submit button sticks to bottom of viewport on mobile
 */
export default function PredictionForm({
  fixtures,
  gameweek,
  existingPredictions,
  submissionCount,
  navGameweeks,
  currentGw,
  totalGw,
  scoreBreakdowns,
  totalPoints = 0,
  scoredFixtureCount = 0,
  activeBonusType = null,
  existingBonusPick = null,
  bonusAwardDisplay = null,
  losContext = null,
  memberDisplayName = '',
  isLocked = false,
}: PredictionFormProps) {
  const losActive = !!losContext?.activeCompetition
  const losEligible = losActive && losContext?.memberStatus === 'active'
  const losEliminated = losActive && losContext?.memberStatus === 'eliminated'

  // ── Initialise local prediction state from server-provided saved scores ──────
  const [predictions, setPredictions] = useState<
    Record<string, { home_score: number | null; away_score: number | null }>
  >(() => {
    const init: Record<string, { home_score: number | null; away_score: number | null }> = {}
    for (const fixture of fixtures) {
      const saved = existingPredictions[fixture.id]
      init[fixture.id] = saved
        ? { home_score: saved.home_score, away_score: saved.away_score }
        : { home_score: null, away_score: null }
    }
    return init
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<{ saved: number; skipped: number } | null>(null)
  const [feedback, setFeedback] = useState<FeedbackState>(null)

  // The inline feedback block lives near the top of the page. When the user is
  // scrolled down at the sticky Update Predictions button and a validation
  // error fires, the error banner ends up off-screen and it looks like
  // nothing happened. Scroll the banner into view on every feedback change
  // so the error is always visible right after the click.
  const feedbackRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (feedback && feedbackRef.current) {
      feedbackRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [feedback])

  // When an LOS competition is active and a member taps "Update Predictions"
  // to re-submit, remind them to double-check the LOS pick — the most common
  // bug is forgetting to refresh a stale pick. Shown once per submit attempt.
  const [losReminderOpen, setLosReminderOpen] = useState(false)

  // Track whether the member has existing saved predictions (Submit vs Update button text)
  const [hasExistingPredictions, setHasExistingPredictions] = useState(
    Object.keys(existingPredictions).length > 0
  )

  // Track which fixture IDs are currently saved to the DB (for green-tint indicator)
  const [submittedFixtureIds, setSubmittedFixtureIds] = useState<Set<string>>(
    () => new Set(Object.keys(existingPredictions))
  )

  // ── Bonus pick state ────────────────────────────────────────────────────────
  const [bonusFixtureId, setBonusFixtureId] = useState<string | null>(existingBonusPick ?? null)

  // Double Bubble is a gameweek-wide doubler — members never pick a fixture for
  // it, so skip the star-on-each-card UX and the mandatory-pick guard below.
  const bonusRequiresFixture = !!activeBonusType && activeBonusType.name !== 'Double Bubble'

  // ── LOS pick state ──────────────────────────────────────────────────────────
  const [losTeamId, setLosTeamId] = useState<string | null>(losContext?.currentPickTeamId ?? null)

  // Auto-dismiss feedback banner after 5 seconds
  useEffect(() => {
    if (!feedback) return
    const timer = setTimeout(() => setFeedback(null), 5000)
    return () => clearTimeout(timer)
  }, [feedback])

  // ── Score change handler ────────────────────────────────────────────────────
  const handleScoreChange = useCallback(
    (fixtureId: string, home: number | null, away: number | null) => {
      setPredictions((prev) => ({
        ...prev,
        [fixtureId]: { home_score: home, away_score: away },
      }))
    },
    []
  )

  // ── Bonus toggle handler — tapping same fixture deselects ───────────────────
  const handleBonusToggle = useCallback((fixtureId: string) => {
    setBonusFixtureId((prev) => (prev === fixtureId ? null : fixtureId))
  }, [])

  // ── Save-before-lock callback for the WhatsApp button. Collects current
  // local picks and calls submitPredictions once so the lock never freezes
  // empty DB state. Mirrors handleSubmit but reports errors via return
  // value instead of feedback banner.
  async function saveCurrentPicks(): Promise<{ success: boolean; error?: string }> {
    const now = new Date()
    const validEntries: Array<{ fixture_id: string; home_score: number; away_score: number }> = []
    for (const fixture of fixtures) {
      const { home_score, away_score } = predictions[fixture.id] ?? {}
      if (home_score === null || home_score === undefined) continue
      if (away_score === null || away_score === undefined) continue
      if (new Date(fixture.kickoff_time) <= now) continue
      validEntries.push({ fixture_id: fixture.id, home_score, away_score })
    }

    // No picks in future fixtures + nothing in DB = nothing to save. That's
    // fine — the lock can still proceed (member may just be locking past
    // picks they submitted earlier).
    if (validEntries.length === 0 && !hasExistingPredictions) {
      return {
        success: false,
        error: 'No predictions saved. Fill in at least one score pair first.',
      }
    }

    if (bonusRequiresFixture && !bonusFixtureId && !hasExistingPredictions) {
      return {
        success: false,
        error: 'Pick your bonus fixture before locking — tap the star icon on a fixture card.',
      }
    }

    if (losEligible && !losTeamId && !hasExistingPredictions) {
      return {
        success: false,
        error: 'Pick your Last One Standing team before locking.',
      }
    }

    if (validEntries.length === 0) return { success: true } // nothing new to save

    try {
      const bonusToSend = bonusRequiresFixture ? bonusFixtureId : null
      const result = await submitPredictions(currentGw, validEntries, bonusToSend, losTeamId)
      if (result.error) return { success: false, error: result.error }
      setHasExistingPredictions(true)
      const newSubmitted = new Set(submittedFixtureIds)
      for (const entry of validEntries) newSubmitted.add(entry.fixture_id)
      setSubmittedFixtureIds(newSubmitted)
      return { success: true }
    } catch {
      return { success: false, error: 'Could not save predictions. Please try again.' }
    }
  }

  // ── Submit button tap handler ──────────────────────────────────────────────
  // When the member has already submitted this week AND an LOS competition
  // is active, pop a "double-check your LOS pick" reminder before actually
  // submitting. Only shows for updates, not first-time submits. On confirm,
  // handleSubmit runs the normal flow.
  function handleSubmitClick() {
    if (isLocked) {
      setFeedback({ type: 'error', message: 'Your predictions for this week are locked.' })
      return
    }
    if (hasExistingPredictions && losEligible) {
      setLosReminderOpen(true)
      return
    }
    void handleSubmit()
  }

  function handleLosReminderConfirm() {
    setLosReminderOpen(false)
    void handleSubmit()
  }

  // ── Submit handler ─────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (isLocked) {
      setFeedback({ type: 'error', message: 'Your predictions for this week are locked.' })
      return
    }
    // Collect entries where BOTH scores are filled and fixture hasn't kicked off
    const now = new Date()
    const validEntries: Array<{ fixture_id: string; home_score: number; away_score: number }> = []

    for (const fixture of fixtures) {
      const { home_score, away_score } = predictions[fixture.id] ?? {}
      if (home_score === null || home_score === undefined) continue
      if (away_score === null || away_score === undefined) continue
      // Client-side pre-filter — server still enforces via canSubmitPrediction
      if (new Date(fixture.kickoff_time) <= now) continue
      validEntries.push({ fixture_id: fixture.id, home_score, away_score })
    }

    if (validEntries.length === 0) {
      setFeedback({ type: 'error', message: 'No predictions to submit — fill in at least one score pair for an upcoming fixture.' })
      return
    }

    // ── Bonus pick validation ───────────────────────────────────────────────
    // Bonus is mandatory when active — block submission without a selection.
    // Double Bubble is the exception handled at component scope below.
    if (bonusRequiresFixture && !bonusFixtureId) {
      setFeedback({ type: 'error', message: 'Pick your bonus fixture before submitting — tap the star icon on a fixture card.' })
      return
    }

    // Client-side guard: bonus fixture must not have already kicked off
    if (bonusFixtureId) {
      const bonusFixture = fixtures.find((f) => f.id === bonusFixtureId)
      if (bonusFixture && new Date(bonusFixture.kickoff_time) <= now) {
        setFeedback({ type: 'error', message: 'Your bonus fixture has already kicked off. Pick a different fixture.' })
        return
      }
    }

    // LOS mandatory guard — block client-side when eligible + picker empty
    if (losEligible && !losTeamId) {
      setFeedback({ type: 'error', message: 'Pick your Last One Standing team before submitting.' })
      return
    }

    setIsSubmitting(true)
    setFeedback(null)

    try {
      // Double Bubble has no per-fixture pick — never send a bonusFixtureId
      const bonusToSend = bonusRequiresFixture ? bonusFixtureId : null
      const result = await submitPredictions(currentGw, validEntries, bonusToSend, losTeamId)

      if (result.error) {
        setFeedback({ type: 'error', message: result.error })
      } else {
        const skippedMsg = result.skipped > 0 ? ` (${result.skipped} skipped — already kicked off)` : ''
        const bonusMsg = result.bonusSaved ? ' Bonus pick saved.' : ''
        const losMsg = result.losSaved ? ' LOS pick saved.' : ''
        setFeedback({ type: 'success', message: `Saved ${result.saved} prediction${result.saved !== 1 ? 's' : ''}${skippedMsg}${bonusMsg}${losMsg}` })
        setSubmitResult({ saved: result.saved, skipped: result.skipped })
        setHasExistingPredictions(true)
        // Mark submitted fixtures as saved
        const newSubmitted = new Set(submittedFixtureIds)
        for (const entry of validEntries) {
          newSubmitted.add(entry.fixture_id)
        }
        setSubmittedFixtureIds(newSubmitted)
      }
    } catch {
      setFeedback({ type: 'error', message: 'Something went wrong. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Derived flags ──────────────────────────────────────────────────────────
  const now = new Date()
  const someKickedOff = fixtures.some(
    (f) => new Date(f.kickoff_time) <= now && (f.status === 'SCHEDULED' || f.status === 'TIMED')
  )
  const allKickedOff = fixtures.every((f) => new Date(f.kickoff_time) <= now)

  // ── Derived layout flags ───────────────────────────────────────────────────
  // Submit button only shows before every fixture kicks off. WhatsApp copy
  // button shows for the entire week so long as the week isn't locked —
  // tapping it with no picks returns a clear error via saveCurrentPicks
  // instead of hiding the whole affordance. Users kept missing the button
  // when it was gated on having typed scores, so this is intentionally wide.
  const hasExistingSubmitArea = !allKickedOff && !isLocked
  const whatsAppButtonVisible = !isLocked
  const stickyAreaVisible = hasExistingSubmitArea || whatsAppButtonVisible
  const totalBarBottom = !stickyAreaVisible
    ? 'bottom-0'
    : hasExistingSubmitArea && whatsAppButtonVisible
      ? 'bottom-[128px]'
      : 'bottom-[76px]'
  // Pad scrolling content to clear both fixed bars when both are visible.
  const contentPadding = scoredFixtureCount > 0
    ? (hasExistingSubmitArea && whatsAppButtonVisible
        ? 'pb-56'
        : stickyAreaVisible
          ? 'pb-44'
          : 'pb-36')
    : 'pb-24'

  // ── Derived bonus display values ───────────────────────────────────────────
  const isGoldenGlory = activeBonusType?.name === 'Golden Glory'
  const bonusFixture = bonusFixtureId ? fixtures.find((f) => f.id === bonusFixtureId) : null

  const bonusPoints = bonusAwardDisplay?.points_awarded ?? 0
  const bonusConfirmed = bonusAwardDisplay?.awarded === true
  const bonusPending = bonusAwardDisplay?.awarded === null && bonusPoints > 0
  const bonusRejected = bonusAwardDisplay?.awarded === false

  const { displayTotal, bonusIncluded } = computeDisplayTotal(
    totalPoints,
    bonusPoints,
    bonusConfirmed,
    gameweek.double_bubble,
  )

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={`space-y-4 ${contentPadding}`}>

      {/* 0. Top-of-page WhatsApp button — always visible so members can't
             miss it even if sticky bottom bar is hidden behind browser UI. */}
      {whatsAppButtonVisible && (
        <WhatsAppCopyButton
          gameweekNumber={currentGw}
          memberDisplayName={memberDisplayName}
          fixtures={fixtures}
          predictions={predictions}
          bonusName={activeBonusType?.name ?? null}
          bonusFixtureId={bonusRequiresFixture ? bonusFixtureId : null}
          losTeamName={
            losTeamId
              ? losContext?.availableTeams.find((t) => t.id === losTeamId)?.name ?? null
              : null
          }
          onBeforeLock={saveCurrentPicks}
        />
      )}

      {/* 1. Submission counter bar */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700/60 border border-slate-700">
        <Users className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <span className="text-sm text-slate-300">
          <span className="font-semibold text-white">{submissionCount.submitted}</span>
          {' of '}
          <span className="font-semibold text-white">{submissionCount.total}</span>
          {' '}member{submissionCount.total !== 1 ? 's' : ''} have submitted
        </span>
      </div>

      {/* 1b. Locked banner — member tapped "Copy to WhatsApp". Shown above
            everything else so the locked state is obvious as soon as the page
            loads. */}
      {isLocked && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-900/60 to-green-900/60 border border-emerald-500/50">
          <Lock className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-emerald-300">Predictions locked for GW{currentGw}</p>
            <p className="text-xs text-emerald-400/80 mt-0.5">
              You copied your picks to WhatsApp — they can&apos;t be changed this week
              unless George reopens them.
            </p>
          </div>
        </div>
      )}

      {/* 2. Double Bubble banner (when active) */}
      {gameweek.double_bubble && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-amber-900/60 to-orange-900/60 border border-amber-500/50">
          <Zap className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-300">DOUBLE BUBBLE WEEK</p>
            <p className="text-xs text-amber-400/80 mt-0.5">All confirmed points are doubled this gameweek!</p>
          </div>
        </div>
      )}

      {/* 3. Bonus banner (when a confirmed bonus is active)
            — hidden when the bonus IS Double Bubble; the gw-level banner above
              already communicates it, and there's no fixture pick to prompt. */}
      {activeBonusType && activeBonusType.name !== 'Double Bubble' && (
        <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${
          isGoldenGlory
            ? 'bg-gradient-to-r from-yellow-900/60 to-amber-900/60 border-yellow-500/50'
            : 'bg-gradient-to-r from-indigo-900/60 to-purple-900/60 border-indigo-500/50'
        }`}>
          <Star className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isGoldenGlory ? 'text-yellow-400 fill-yellow-400' : 'text-indigo-400'}`} />
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-bold ${isGoldenGlory ? 'text-yellow-300' : 'text-indigo-300'}`}>
              {activeBonusType.name}
            </p>
            <p className={`text-xs mt-0.5 ${isGoldenGlory ? 'text-yellow-400/80' : 'text-indigo-400/80'}`}>
              {isGoldenGlory ? '20pts for correct result · 60pts for exact score!' : activeBonusType.description}
            </p>
            {/* Bonus selection status */}
            {bonusFixture ? (
              <p className="text-xs text-green-400 mt-1 font-medium">
                Bonus applied to: {bonusFixture.home_team?.name ?? ''} vs {bonusFixture.away_team?.name ?? ''}
              </p>
            ) : (
              <p className="text-xs text-amber-400 mt-1">
                Tap the star on a fixture to pick your bonus
              </p>
            )}
          </div>
        </div>
      )}

      {/* 3b. LOS team picker or eliminated banner */}
      {losEligible && losContext && (
        <div className="rounded-xl border border-yellow-500/30 bg-gradient-to-br from-slate-800 to-slate-800/60 px-4 py-3">
          <LosTeamPicker
            availableTeams={losContext.availableTeams}
            value={losTeamId}
            onChange={setLosTeamId}
            required={true}
            disabled={isSubmitting}
          />
        </div>
      )}

      {losEliminated && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-slate-800/60 border border-slate-700">
          <Trophy className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-slate-300">
              You&apos;ve been eliminated from Last One Standing.
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              The next competition starts when a winner is found.
            </p>
          </div>
        </div>
      )}

      {/* 4. Gameweek navigation */}
      <GameweekNav
        currentGw={currentGw}
        totalGw={totalGw}
        gameweeks={navGameweeks}
      />

      {/* 5. Fixture list with prediction inputs.
            — bonusActive is false when the bonus is Double Bubble, which hides
              the star toggles on each fixture card (no pick to make).
            — allLocked forces every fixture card into read-only / locked mode
              once the member has pressed Copy-to-WhatsApp. */}
      <GameweekView
        fixtures={fixtures}
        gameweek={gameweek}
        predictions={predictions}
        onScoreChange={handleScoreChange}
        submittedFixtureIds={submittedFixtureIds}
        scoreBreakdowns={scoreBreakdowns}
        bonusFixtureId={bonusFixtureId}
        onBonusToggle={handleBonusToggle}
        bonusActive={bonusRequiresFixture}
        isGoldenGlory={isGoldenGlory}
        allLocked={isLocked}
      />

      {/* 5b. Inline WhatsApp copy button — always rendered (not sticky)
             so it's visible regardless of bottom nav bar / keyboard overlap
             on mobile. Duplicate of the sticky variant below. */}
      {whatsAppButtonVisible && (
        <div className="pt-2">
          <WhatsAppCopyButton
            gameweekNumber={currentGw}
            memberDisplayName={memberDisplayName}
            fixtures={fixtures}
            predictions={predictions}
            bonusName={activeBonusType?.name ?? null}
            bonusFixtureId={bonusRequiresFixture ? bonusFixtureId : null}
            losTeamName={
              losTeamId
                ? losContext?.availableTeams.find((t) => t.id === losTeamId)?.name ?? null
                : null
            }
            onBeforeLock={saveCurrentPicks}
          />
        </div>
      )}

      {/* 6. Late kickoff warning (conditional) */}
      {someKickedOff && !allKickedOff && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-900/40 border border-amber-700/50">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-300">
            Some fixtures have kicked off — you can still predict the remaining ones.
          </p>
        </div>
      )}

      {allKickedOff && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-slate-700/60 border border-slate-700">
          <AlertTriangle className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-slate-400">
            All fixtures have kicked off — predictions for this gameweek are locked.
          </p>
        </div>
      )}

      {/* 7. Feedback banner (auto-dismisses after 5s) */}
      {feedback && (
        <div
          ref={feedbackRef}
          className={`flex items-start gap-2 px-3 py-2.5 rounded-lg border ${
            feedback.type === 'success'
              ? 'bg-green-900/40 border-green-700/50'
              : 'bg-red-900/40 border-red-700/50'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
          ) : (
            <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          )}
          <p className={`text-sm ${feedback.type === 'success' ? 'text-green-300' : 'text-red-300'}`}>
            {feedback.message}
          </p>
        </div>
      )}

      {/* 8. Fixed gameweek total footer — visible only when at least 1 result is in */}
      {scoredFixtureCount > 0 && (
        <div className={`fixed ${totalBarBottom} left-0 right-0 bg-slate-800 border-t border-slate-700 px-4 py-3 z-10`}>
          {/* Line 1: Base prediction points */}
          <div className="flex items-center justify-between">
            <span className="text-slate-300 text-xs">Base points</span>
            <span className="text-white text-xs font-medium">{totalPoints} pts</span>
          </div>

          {/* Line 2: Bonus points — shown when bonus award exists and has points */}
          {bonusAwardDisplay && bonusPoints > 0 && (
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-xs">
                {bonusConfirmed ? (
                  <span className="text-green-400">Bonus (confirmed)</span>
                ) : bonusPending ? (
                  <span className="text-amber-400">Bonus (pending)</span>
                ) : bonusRejected ? (
                  <span className="text-red-400 line-through">Bonus (rejected)</span>
                ) : (
                  <span className="text-slate-400">Bonus</span>
                )}
              </span>
              <span className={`text-xs font-medium ${bonusRejected ? 'text-red-400 line-through' : bonusConfirmed ? 'text-green-400' : 'text-amber-400'}`}>
                +{bonusPoints} pts
              </span>
            </div>
          )}

          {/* Line 3: Awaiting result — bonus pick exists but fixture not finished yet */}
          {bonusAwardDisplay && bonusPoints === 0 && bonusAwardDisplay.awarded === null && bonusAwardDisplay.fixture_id && (
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-amber-400 text-xs">Bonus pick</span>
              <span className="text-amber-400 text-xs">awaiting result</span>
            </div>
          )}

          {/* Divider + Total */}
          <div className="border-t border-slate-700/50 mt-1.5 pt-1.5">
            <div className="flex items-center justify-between">
              <span className="text-white font-semibold text-sm">
                GW{currentGw} Total
                {gameweek.double_bubble && (
                  <span className="ml-1 text-xs font-bold text-amber-400">x 2</span>
                )}
              </span>
              <span className="text-white font-bold text-sm">{displayTotal} pts</span>
            </div>
            {gameweek.double_bubble && (
              <div className="text-right">
                <span className="text-amber-400/80 text-[10px]">
                  Double Bubble: ({totalPoints}{bonusIncluded ? ` + ${bonusPoints}` : ''}) x 2
                </span>
              </div>
            )}
          </div>

          {/* Results counter */}
          <div className="text-right mt-0.5">
            <span className="text-slate-500 text-[10px]">
              {scoredFixtureCount} of {fixtures.length} results in
            </span>
          </div>
        </div>
      )}

      {/* 9. Sticky submit area — submit button + copy-to-WhatsApp button.
            The submit button is only visible before any fixture kicks off.
            The WhatsApp button is visible for the full week whenever the
            member has saved at least one pick, so they can copy + share even
            after some fixtures have started. Both hide once the week is
            locked via WhatsApp. */}
      {!isLocked && (hasExistingSubmitArea || whatsAppButtonVisible) && (
        <div className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700 p-4 z-10 space-y-2">
          {/* Mirror the inline feedback right next to the action button.
              Without this, validation errors render high up the page and the
              user — who just tapped Update at the bottom — can't see them
              and assumes the button is broken. */}
          {feedback && (
            <div
              className={`flex items-start gap-2 px-3 py-2 rounded-lg border ${
                feedback.type === 'success'
                  ? 'bg-green-900/40 border-green-700/50'
                  : 'bg-red-900/40 border-red-700/50'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              )}
              <p className={`text-xs ${feedback.type === 'success' ? 'text-green-300' : 'text-red-300'}`}>
                {feedback.message}
              </p>
            </div>
          )}
          {hasExistingSubmitArea && (
            <button
              type="button"
              onClick={handleSubmitClick}
              disabled={isSubmitting}
              className="w-full h-12 rounded-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-semibold text-base transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving…
                </>
              ) : (
                hasExistingPredictions ? 'Update Predictions' : 'Submit Predictions'
              )}
            </button>
          )}

          {whatsAppButtonVisible && (
            <WhatsAppCopyButton
              gameweekNumber={currentGw}
              memberDisplayName={memberDisplayName}
              fixtures={fixtures}
              predictions={predictions}
              bonusName={activeBonusType?.name ?? null}
              bonusFixtureId={bonusRequiresFixture ? bonusFixtureId : null}
              losTeamName={
                losTeamId
                  ? losContext?.availableTeams.find((t) => t.id === losTeamId)?.name ?? null
                  : null
              }
              onBeforeLock={saveCurrentPicks}
            />
          )}
        </div>
      )}

      {/* 10. LOS reminder dialog — fires when a returning member taps Update
             Predictions. Fullscreen overlay, purple theme, clear message. */}
      {losReminderOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <Trophy className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-base font-bold text-white">
                  Don&apos;t forget your Last One Standing pick
                </p>
                <p className="text-sm text-slate-300 mt-1 leading-relaxed">
                  Before you update, double-check your LOS team for this week.
                  {losContext?.currentPickTeamId
                    ? ` Currently picked: ${losContext.availableTeams.find((t) => t.id === losTeamId)?.name ?? 'no team'}.`
                    : ' You have not picked yet.'}
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setLosReminderOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm font-medium hover:bg-slate-800"
              >
                Go back
              </button>
              <button
                type="button"
                onClick={handleLosReminderConfirm}
                className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold"
              >
                LOS is good — update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
