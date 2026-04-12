/**
 * Tests for the pure pre-season scoring library.
 *
 * Rules (locked per CONTEXT.md):
 *   - 30 pts flat per correct team pick — no tiering, no doubling
 *   - Categories: top4 (4), tenth (1), relegated (3), promoted (3), playoff_winner (1) = 12 total
 *   - top4, relegated, promoted use SET EQUALITY (order ignored)
 *   - tenth and playoff_winner use strict single-value equality
 *   - All comparisons are case-insensitive + whitespace-trimmed
 *   - Four flags emitted: all_top4_correct, all_relegated_correct, all_promoted_correct, all_correct_overall
 *   - all_correct_overall is true ONLY when all 12 picks score
 */
import { describe, it, expect } from 'vitest'
import {
  calculatePreSeasonPoints,
  type PreSeasonPicks,
  type PreSeasonActuals,
} from '@/lib/pre-season/calculate'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const actuals: PreSeasonActuals = {
  final_top4: ['Manchester City', 'Arsenal', 'Liverpool', 'Chelsea'],
  final_tenth: 'Brighton',
  final_relegated: ['Burnley', 'Sheffield United', 'Luton Town'],
  final_promoted: ['Leeds United', 'Ipswich Town', 'Southampton'],
  final_playoff_winner: 'Southampton',
}

const perfectPicks: PreSeasonPicks = {
  top4: ['Manchester City', 'Arsenal', 'Liverpool', 'Chelsea'],
  tenth_place: 'Brighton',
  relegated: ['Burnley', 'Sheffield United', 'Luton Town'],
  promoted: ['Leeds United', 'Ipswich Town', 'Southampton'],
  promoted_playoff_winner: 'Southampton',
}

// ─── Perfect + Zero ──────────────────────────────────────────────────────────

describe('calculatePreSeasonPoints — perfect picks', () => {
  it('awards 360 points (12 × 30) and sets all 4 flags true when every pick is correct', () => {
    const result = calculatePreSeasonPoints(perfectPicks, actuals)
    expect(result.totalPoints).toBe(360)
    expect(result.correctByCategory).toEqual({
      top4: 4,
      tenth: 1,
      relegated: 3,
      promoted: 3,
      playoff_winner: 1,
    })
    expect(result.flags).toEqual({
      all_top4_correct: true,
      all_relegated_correct: true,
      all_promoted_correct: true,
      all_correct_overall: true,
    })
  })
})

describe('calculatePreSeasonPoints — zero correct picks', () => {
  it('awards 0 points and all flags false when nothing matches', () => {
    const picks: PreSeasonPicks = {
      top4: ['Bournemouth', 'Brentford', 'Crystal Palace', 'Fulham'],
      tenth_place: 'Everton',
      relegated: ['Arsenal', 'Manchester City', 'Liverpool'],
      promoted: ['Cardiff City', 'Preston North End', 'Millwall'],
      promoted_playoff_winner: 'Preston North End',
    }
    const result = calculatePreSeasonPoints(picks, actuals)
    expect(result.totalPoints).toBe(0)
    expect(result.correctByCategory).toEqual({
      top4: 0,
      tenth: 0,
      relegated: 0,
      promoted: 0,
      playoff_winner: 0,
    })
    expect(result.flags).toEqual({
      all_top4_correct: false,
      all_relegated_correct: false,
      all_promoted_correct: false,
      all_correct_overall: false,
    })
  })
})

// ─── Set equality (unordered categories) ─────────────────────────────────────

describe('calculatePreSeasonPoints — set equality for unordered categories (Pitfall 5)', () => {
  it('reversed top4 order still scores 4/4 and sets all_top4_correct=true', () => {
    const picks: PreSeasonPicks = {
      ...perfectPicks,
      // Reverse order — same set of teams
      top4: ['Chelsea', 'Liverpool', 'Arsenal', 'Manchester City'],
    }
    const result = calculatePreSeasonPoints(picks, actuals)
    expect(result.correctByCategory.top4).toBe(4)
    expect(result.flags.all_top4_correct).toBe(true)
  })

  it('reversed relegated order still scores 3/3', () => {
    const picks: PreSeasonPicks = {
      ...perfectPicks,
      relegated: ['Luton Town', 'Sheffield United', 'Burnley'],
    }
    const result = calculatePreSeasonPoints(picks, actuals)
    expect(result.correctByCategory.relegated).toBe(3)
    expect(result.flags.all_relegated_correct).toBe(true)
  })

  it('shuffled promoted order still scores 3/3', () => {
    const picks: PreSeasonPicks = {
      ...perfectPicks,
      promoted: ['Southampton', 'Leeds United', 'Ipswich Town'],
    }
    const result = calculatePreSeasonPoints(picks, actuals)
    expect(result.correctByCategory.promoted).toBe(3)
    expect(result.flags.all_promoted_correct).toBe(true)
  })
})

// ─── Case-insensitive + whitespace-trimmed matching ─────────────────────────

describe('calculatePreSeasonPoints — case-insensitive + trim matching (Pitfall 3)', () => {
  it('matches "manchester united" against "Manchester United" (case-insensitive)', () => {
    const picks: PreSeasonPicks = {
      top4: ['manchester city', 'arsenal', 'LIVERPOOL', 'Chelsea'],
      tenth_place: 'BRIGHTON',
      relegated: ['burnley', 'Sheffield United', 'luton town'],
      promoted: ['leeds united', 'IPSWICH TOWN', 'southampton'],
      promoted_playoff_winner: 'SoUtHaMpToN',
    }
    const result = calculatePreSeasonPoints(picks, actuals)
    expect(result.totalPoints).toBe(360)
    expect(result.flags.all_correct_overall).toBe(true)
  })

  it('matches whitespace-padded names ("  Brighton  " vs "Brighton")', () => {
    const picks: PreSeasonPicks = {
      ...perfectPicks,
      tenth_place: '  Brighton  ',
    }
    const result = calculatePreSeasonPoints(picks, actuals)
    expect(result.correctByCategory.tenth).toBe(1)
  })
})

// ─── Partial correctness ─────────────────────────────────────────────────────

describe('calculatePreSeasonPoints — partial category correctness', () => {
  it('2/4 top4 correct → top4=2, all_top4_correct=false, 60pts from that category', () => {
    const picks: PreSeasonPicks = {
      top4: ['Manchester City', 'Arsenal', 'Everton', 'Bournemouth'],
      tenth_place: 'Nowhere',
      relegated: ['X', 'Y', 'Z'],
      promoted: ['A', 'B', 'C'],
      promoted_playoff_winner: 'Wrong',
    }
    const result = calculatePreSeasonPoints(picks, actuals)
    expect(result.correctByCategory.top4).toBe(2)
    expect(result.flags.all_top4_correct).toBe(false)
    expect(result.totalPoints).toBe(60) // 2 × 30
  })

  it('3/4 top4 correct scores exactly 90 points (never tiered)', () => {
    const picks: PreSeasonPicks = {
      ...perfectPicks,
      top4: ['Manchester City', 'Arsenal', 'Liverpool', 'Wrong FC'],
      tenth_place: 'Nowhere',
      relegated: ['X', 'Y', 'Z'],
      promoted: ['A', 'B', 'C'],
      promoted_playoff_winner: 'Wrong',
    }
    const result = calculatePreSeasonPoints(picks, actuals)
    expect(result.correctByCategory.top4).toBe(3)
    expect(result.totalPoints).toBe(90)
    expect(result.flags.all_top4_correct).toBe(false)
  })
})

// ─── Independent per-category flag emission ─────────────────────────────────

describe('calculatePreSeasonPoints — per-category flag independence', () => {
  it('fires all_relegated_correct alone when only relegated is fully correct', () => {
    const picks: PreSeasonPicks = {
      top4: ['Wrong1', 'Wrong2', 'Wrong3', 'Wrong4'],
      tenth_place: 'Wrong',
      relegated: ['Burnley', 'Sheffield United', 'Luton Town'],
      promoted: ['Wrong', 'Wrong', 'Wrong'],
      promoted_playoff_winner: 'Wrong',
    }
    const result = calculatePreSeasonPoints(picks, actuals)
    expect(result.flags.all_relegated_correct).toBe(true)
    expect(result.flags.all_top4_correct).toBe(false)
    expect(result.flags.all_promoted_correct).toBe(false)
    expect(result.flags.all_correct_overall).toBe(false)
    expect(result.totalPoints).toBe(90) // 3 × 30 from relegated only
  })

  it('fires all_promoted_correct alone when only promoted is fully correct', () => {
    const picks: PreSeasonPicks = {
      top4: ['X', 'Y', 'Z', 'W'],
      tenth_place: 'Nope',
      relegated: ['A', 'B', 'C'],
      promoted: ['Leeds United', 'Ipswich Town', 'Southampton'],
      promoted_playoff_winner: 'Nope',
    }
    const result = calculatePreSeasonPoints(picks, actuals)
    expect(result.flags.all_promoted_correct).toBe(true)
    expect(result.flags.all_top4_correct).toBe(false)
    expect(result.flags.all_relegated_correct).toBe(false)
    expect(result.flags.all_correct_overall).toBe(false)
  })

  it('all_correct_overall true ONLY when all 12 categories fully correct', () => {
    // Missing just one — playoff winner wrong
    const picks: PreSeasonPicks = {
      ...perfectPicks,
      promoted_playoff_winner: 'Leeds United', // wrong (even though it's a valid promoted team)
    }
    const result = calculatePreSeasonPoints(picks, actuals)
    expect(result.flags.all_correct_overall).toBe(false)
    expect(result.flags.all_top4_correct).toBe(true)
    expect(result.flags.all_relegated_correct).toBe(true)
    expect(result.flags.all_promoted_correct).toBe(true)
    // 11 correct × 30 = 330
    expect(result.totalPoints).toBe(330)
  })
})

// ─── Flat scoring invariant ──────────────────────────────────────────────────

describe('calculatePreSeasonPoints — 30 points flat per correct', () => {
  it('scoring is always total correct × 30 exactly', () => {
    const picks: PreSeasonPicks = {
      top4: ['Manchester City', 'Arsenal', 'Wrong1', 'Wrong2'], // 2 correct
      tenth_place: 'Brighton', // 1 correct
      relegated: ['Burnley', 'Wrong', 'Wrong'], // 1 correct
      promoted: ['Leeds United', 'Wrong', 'Wrong'], // 1 correct
      promoted_playoff_winner: 'Wrong', // 0
    }
    const result = calculatePreSeasonPoints(picks, actuals)
    const totalCorrect =
      result.correctByCategory.top4 +
      result.correctByCategory.tenth +
      result.correctByCategory.relegated +
      result.correctByCategory.promoted +
      result.correctByCategory.playoff_winner
    expect(totalCorrect).toBe(5)
    expect(result.totalPoints).toBe(150)
  })
})
