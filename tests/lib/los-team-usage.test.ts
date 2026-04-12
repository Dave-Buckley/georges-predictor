import { describe, it, expect } from 'vitest'
import { availableTeams } from '@/lib/los/team-usage'

const ALL_20 = Array.from({ length: 20 }, (_, i) => `team-${i + 1}`)

describe('availableTeams (LOS-03)', () => {
  it('returns all 20 when no teams have been picked yet', () => {
    const result = availableTeams({ all_team_ids: ALL_20, picked_team_ids: [] })
    expect(result).toHaveLength(20)
    expect(result.sort()).toEqual([...ALL_20].sort())
  })

  it('returns the 15 unpicked teams after 5 have been used', () => {
    const picked = ALL_20.slice(0, 5)
    const result = availableTeams({ all_team_ids: ALL_20, picked_team_ids: picked })
    expect(result).toHaveLength(15)
    expect(result).toEqual(ALL_20.slice(5))
    for (const p of picked) {
      expect(result).not.toContain(p)
    }
  })

  it('returns the 1 remaining team when 19 have been picked', () => {
    const picked = ALL_20.slice(0, 19)
    const result = availableTeams({ all_team_ids: ALL_20, picked_team_ids: picked })
    expect(result).toEqual([ALL_20[19]])
  })

  it('resets to all 20 when every team has been picked (cycle reset)', () => {
    const result = availableTeams({
      all_team_ids: ALL_20,
      picked_team_ids: [...ALL_20],
    })
    expect(result).toHaveLength(20)
    expect(result.sort()).toEqual([...ALL_20].sort())
  })

  it('resets even when picked_team_ids has duplicates that cover the full set', () => {
    // Defensive: a pick history with duplicates still counts as "all 20 used" if the
    // unique picks span the full pool.
    const result = availableTeams({
      all_team_ids: ALL_20,
      picked_team_ids: [...ALL_20, ...ALL_20.slice(0, 5)],
    })
    expect(result).toHaveLength(20)
  })

  it('ignores picked ids not in all_team_ids (no phantom exclusions)', () => {
    const result = availableTeams({
      all_team_ids: ALL_20,
      picked_team_ids: ['not-in-list'],
    })
    expect(result).toHaveLength(20)
  })
})
