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
import { recalculateFixture } from '@/lib/scoring/recalculate'

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

// ─── recalculateFixture ───────────────────────────────────────────────────────

// Mock createAdminClient so tests don't need a real DB connection
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

import { createAdminClient } from '@/lib/supabase/admin'

const FIXTURE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const MEMBER_ID_1 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const MEMBER_ID_2 = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
const PREDICTION_ID_1 = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
const PREDICTION_ID_2 = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'

const SAMPLE_PREDICTIONS = [
  {
    id: PREDICTION_ID_1,
    member_id: MEMBER_ID_1,
    fixture_id: FIXTURE_ID,
    home_score: 2,
    away_score: 1,
    submitted_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: PREDICTION_ID_2,
    member_id: MEMBER_ID_2,
    fixture_id: FIXTURE_ID,
    home_score: 0,
    away_score: 0,
    submitted_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
]

function makeMockChain(overrides: Record<string, unknown> = {}) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
  }
  return chain
}

describe('recalculateFixture', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns predictions_scored: 0 when home_score is null', async () => {
    const result = await recalculateFixture(FIXTURE_ID, null, 1)
    expect(result.predictions_scored).toBe(0)
    expect(result.errors).toEqual([])
    expect(result.fixture_id).toBe(FIXTURE_ID)
  })

  it('returns predictions_scored: 0 when away_score is null', async () => {
    const result = await recalculateFixture(FIXTURE_ID, 2, null)
    expect(result.predictions_scored).toBe(0)
    expect(result.errors).toEqual([])
  })

  it('returns correct predictions_scored count matching number of predictions', async () => {
    const mockFromPredictions = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: SAMPLE_PREDICTIONS, error: null }),
      }),
    }
    const mockFromScores = {
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    const mockFromBonusAwards = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    }
    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'predictions') return mockFromPredictions
        if (table === 'prediction_scores') return mockFromScores
        if (table === 'bonus_awards') return mockFromBonusAwards
        return {}
      }),
    }
    vi.mocked(createAdminClient).mockReturnValue(mockClient as ReturnType<typeof createAdminClient>)

    const result = await recalculateFixture(FIXTURE_ID, 2, 1)

    expect(result.predictions_scored).toBe(2)
    expect(result.bonus_calculated).toBe(0)
    expect(result.errors).toEqual([])
    expect(result.fixture_id).toBe(FIXTURE_ID)
  })

  it('calls upsert on prediction_scores with one row per prediction', async () => {
    let capturedUpsertRows: unknown[] = []
    const mockUpsert = vi.fn().mockImplementation((rows: unknown[]) => {
      capturedUpsertRows = rows
      return Promise.resolve({ data: null, error: null })
    })
    const mockFromScores = { upsert: mockUpsert }
    const mockFromPredictions = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: SAMPLE_PREDICTIONS, error: null }),
      }),
    }
    const mockFromBonusAwards = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    }
    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'predictions') return mockFromPredictions
        if (table === 'prediction_scores') return mockFromScores
        if (table === 'bonus_awards') return mockFromBonusAwards
        return {}
      }),
    }
    vi.mocked(createAdminClient).mockReturnValue(mockClient as ReturnType<typeof createAdminClient>)

    await recalculateFixture(FIXTURE_ID, 2, 1)

    expect(mockUpsert).toHaveBeenCalledOnce()
    expect(capturedUpsertRows).toHaveLength(2)
    // First prediction: 2-1 vs 2-1 actual = 30pts exact
    expect((capturedUpsertRows[0] as Record<string, unknown>).prediction_id).toBe(PREDICTION_ID_1)
    expect((capturedUpsertRows[0] as Record<string, unknown>).points_awarded).toBe(30)
    // Second prediction: 0-0 vs 2-1 actual = 0pts
    expect((capturedUpsertRows[1] as Record<string, unknown>).prediction_id).toBe(PREDICTION_ID_2)
    expect((capturedUpsertRows[1] as Record<string, unknown>).points_awarded).toBe(0)
  })

  it('returns error when prediction query fails', async () => {
    const mockChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB connection failed' } }),
      }),
    }
    const mockClient = { from: vi.fn().mockReturnValue(mockChain) }
    vi.mocked(createAdminClient).mockReturnValue(mockClient as ReturnType<typeof createAdminClient>)

    const result = await recalculateFixture(FIXTURE_ID, 2, 1)

    expect(result.predictions_scored).toBe(0)
    expect(result.bonus_calculated).toBe(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('DB connection failed')
  })
})
