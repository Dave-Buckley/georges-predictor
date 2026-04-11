/**
 * Tests for the core scoring library.
 *
 * Covers:
 * - calculatePoints: pure scoring function
 * - getOutcome: match result direction helper
 * - recalculateFixture: DB orchestration (Task 2)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { calculatePoints, getOutcome } from '@/lib/scoring/calculate'

// ─── getOutcome ───────────────────────────────────────────────────────────────

describe('getOutcome', () => {
  it('returns H for home win (3-1)', () => {
    expect(getOutcome(3, 1)).toBe('H')
  })

  it('returns D for draw (1-1)', () => {
    expect(getOutcome(1, 1)).toBe('D')
  })

  it('returns A for away win (0-2)', () => {
    expect(getOutcome(0, 2)).toBe('A')
  })

  it('returns D for 0-0 draw', () => {
    expect(getOutcome(0, 0)).toBe('D')
  })
})

// ─── calculatePoints ─────────────────────────────────────────────────────────

describe('calculatePoints', () => {
  it('awards 30 points for exact score match (2-1 vs 2-1)', () => {
    const result = calculatePoints({ home: 2, away: 1 }, { home: 2, away: 1 })
    expect(result.points_awarded).toBe(30)
    expect(result.result_correct).toBe(true)
    expect(result.score_correct).toBe(true)
  })

  it('awards 10 points for correct result but wrong score (2-1 predicted, 3-0 actual)', () => {
    const result = calculatePoints({ home: 2, away: 1 }, { home: 3, away: 0 })
    expect(result.points_awarded).toBe(10)
    expect(result.result_correct).toBe(true)
    expect(result.score_correct).toBe(false)
  })

  it('awards 0 points for wrong result (2-1 predicted, 0-0 actual)', () => {
    const result = calculatePoints({ home: 2, away: 1 }, { home: 0, away: 0 })
    expect(result.points_awarded).toBe(0)
    expect(result.result_correct).toBe(false)
    expect(result.score_correct).toBe(false)
  })

  it('awards 30 points for exact draw match (0-0 vs 0-0)', () => {
    const result = calculatePoints({ home: 0, away: 0 }, { home: 0, away: 0 })
    expect(result.points_awarded).toBe(30)
    expect(result.result_correct).toBe(true)
    expect(result.score_correct).toBe(true)
  })

  it('awards 10 points for correct draw result but wrong score (0-0 predicted, 1-1 actual)', () => {
    const result = calculatePoints({ home: 0, away: 0 }, { home: 1, away: 1 })
    expect(result.points_awarded).toBe(10)
    expect(result.result_correct).toBe(true)
    expect(result.score_correct).toBe(false)
  })

  it('awards 0 points when home win predicted but draw actual', () => {
    const result = calculatePoints({ home: 1, away: 0 }, { home: 2, away: 2 })
    expect(result.points_awarded).toBe(0)
    expect(result.result_correct).toBe(false)
    expect(result.score_correct).toBe(false)
  })

  it('awards 0 points when away win predicted but home win actual', () => {
    const result = calculatePoints({ home: 0, away: 2 }, { home: 3, away: 1 })
    expect(result.points_awarded).toBe(0)
    expect(result.result_correct).toBe(false)
    expect(result.score_correct).toBe(false)
  })

  it('includes predicted and actual scores in the result', () => {
    const result = calculatePoints({ home: 2, away: 1 }, { home: 2, away: 1 })
    expect(result.predicted_home).toBe(2)
    expect(result.predicted_away).toBe(1)
    expect(result.actual_home).toBe(2)
    expect(result.actual_away).toBe(1)
  })

  it('awards 0 points when draw predicted but away win actual', () => {
    const result = calculatePoints({ home: 1, away: 1 }, { home: 0, away: 3 })
    expect(result.points_awarded).toBe(0)
    expect(result.result_correct).toBe(false)
    expect(result.score_correct).toBe(false)
  })
})
