/**
 * Tests for mid-season import parsing utilities.
 *
 * Covers:
 * - parseImportText: parses comma/tab-separated name,points rows
 * - parsePreSeasonPicksText: parses 13-column pre-season picks rows
 */
import { describe, it, expect } from 'vitest'
import { parseImportText, parsePreSeasonPicksText } from '@/lib/import/parse'

// ─── parseImportText ──────────────────────────────────────────────────────────

describe('parseImportText', () => {
  it('parses comma-separated rows correctly', () => {
    const result = parseImportText('Big Steve, 340\nDan The Man, 280')
    expect(result.errors).toHaveLength(0)
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toEqual({ display_name: 'Big Steve', starting_points: 340 })
    expect(result.rows[1]).toEqual({ display_name: 'Dan The Man', starting_points: 280 })
  })

  it('parses tab-separated rows correctly', () => {
    const result = parseImportText('Big Steve\t340\nDan The Man\t280')
    expect(result.errors).toHaveLength(0)
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toEqual({ display_name: 'Big Steve', starting_points: 340 })
    expect(result.rows[1]).toEqual({ display_name: 'Dan The Man', starting_points: 280 })
  })

  it('handles mixed comma and tab separators across lines', () => {
    const result = parseImportText('Big Steve, 340\nDan The Man\t280')
    expect(result.errors).toHaveLength(0)
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toEqual({ display_name: 'Big Steve', starting_points: 340 })
    expect(result.rows[1]).toEqual({ display_name: 'Dan The Man', starting_points: 280 })
  })

  it('trims whitespace from names and handles extra blank lines', () => {
    const result = parseImportText('  Big Steve  ,  340  \n\n  Dan The Man  ,  280  \n\n')
    expect(result.errors).toHaveLength(0)
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toEqual({ display_name: 'Big Steve', starting_points: 340 })
    expect(result.rows[1]).toEqual({ display_name: 'Dan The Man', starting_points: 280 })
  })

  it('rejects rows with empty name', () => {
    const result = parseImportText(', 340')
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].line).toBe(1)
    expect(result.errors[0].message).toMatch(/name/i)
    expect(result.rows).toHaveLength(0)
  })

  it('rejects rows with negative points', () => {
    const result = parseImportText('Big Steve, -10')
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].line).toBe(1)
    expect(result.errors[0].message).toMatch(/Invalid points/i)
    expect(result.rows).toHaveLength(0)
  })

  it('rejects rows with non-integer (decimal) points', () => {
    const result = parseImportText('Big Steve, 340.5')
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].line).toBe(1)
    expect(result.errors[0].message).toMatch(/Invalid points/i)
    expect(result.rows).toHaveLength(0)
  })

  it('rejects rows with non-numeric points', () => {
    const result = parseImportText('Big Steve, abc')
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].line).toBe(1)
    expect(result.errors[0].message).toMatch(/Invalid points/i)
    expect(result.rows).toHaveLength(0)
  })

  it('detects duplicate names (case-insensitive)', () => {
    const result = parseImportText('Big Steve, 340\nbig steve, 280')
    expect(result.errors.some(e => e.message.toLowerCase().includes('duplicate'))).toBe(true)
  })

  it('returns no-data error for empty input', () => {
    const result = parseImportText('')
    expect(result.rows).toHaveLength(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].line).toBe(-1)
    expect(result.errors[0].message).toMatch(/no data/i)
  })

  it('returns no-data error for whitespace-only input', () => {
    const result = parseImportText('   \n\n  \t  ')
    expect(result.rows).toHaveLength(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].line).toBe(-1)
    expect(result.errors[0].message).toMatch(/no data/i)
  })

  it('handles a single valid row', () => {
    const result = parseImportText('Big Steve, 340')
    expect(result.errors).toHaveLength(0)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toEqual({ display_name: 'Big Steve', starting_points: 340 })
  })

  it('handles 48 rows (realistic import size)', () => {
    const lines = Array.from({ length: 48 }, (_, i) => `Member ${i + 1}, ${(i + 1) * 10}`)
    const result = parseImportText(lines.join('\n'))
    expect(result.errors).toHaveLength(0)
    expect(result.rows).toHaveLength(48)
    expect(result.rows[0]).toEqual({ display_name: 'Member 1', starting_points: 10 })
    expect(result.rows[47]).toEqual({ display_name: 'Member 48', starting_points: 480 })
  })

  it('allows zero points', () => {
    const result = parseImportText('New Member, 0')
    expect(result.errors).toHaveLength(0)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toEqual({ display_name: 'New Member', starting_points: 0 })
  })
})

// ─── parsePreSeasonPicksText ──────────────────────────────────────────────────

describe('parsePreSeasonPicksText', () => {
  const VALID_13_COL_ROW =
    'Big Steve, Man City, Arsenal, Liverpool, Chelsea, Man Utd, Burnley, Luton, Sheffield Utd, Ipswich, Plymouth, Southampton, Coventry'

  it('parses 13-column rows correctly', () => {
    const result = parsePreSeasonPicksText(VALID_13_COL_ROW)
    expect(result.errors).toHaveLength(0)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toEqual({
      member_name: 'Big Steve',
      top4: ['Man City', 'Arsenal', 'Liverpool', 'Chelsea'],
      tenth_place: 'Man Utd',
      relegated: ['Burnley', 'Luton', 'Sheffield Utd'],
      promoted: ['Ipswich', 'Plymouth', 'Southampton'],
      promoted_playoff_winner: 'Coventry',
    })
  })

  it('parses multiple rows correctly', () => {
    const text = [
      'Big Steve, Man City, Arsenal, Liverpool, Chelsea, Man Utd, Burnley, Luton, Sheffield Utd, Ipswich, Plymouth, Southampton, Coventry',
      'Dan The Man, Arsenal, Liverpool, Man City, Tottenham, Newcastle, Burnley, Luton, Sheffield Utd, Ipswich, Plymouth, Southampton, Coventry',
    ].join('\n')
    const result = parsePreSeasonPicksText(text)
    expect(result.errors).toHaveLength(0)
    expect(result.rows).toHaveLength(2)
    expect(result.rows[1].member_name).toBe('Dan The Man')
    expect(result.rows[1].top4).toEqual(['Arsenal', 'Liverpool', 'Man City', 'Tottenham'])
  })

  it('rejects rows with fewer than 13 columns', () => {
    const result = parsePreSeasonPicksText('Big Steve, Man City, Arsenal')
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].line).toBe(1)
    expect(result.errors[0].message).toMatch(/13/i)
    expect(result.rows).toHaveLength(0)
  })

  it('rejects rows with empty fields', () => {
    const rowWithEmpty =
      'Big Steve, Man City, , Liverpool, Chelsea, Man Utd, Burnley, Luton, Sheffield Utd, Ipswich, Plymouth, Southampton, Coventry'
    const result = parsePreSeasonPicksText(rowWithEmpty)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].line).toBe(1)
    expect(result.errors[0].message).toMatch(/empty/i)
    expect(result.rows).toHaveLength(0)
  })

  it('detects duplicate member names', () => {
    const text = [
      'Big Steve, Man City, Arsenal, Liverpool, Chelsea, Man Utd, Burnley, Luton, Sheffield Utd, Ipswich, Plymouth, Southampton, Coventry',
      'big steve, Arsenal, Liverpool, Man City, Tottenham, Newcastle, Burnley, Luton, Sheffield Utd, Ipswich, Plymouth, Southampton, Coventry',
    ].join('\n')
    const result = parsePreSeasonPicksText(text)
    expect(result.errors.some(e => e.message.toLowerCase().includes('duplicate'))).toBe(true)
  })

  it('returns no-data error for empty input', () => {
    const result = parsePreSeasonPicksText('')
    expect(result.rows).toHaveLength(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].line).toBe(-1)
    expect(result.errors[0].message).toMatch(/no data/i)
  })

  it('handles tab-separated columns', () => {
    const tabRow =
      'Big Steve\tMan City\tArsenal\tLiverpool\tChelsea\tMan Utd\tBurnley\tLuton\tSheffield Utd\tIpswich\tPlymouth\tSouthampton\tCoventry'
    const result = parsePreSeasonPicksText(tabRow)
    expect(result.errors).toHaveLength(0)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].member_name).toBe('Big Steve')
  })
})
