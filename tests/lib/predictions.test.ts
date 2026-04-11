/**
 * Tests for prediction Zod validators.
 *
 * Covers predictionEntrySchema and submitPredictionsSchema.
 */
import { describe, it, expect } from 'vitest'
import {
  predictionEntrySchema,
  submitPredictionsSchema,
} from '@/lib/validators/predictions'

const VALID_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'

// ─── predictionEntrySchema ────────────────────────────────────────────────────

describe('predictionEntrySchema', () => {
  it('accepts valid prediction with zero home score', () => {
    const result = predictionEntrySchema.safeParse({
      fixture_id: VALID_UUID,
      home_score: 0,
      away_score: 3,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({ fixture_id: VALID_UUID, home_score: 0, away_score: 3 })
    }
  })

  it('rejects negative home_score (-1)', () => {
    const result = predictionEntrySchema.safeParse({
      fixture_id: VALID_UUID,
      home_score: -1,
      away_score: 0,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages.some((m) => m.toLowerCase().includes('negative') || m.toLowerCase().includes('0'))).toBe(true)
    }
  })

  it('rejects negative away_score (-1)', () => {
    const result = predictionEntrySchema.safeParse({
      fixture_id: VALID_UUID,
      home_score: 0,
      away_score: -1,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages.some((m) => m.toLowerCase().includes('negative') || m.toLowerCase().includes('0'))).toBe(true)
    }
  })

  it('rejects score greater than 20', () => {
    const result = predictionEntrySchema.safeParse({
      fixture_id: VALID_UUID,
      home_score: 21,
      away_score: 0,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages.some((m) => m.toLowerCase().includes('high') || m.toLowerCase().includes('20'))).toBe(true)
    }
  })

  it('rejects non-UUID fixture_id ("abc")', () => {
    const result = predictionEntrySchema.safeParse({
      fixture_id: 'abc',
      home_score: 1,
      away_score: 1,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages.some((m) => m.toLowerCase().includes('invalid') || m.toLowerCase().includes('fixture'))).toBe(true)
    }
  })

  it('coerces string home_score to number ("2" -> 2)', () => {
    const result = predictionEntrySchema.safeParse({
      fixture_id: VALID_UUID,
      home_score: '2',
      away_score: '1',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.home_score).toBe(2)
      expect(result.data.away_score).toBe(1)
    }
  })
})

// ─── submitPredictionsSchema ──────────────────────────────────────────────────

describe('submitPredictionsSchema', () => {
  it('rejects empty entries array', () => {
    const result = submitPredictionsSchema.safeParse({
      gameweek_number: 5,
      entries: [],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages.some((m) => m.toLowerCase().includes('least') || m.toLowerCase().includes('prediction'))).toBe(true)
    }
  })

  it('rejects gameweek_number less than 1', () => {
    const result = submitPredictionsSchema.safeParse({
      gameweek_number: 0,
      entries: [{ fixture_id: VALID_UUID, home_score: 1, away_score: 0 }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects gameweek_number greater than 38', () => {
    const result = submitPredictionsSchema.safeParse({
      gameweek_number: 39,
      entries: [{ fixture_id: VALID_UUID, home_score: 1, away_score: 0 }],
    })
    expect(result.success).toBe(false)
  })

  it('accepts valid gameweek_number and entries', () => {
    const result = submitPredictionsSchema.safeParse({
      gameweek_number: 10,
      entries: [{ fixture_id: VALID_UUID, home_score: 2, away_score: 1 }],
    })
    expect(result.success).toBe(true)
  })
})
