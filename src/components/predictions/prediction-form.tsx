'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, AlertTriangle, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import type { FixtureWithTeams, GameweekRow, GameweekStatus } from '@/lib/supabase/types'
import { submitPredictions } from '@/actions/predictions'
import GameweekNav from '@/components/fixtures/gameweek-nav'
import GameweekView from '@/components/fixtures/gameweek-view'

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
}: PredictionFormProps) {

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

  // Track whether the member has existing saved predictions (Submit vs Update button text)
  const [hasExistingPredictions, setHasExistingPredictions] = useState(
    Object.keys(existingPredictions).length > 0
  )

  // Track which fixture IDs are currently saved to the DB (for green-tint indicator)
  const [submittedFixtureIds, setSubmittedFixtureIds] = useState<Set<string>>(
    () => new Set(Object.keys(existingPredictions))
  )

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

  // ── Submit handler ─────────────────────────────────────────────────────────
  async function handleSubmit() {
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

    setIsSubmitting(true)
    setFeedback(null)

    try {
      const result = await submitPredictions(currentGw, validEntries)

      if (result.error) {
        setFeedback({ type: 'error', message: result.error })
      } else {
        const skippedMsg = result.skipped > 0 ? ` (${result.skipped} skipped — already kicked off)` : ''
        setFeedback({ type: 'success', message: `Saved ${result.saved} prediction${result.saved !== 1 ? 's' : ''}${skippedMsg}` })
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
  // Total bar sits above submit button when both visible; drops to bottom when submit is hidden
  const totalBarBottom = allKickedOff ? 'bottom-0' : 'bottom-[60px]'
  // Pad scrolling content to clear both fixed bars when both are visible
  const contentPadding = scoredFixtureCount > 0
    ? (allKickedOff ? 'pb-20' : 'pb-32')
    : 'pb-24'

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={`space-y-4 ${contentPadding}`}>

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

      {/* 2. Gameweek navigation */}
      <GameweekNav
        currentGw={currentGw}
        totalGw={totalGw}
        gameweeks={navGameweeks}
      />

      {/* 3. Fixture list with prediction inputs */}
      <GameweekView
        fixtures={fixtures}
        gameweek={gameweek}
        predictions={predictions}
        onScoreChange={handleScoreChange}
        submittedFixtureIds={submittedFixtureIds}
        scoreBreakdowns={scoreBreakdowns}
      />

      {/* 4. Late kickoff warning (conditional) */}
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

      {/* 5. Feedback banner (auto-dismisses after 5s) */}
      {feedback && (
        <div
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

      {/* 6. Fixed gameweek total footer — visible only when at least 1 result is in */}
      {scoredFixtureCount > 0 && (
        <div className={`fixed ${totalBarBottom} left-0 right-0 bg-slate-800 border-t border-slate-700 px-4 py-3 z-10`}>
          <div className="flex items-center justify-between">
            <span className="text-white font-semibold text-sm">
              Gameweek {currentGw} Total: {totalPoints} pts
            </span>
            <span className="text-slate-400 text-sm">
              {scoredFixtureCount} of {fixtures.length} results in
            </span>
          </div>
        </div>
      )}

      {/* 7. Sticky submit button */}
      {!allKickedOff && (
        <div className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700 p-4 z-10">
          <button
            type="button"
            onClick={handleSubmit}
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
        </div>
      )}
    </div>
  )
}
