'use client'

import { Minus, Plus } from 'lucide-react'

interface PredictionInputsProps {
  fixtureId: string
  homeScore: number | null    // null = no prediction yet
  awayScore: number | null
  onChange: (fixtureId: string, home: number | null, away: number | null) => void
  disabled?: boolean           // true for locked/kicked-off fixtures
  hasSubmitted?: boolean       // true if this fixture has a saved prediction
}

/**
 * Inline stepper inputs (Home [- score +] vs [- score +] Away) for a single fixture.
 *
 * Rendered inside FixtureCard's prediction-area when the member is on the
 * gameweek prediction page.
 *
 * Visual states:
 *   - null scores: empty inputs with placeholder "—", no green indicator
 *   - scores typed (not yet saved): filled inputs, no indicator
 *   - hasSubmitted + not disabled: green-tinted left border on wrapper
 *   - disabled (locked): read-only score values in muted style, no steppers
 *   - disabled + no scores: "No prediction" muted text
 */
export default function PredictionInputs({
  fixtureId,
  homeScore,
  awayScore,
  onChange,
  disabled = false,
  hasSubmitted = false,
}: PredictionInputsProps) {

  function handleIncrement(side: 'home' | 'away') {
    const current = side === 'home' ? homeScore : awayScore
    const other = side === 'home' ? awayScore : homeScore
    // First press of + on an empty score should land on 1, not 0 — otherwise
    // members have to click + twice to get their first goal recorded.
    const next = current === null ? 1 : Math.min(20, current + 1)
    if (side === 'home') onChange(fixtureId, next, other)
    else onChange(fixtureId, other, next)
  }

  function handleDecrement(side: 'home' | 'away') {
    const current = side === 'home' ? homeScore : awayScore
    const other = side === 'home' ? awayScore : homeScore
    if (current === null || current === 0) return
    const next = current - 1
    if (side === 'home') onChange(fixtureId, next, other)
    else onChange(fixtureId, other, next)
  }

  function handleInputChange(side: 'home' | 'away', raw: string) {
    const other = side === 'home' ? awayScore : homeScore
    if (raw === '') {
      // Allow clearing the input back to null
      if (side === 'home') onChange(fixtureId, null, other)
      else onChange(fixtureId, other, null)
      return
    }
    const parsed = parseInt(raw, 10)
    if (isNaN(parsed)) return
    const clamped = Math.min(20, Math.max(0, parsed))
    if (side === 'home') onChange(fixtureId, clamped, other)
    else onChange(fixtureId, other, clamped)
  }

  // ── Locked read-only state ──────────────────────────────────────────────────
  if (disabled) {
    if (homeScore === null || awayScore === null) {
      return (
        <div className="flex items-center justify-center py-1">
          <span className="text-xs text-slate-500 italic">No prediction</span>
        </div>
      )
    }
    return (
      <div className="flex items-center justify-center gap-3 py-1">
        <span className="text-sm font-medium text-slate-400">
          {homeScore} – {awayScore}
        </span>
      </div>
    )
  }

  // ── Active stepper state ────────────────────────────────────────────────────
  const wrapperClass = `flex items-center justify-between gap-2 py-1.5 ${
    hasSubmitted ? 'border-l-4 border-l-green-500 pl-3 -ml-4' : ''
  }`

  function Stepper({ side }: { side: 'home' | 'away' }) {
    const value = side === 'home' ? homeScore : awayScore
    const isMin = value === null || value === 0
    const isMax = value === 20

    return (
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => handleDecrement(side)}
          disabled={isMin}
          aria-label={`Decrease ${side} score`}
          className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={20}
          value={value ?? ''}
          placeholder="—"
          onChange={(e) => handleInputChange(side, e.target.value)}
          aria-label={`${side} score for fixture`}
          className="w-9 h-7 text-center text-sm font-semibold bg-slate-700 text-white rounded-lg border border-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />

        <button
          type="button"
          onClick={() => handleIncrement(side)}
          disabled={isMax}
          aria-label={`Increase ${side} score`}
          className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className={wrapperClass}>
      {/* Home stepper */}
      <div className="flex flex-col items-start gap-0.5">
        <span className="text-xs text-slate-500 ml-1">Home</span>
        <Stepper side="home" />
      </div>

      {/* VS divider */}
      <span className="text-xs text-slate-600 font-medium">vs</span>

      {/* Away stepper */}
      <div className="flex flex-col items-end gap-0.5">
        <span className="text-xs text-slate-500 mr-1">Away</span>
        <Stepper side="away" />
      </div>
    </div>
  )
}
