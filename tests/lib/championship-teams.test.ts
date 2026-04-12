/**
 * Tests for the hardcoded 2025-26 Championship team list.
 *
 * Rules (locked per CONTEXT.md):
 *   - 24 teams exactly
 *   - isChampionshipTeam() is case-insensitive + trim
 *   - Source-list for pre-season "promoted" + "playoff winner" picks
 */
import { describe, it, expect } from 'vitest'
import {
  CHAMPIONSHIP_TEAMS_2025_26,
  isChampionshipTeam,
} from '@/lib/teams/championship-2025-26'

describe('CHAMPIONSHIP_TEAMS_2025_26', () => {
  it('contains exactly 24 teams', () => {
    expect(CHAMPIONSHIP_TEAMS_2025_26).toHaveLength(24)
  })

  it('all entries are non-empty strings', () => {
    for (const team of CHAMPIONSHIP_TEAMS_2025_26) {
      expect(typeof team).toBe('string')
      expect(team.trim().length).toBeGreaterThan(0)
    }
  })

  it('contains no duplicate team names (after normalisation)', () => {
    const normalised = CHAMPIONSHIP_TEAMS_2025_26.map((t) => t.trim().toLowerCase())
    expect(new Set(normalised).size).toBe(24)
  })
})

describe('isChampionshipTeam', () => {
  it('returns true for a known Championship team ("Leeds United")', () => {
    expect(isChampionshipTeam('Leeds United')).toBe(true)
  })

  it('returns false for a Premier League team ("Arsenal")', () => {
    expect(isChampionshipTeam('Arsenal')).toBe(false)
  })

  it('is case-insensitive ("leeds united" matches "Leeds United")', () => {
    expect(isChampionshipTeam('leeds united')).toBe(true)
    expect(isChampionshipTeam('LEEDS UNITED')).toBe(true)
  })

  it('trims whitespace ("  Leeds United  " matches)', () => {
    expect(isChampionshipTeam('  Leeds United  ')).toBe(true)
  })

  it('returns false for empty / whitespace-only input', () => {
    expect(isChampionshipTeam('')).toBe(false)
    expect(isChampionshipTeam('   ')).toBe(false)
  })

  it('returns false for unrelated strings', () => {
    expect(isChampionshipTeam('Real Madrid')).toBe(false)
    expect(isChampionshipTeam('Not A Team')).toBe(false)
  })
})
