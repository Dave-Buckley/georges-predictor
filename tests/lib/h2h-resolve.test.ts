import { describe, it, expect } from 'vitest'
import { resolveSteal } from '@/lib/h2h/resolve-steal'

describe('resolveSteal (H2H-03)', () => {
  it('returns the single highest scorer as the winner', () => {
    const result = resolveSteal({
      tied_member_ids: ['A', 'B'],
      next_week_totals: { A: 30, B: 20 },
    })
    expect(result).toEqual({ winner_ids: ['A'] })
  })

  it('splits when the next-week totals are still tied at the top', () => {
    const result = resolveSteal({
      tied_member_ids: ['A', 'B', 'C'],
      next_week_totals: { A: 30, B: 30, C: 20 },
    })
    expect(result).toEqual({ winner_ids: ['A', 'B'] })
  })

  it('splits evenly when all tied members scored zero next week', () => {
    const result = resolveSteal({
      tied_member_ids: ['A', 'B'],
      next_week_totals: { A: 0, B: 0 },
    })
    expect(result).toEqual({ winner_ids: ['A', 'B'] })
  })

  it('treats a missing member_id in next_week_totals as 0', () => {
    const result = resolveSteal({
      tied_member_ids: ['A', 'B'],
      next_week_totals: { B: 10 },
    })
    expect(result).toEqual({ winner_ids: ['B'] })
  })

  it('splits when all tied members are missing from next_week_totals', () => {
    const result = resolveSteal({
      tied_member_ids: ['X', 'Y'],
      next_week_totals: {},
    })
    expect(result).toEqual({ winner_ids: ['X', 'Y'] })
  })

  it('sorts winner_ids alphabetically for determinism', () => {
    const result = resolveSteal({
      tied_member_ids: ['zeta', 'alpha', 'mike'],
      next_week_totals: { zeta: 50, alpha: 50, mike: 50 },
    })
    expect(result.winner_ids).toEqual(['alpha', 'mike', 'zeta'])
  })
})
