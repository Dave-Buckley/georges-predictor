/**
 * Tests for pre-season Zod validators.
 *
 * Schemas:
 *   - submitPreSeasonPicksSchema      — member self-submission (no member_id)
 *   - setPreSeasonPicksForMemberSchema — admin override (adds member_id uuid)
 *   - confirmPreSeasonAwardSchema      — George confirms with optional override
 *   - seasonActualsSchema              — end-of-season actuals entry
 *
 * Zod v4 error access: .issues[0]?.message (STATE.md Phase 1 decision)
 */
import { describe, it, expect } from 'vitest'
import {
  submitPreSeasonPicksSchema,
  setPreSeasonPicksForMemberSchema,
  confirmPreSeasonAwardSchema,
  seasonActualsSchema,
} from '@/lib/validators/pre-season'

const VALID_PICKS = {
  season: 2025,
  top4: ['Manchester City', 'Arsenal', 'Liverpool', 'Chelsea'],
  tenth_place: 'Brighton',
  relegated: ['Burnley', 'Sheffield United', 'Luton Town'],
  promoted: ['Leeds United', 'Ipswich Town', 'Southampton'],
  promoted_playoff_winner: 'Southampton',
}

// ─── submitPreSeasonPicksSchema ──────────────────────────────────────────────

describe('submitPreSeasonPicksSchema', () => {
  it('accepts a valid 12-pick payload', () => {
    const result = submitPreSeasonPicksSchema.safeParse(VALID_PICKS)
    expect(result.success).toBe(true)
  })

  it('rejects when top4 has fewer than 4 entries', () => {
    const result = submitPreSeasonPicksSchema.safeParse({
      ...VALID_PICKS,
      top4: ['Manchester City', 'Arsenal', 'Liverpool'],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message.toLowerCase()).toContain('top')
    }
  })

  it('rejects when top4 has more than 4 entries', () => {
    const result = submitPreSeasonPicksSchema.safeParse({
      ...VALID_PICKS,
      top4: ['A', 'B', 'C', 'D', 'E'],
    })
    expect(result.success).toBe(false)
  })

  it('rejects when relegated has wrong count', () => {
    const result = submitPreSeasonPicksSchema.safeParse({
      ...VALID_PICKS,
      relegated: ['A', 'B'],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message.toLowerCase()).toContain('relegated')
    }
  })

  it('rejects when promoted has wrong count', () => {
    const result = submitPreSeasonPicksSchema.safeParse({
      ...VALID_PICKS,
      promoted: ['A', 'B'],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message.toLowerCase()).toContain('promoted')
    }
  })

  it('rejects missing tenth_place', () => {
    const { tenth_place: _, ...rest } = VALID_PICKS
    void _
    const result = submitPreSeasonPicksSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects empty tenth_place', () => {
    const result = submitPreSeasonPicksSchema.safeParse({
      ...VALID_PICKS,
      tenth_place: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing promoted_playoff_winner', () => {
    const { promoted_playoff_winner: _, ...rest } = VALID_PICKS
    void _
    const result = submitPreSeasonPicksSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('coerces season from string "2025" to number 2025', () => {
    const result = submitPreSeasonPicksSchema.safeParse({
      ...VALID_PICKS,
      season: '2025',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.season).toBe(2025)
    }
  })
})

// ─── setPreSeasonPicksForMemberSchema ────────────────────────────────────────

describe('setPreSeasonPicksForMemberSchema', () => {
  const MEMBER_ID = '11111111-1111-1111-1111-111111111111'

  it('accepts a valid payload with member_id', () => {
    const result = setPreSeasonPicksForMemberSchema.safeParse({
      ...VALID_PICKS,
      member_id: MEMBER_ID,
    })
    expect(result.success).toBe(true)
  })

  it('rejects non-UUID member_id', () => {
    const result = setPreSeasonPicksForMemberSchema.safeParse({
      ...VALID_PICKS,
      member_id: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message.toLowerCase()).toContain('member')
    }
  })

  it('rejects missing member_id', () => {
    const result = setPreSeasonPicksForMemberSchema.safeParse(VALID_PICKS)
    expect(result.success).toBe(false)
  })

  it('still enforces 12-pick shape from parent schema', () => {
    const result = setPreSeasonPicksForMemberSchema.safeParse({
      ...VALID_PICKS,
      member_id: MEMBER_ID,
      top4: ['A', 'B'],
    })
    expect(result.success).toBe(false)
  })
})

// ─── confirmPreSeasonAwardSchema ─────────────────────────────────────────────

describe('confirmPreSeasonAwardSchema', () => {
  const MEMBER_ID = '22222222-2222-2222-2222-222222222222'

  it('accepts without override_points', () => {
    const result = confirmPreSeasonAwardSchema.safeParse({
      member_id: MEMBER_ID,
      season: 2025,
    })
    expect(result.success).toBe(true)
  })

  it('accepts with override_points = 0', () => {
    const result = confirmPreSeasonAwardSchema.safeParse({
      member_id: MEMBER_ID,
      season: 2025,
      override_points: 0,
    })
    expect(result.success).toBe(true)
  })

  it('accepts with a positive override_points', () => {
    const result = confirmPreSeasonAwardSchema.safeParse({
      member_id: MEMBER_ID,
      season: 2025,
      override_points: 200,
    })
    expect(result.success).toBe(true)
  })

  it('rejects negative override_points', () => {
    const result = confirmPreSeasonAwardSchema.safeParse({
      member_id: MEMBER_ID,
      season: 2025,
      override_points: -10,
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-UUID member_id', () => {
    const result = confirmPreSeasonAwardSchema.safeParse({
      member_id: 'bad',
      season: 2025,
    })
    expect(result.success).toBe(false)
  })

  it('coerces override_points from string "150"', () => {
    const result = confirmPreSeasonAwardSchema.safeParse({
      member_id: MEMBER_ID,
      season: 2025,
      override_points: '150',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.override_points).toBe(150)
    }
  })
})

// ─── seasonActualsSchema ─────────────────────────────────────────────────────

describe('seasonActualsSchema', () => {
  const VALID_ACTUALS = {
    season: 2025,
    final_top4: ['A', 'B', 'C', 'D'],
    final_tenth: 'E',
    final_relegated: ['F', 'G', 'H'],
    final_promoted: ['I', 'J', 'K'],
    final_playoff_winner: 'L',
  }

  it('accepts a complete actuals payload', () => {
    const result = seasonActualsSchema.safeParse(VALID_ACTUALS)
    expect(result.success).toBe(true)
  })

  it('rejects when final_top4 has wrong count', () => {
    const result = seasonActualsSchema.safeParse({
      ...VALID_ACTUALS,
      final_top4: ['A', 'B', 'C'],
    })
    expect(result.success).toBe(false)
  })

  it('rejects when final_relegated has wrong count', () => {
    const result = seasonActualsSchema.safeParse({
      ...VALID_ACTUALS,
      final_relegated: ['F'],
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty final_playoff_winner', () => {
    const result = seasonActualsSchema.safeParse({
      ...VALID_ACTUALS,
      final_playoff_winner: '',
    })
    expect(result.success).toBe(false)
  })
})

// ─── Zod v4 error access pattern ─────────────────────────────────────────────

describe('Zod v4 error access convention', () => {
  it('invalid payload surfaces error via .issues[0]?.message (not .errors)', () => {
    const result = submitPreSeasonPicksSchema.safeParse({
      ...VALID_PICKS,
      top4: ['A'],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      // .issues is the Zod v4 API — project convention since Phase 1
      expect(Array.isArray(result.error.issues)).toBe(true)
      expect(result.error.issues.length).toBeGreaterThan(0)
      expect(typeof result.error.issues[0]?.message).toBe('string')
    }
  })
})
