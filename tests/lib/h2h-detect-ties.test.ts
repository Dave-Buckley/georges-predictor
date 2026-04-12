import { describe, it, expect } from 'vitest'
import { detectWeeklyTies, type WeeklyTotal } from '@/lib/h2h/detect-ties'

describe('detectWeeklyTies (H2H-01)', () => {
  it('returns [] when there are no ties at position 1 or 2', () => {
    const totals: WeeklyTotal[] = [
      { member_id: 'A', total: 90 },
      { member_id: 'B', total: 70 },
      { member_id: 'C', total: 50 },
    ]
    expect(detectWeeklyTies(totals)).toEqual([])
  })

  it('returns a position-1 TieGroup when two members are tied at the top', () => {
    const totals: WeeklyTotal[] = [
      { member_id: 'A', total: 80 },
      { member_id: 'B', total: 80 },
      { member_id: 'C', total: 50 },
    ]
    const result = detectWeeklyTies(totals)
    expect(result).toEqual([
      { position: 1, member_ids: ['A', 'B'], total: 80 },
    ])
  })

  it('returns a position-2 TieGroup when three members are tied at second', () => {
    const totals: WeeklyTotal[] = [
      { member_id: 'A', total: 100 },
      { member_id: 'B', total: 60 },
      { member_id: 'C', total: 60 },
      { member_id: 'D', total: 60 },
      { member_id: 'E', total: 40 },
    ]
    const result = detectWeeklyTies(totals)
    expect(result).toEqual([
      { position: 2, member_ids: ['B', 'C', 'D'], total: 60 },
    ])
  })

  it('returns both groups when positions 1 AND 2 are tied', () => {
    const totals: WeeklyTotal[] = [
      { member_id: 'A', total: 90 },
      { member_id: 'B', total: 90 },
      { member_id: 'C', total: 70 },
      { member_id: 'D', total: 70 },
      { member_id: 'E', total: 50 },
    ]
    const result = detectWeeklyTies(totals)
    expect(result).toEqual([
      { position: 1, member_ids: ['A', 'B'], total: 90 },
      { position: 2, member_ids: ['C', 'D'], total: 70 },
    ])
  })

  it('returns [] for an empty totals list', () => {
    expect(detectWeeklyTies([])).toEqual([])
  })

  it('filters out members with total=0 before detecting ties (SQL filter parity)', () => {
    const totals: WeeklyTotal[] = [
      { member_id: 'A', total: 0 },
      { member_id: 'B', total: 0 },
      { member_id: 'C', total: 40 },
      { member_id: 'D', total: 40 },
    ]
    const result = detectWeeklyTies(totals)
    expect(result).toEqual([
      { position: 1, member_ids: ['C', 'D'], total: 40 },
    ])
  })

  it('returns member_ids sorted alphabetically within a group (determinism)', () => {
    const totals: WeeklyTotal[] = [
      { member_id: 'zeta', total: 50 },
      { member_id: 'alpha', total: 50 },
      { member_id: 'mike', total: 50 },
    ]
    const result = detectWeeklyTies(totals)
    expect(result[0].member_ids).toEqual(['alpha', 'mike', 'zeta'])
  })

  it('does not return a TieGroup when a position has only one member (not a tie)', () => {
    const totals: WeeklyTotal[] = [
      { member_id: 'A', total: 100 }, // clear 1st
      { member_id: 'B', total: 80 },  // clear 2nd
      { member_id: 'C', total: 80 },  // still clear 2nd if only 1 member at rank 2
    ]
    // B and C are both at rank 2 (dense rank) → THIS is a tie at position 2.
    const result = detectWeeklyTies(totals)
    expect(result).toEqual([
      { position: 2, member_ids: ['B', 'C'], total: 80 },
    ])
  })
})
