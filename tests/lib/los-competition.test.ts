import { describe, it, expect } from 'vitest'
import {
  shouldResetCompetition,
  nextCompetitionNumber,
} from '@/lib/los/competition'

describe('shouldResetCompetition (LOS-06)', () => {
  it('returns true when exactly one survivor remains', () => {
    expect(shouldResetCompetition(1)).toBe(true)
  })

  it('returns false when multiple survivors remain', () => {
    expect(shouldResetCompetition(2)).toBe(false)
    expect(shouldResetCompetition(10)).toBe(false)
  })

  it('returns false when zero survivors (edge: all eliminated same GW)', () => {
    expect(shouldResetCompetition(0)).toBe(false)
  })
})

describe('nextCompetitionNumber (LOS-06)', () => {
  it('returns 1 when no prior competitions exist', () => {
    expect(nextCompetitionNumber([])).toBe(1)
  })

  it('returns max + 1 for a contiguous set', () => {
    expect(nextCompetitionNumber([1, 2, 3])).toBe(4)
  })

  it('returns max + 1 for a non-contiguous set', () => {
    expect(nextCompetitionNumber([1, 2, 5])).toBe(6)
  })

  it('returns 2 when only competition 1 has run', () => {
    expect(nextCompetitionNumber([1])).toBe(2)
  })
})
