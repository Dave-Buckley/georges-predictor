/**
 * Tests for the bonus scoring calculation library.
 *
 * Covers:
 * - calculateBonusPoints: pure bonus scoring function
 *   - Golden Glory (0 / 20 / 60 pts)
 *   - Jose Park The Bus (0 / 20 pts, low-scoring only)
 *   - Event-dependent bonuses → requires_manual_review: true
 *   - Unknown bonus type → requires_manual_review: true
 * - computeDisplayTotal: Double Bubble multiplier helper
 */
import { describe, it, expect } from 'vitest'
import { calculateBonusPoints, computeDisplayTotal } from '@/lib/scoring/calculate-bonus'

// ─── calculateBonusPoints ─────────────────────────────────────────────────────

describe('calculateBonusPoints', () => {
  // ── Golden Glory ────────────────────────────────────────────────────────────

  describe('Golden Glory', () => {
    it('returns 60pts when score_correct (exact score match)', () => {
      const result = calculateBonusPoints(
        'Golden Glory',
        { result_correct: true, score_correct: true },
        { home: 2, away: 1 },
      )
      expect(result.condition_met).toBe(true)
      expect(result.points_awarded).toBe(60)
      expect(result.requires_manual_review).toBe(false)
    })

    it('returns 20pts when result_correct but not score_correct', () => {
      const result = calculateBonusPoints(
        'Golden Glory',
        { result_correct: true, score_correct: false },
        { home: 3, away: 0 },
      )
      expect(result.condition_met).toBe(true)
      expect(result.points_awarded).toBe(20)
      expect(result.requires_manual_review).toBe(false)
    })

    it('returns 0pts when wrong result', () => {
      const result = calculateBonusPoints(
        'Golden Glory',
        { result_correct: false, score_correct: false },
        { home: 0, away: 1 },
      )
      expect(result.condition_met).toBe(false)
      expect(result.points_awarded).toBe(0)
      expect(result.requires_manual_review).toBe(false)
    })
  })

  // ── Jose Park The Bus ────────────────────────────────────────────────────────

  describe('Jose Park The Bus', () => {
    it('returns 20pts for 0-0 actual AND score_correct', () => {
      const result = calculateBonusPoints(
        'Jose Park The Bus',
        { result_correct: true, score_correct: true },
        { home: 0, away: 0 },
      )
      expect(result.condition_met).toBe(true)
      expect(result.points_awarded).toBe(20)
      expect(result.requires_manual_review).toBe(false)
    })

    it('returns 20pts for 1-0 actual AND score_correct', () => {
      const result = calculateBonusPoints(
        'Jose Park The Bus',
        { result_correct: true, score_correct: true },
        { home: 1, away: 0 },
      )
      expect(result.condition_met).toBe(true)
      expect(result.points_awarded).toBe(20)
      expect(result.requires_manual_review).toBe(false)
    })

    it('returns 20pts for 0-1 actual AND score_correct', () => {
      const result = calculateBonusPoints(
        'Jose Park The Bus',
        { result_correct: true, score_correct: true },
        { home: 0, away: 1 },
      )
      expect(result.condition_met).toBe(true)
      expect(result.points_awarded).toBe(20)
      expect(result.requires_manual_review).toBe(false)
    })

    it('returns 0pts when actual is 2-1 (not a low-scoring result)', () => {
      const result = calculateBonusPoints(
        'Jose Park The Bus',
        { result_correct: true, score_correct: true },
        { home: 2, away: 1 },
      )
      expect(result.condition_met).toBe(false)
      expect(result.points_awarded).toBe(0)
      expect(result.requires_manual_review).toBe(false)
    })

    it('returns 0pts when actual is 2-0 (not low-scoring enough, even if score_correct)', () => {
      const result = calculateBonusPoints(
        'Jose Park The Bus',
        { result_correct: true, score_correct: true },
        { home: 2, away: 0 },
      )
      expect(result.condition_met).toBe(false)
      expect(result.points_awarded).toBe(0)
      expect(result.requires_manual_review).toBe(false)
    })

    it('returns 0pts when actual is 0-0 but score_correct is false', () => {
      const result = calculateBonusPoints(
        'Jose Park The Bus',
        { result_correct: false, score_correct: false },
        { home: 0, away: 0 },
      )
      expect(result.condition_met).toBe(false)
      expect(result.points_awarded).toBe(0)
      expect(result.requires_manual_review).toBe(false)
    })
  })

  // ── Event-dependent bonus types ──────────────────────────────────────────────

  describe('Event-dependent bonus types (require manual review)', () => {
    it('returns requires_manual_review=true for Brace Yourself', () => {
      const result = calculateBonusPoints(
        'Brace Yourself',
        { result_correct: true, score_correct: true },
        { home: 2, away: 1 },
      )
      expect(result.condition_met).toBe(false)
      expect(result.points_awarded).toBe(0)
      expect(result.requires_manual_review).toBe(true)
    })

    it('returns requires_manual_review=true for Fergie Time', () => {
      const result = calculateBonusPoints(
        'Fergie Time',
        { result_correct: true, score_correct: false },
        { home: 1, away: 0 },
      )
      expect(result.condition_met).toBe(false)
      expect(result.points_awarded).toBe(0)
      expect(result.requires_manual_review).toBe(true)
    })

    it('returns requires_manual_review=true for any unknown bonus type', () => {
      const result = calculateBonusPoints(
        'Some Future Bonus Type',
        { result_correct: false, score_correct: false },
        { home: 1, away: 1 },
      )
      expect(result.condition_met).toBe(false)
      expect(result.points_awarded).toBe(0)
      expect(result.requires_manual_review).toBe(true)
    })
  })
})

// ─── computeDisplayTotal ─────────────────────────────────────────────────────

describe('computeDisplayTotal', () => {
  it('doubles base+confirmed bonus when Double Bubble active: 40 base + 20 confirmed bonus → 120', () => {
    const result = computeDisplayTotal(40, 20, true, true)
    expect(result.rawTotal).toBe(60)
    expect(result.displayTotal).toBe(120)
    expect(result.bonusIncluded).toBe(true)
  })

  it('includes confirmed bonus but no Double Bubble: 40 base + 20 confirmed bonus → 60', () => {
    const result = computeDisplayTotal(40, 20, true, false)
    expect(result.rawTotal).toBe(60)
    expect(result.displayTotal).toBe(60)
    expect(result.bonusIncluded).toBe(true)
  })

  it('doubles only base when bonus pending and Double Bubble active: 40 base, bonus not confirmed → 80', () => {
    const result = computeDisplayTotal(40, 20, false, true)
    expect(result.rawTotal).toBe(40)
    expect(result.displayTotal).toBe(80)
    expect(result.bonusIncluded).toBe(false)
  })

  it('returns base only when no bonus and no Double Bubble: 40 base → 40', () => {
    const result = computeDisplayTotal(40, 0, false, false)
    expect(result.rawTotal).toBe(40)
    expect(result.displayTotal).toBe(40)
    expect(result.bonusIncluded).toBe(false)
  })

  it('returns 0 total with no points at all', () => {
    const result = computeDisplayTotal(0, 0, false, false)
    expect(result.rawTotal).toBe(0)
    expect(result.displayTotal).toBe(0)
    expect(result.bonusIncluded).toBe(false)
  })

  it('handles confirmed bonus with zero base points', () => {
    const result = computeDisplayTotal(0, 20, true, false)
    expect(result.rawTotal).toBe(20)
    expect(result.displayTotal).toBe(20)
    expect(result.bonusIncluded).toBe(true)
  })
})
