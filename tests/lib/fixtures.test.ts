import { describe, it, expect } from 'vitest'
import {
  formatKickoffTime,
  formatKickoffFull,
  formatKickoffDate,
  getLondonDayOfWeek,
  isMidweekFixture,
  isToday,
} from '@/lib/fixtures/timezone'

// The clock reading is always real Europe/London local time, but the LABEL is
// deliberately "GMT" all year — see the note on getLondonTzAbbr in
// src/lib/fixtures/timezone.ts. These tests assert that decision on purpose;
// they used to expect "BST" in summer and had been failing ever since.

describe('formatKickoffTime', () => {
  it('converts to London local time in summer, labelled GMT', () => {
    // 2025-08-16 is summer, so London is UTC+1: 14:00 UTC = 15:00 local.
    expect(formatKickoffTime('2025-08-16T14:00:00Z')).toBe('15:00 GMT')
  })

  it('returns "14:00 GMT" for UTC winter time (UTC+0)', () => {
    // 2025-01-16 is winter — GMT (UTC+0), so 14:00 UTC = 14:00 GMT
    expect(formatKickoffTime('2025-01-16T14:00:00Z')).toBe('14:00 GMT')
  })
})

describe('formatKickoffFull', () => {
  it('returns "Sat 16 Aug, 15:00 GMT" for a summer Saturday fixture', () => {
    expect(formatKickoffFull('2025-08-16T14:00:00Z')).toBe('Sat 16 Aug, 15:00 GMT')
  })

  it('returns correct format for a winter fixture', () => {
    // 2025-01-18 is a Saturday
    expect(formatKickoffFull('2025-01-18T15:00:00Z')).toBe('Sat 18 Jan, 15:00 GMT')
  })
})

describe('formatKickoffDate', () => {
  it('returns "Sat 16 Aug" for a summer Saturday', () => {
    expect(formatKickoffDate('2025-08-16T14:00:00Z')).toBe('Sat 16 Aug')
  })

  it('returns correct date for a winter fixture', () => {
    expect(formatKickoffDate('2025-01-18T15:00:00Z')).toBe('Sat 18 Jan')
  })
})

describe('getLondonDayOfWeek', () => {
  it('returns 6 for Saturday (2025-08-16)', () => {
    expect(getLondonDayOfWeek('2025-08-16T14:00:00Z')).toBe(6)
  })

  it('returns 2 for Tuesday (2025-08-19)', () => {
    expect(getLondonDayOfWeek('2025-08-19T19:00:00Z')).toBe(2)
  })

  it('returns 1 for Monday', () => {
    // 2025-08-18 is a Monday
    expect(getLondonDayOfWeek('2025-08-18T19:00:00Z')).toBe(1)
  })

  it('returns 7 for Sunday', () => {
    // 2025-08-17 is a Sunday
    expect(getLondonDayOfWeek('2025-08-17T14:00:00Z')).toBe(7)
  })
})

describe('isMidweekFixture', () => {
  it('returns true for Tuesday (Mon-Thu range)', () => {
    expect(isMidweekFixture('2025-08-19T19:00:00Z')).toBe(true)
  })

  it('returns false for Saturday', () => {
    expect(isMidweekFixture('2025-08-16T14:00:00Z')).toBe(false)
  })

  it('returns false for Sunday', () => {
    expect(isMidweekFixture('2025-08-17T14:00:00Z')).toBe(false)
  })

  it('returns false for Friday', () => {
    // 2025-08-22 is a Friday
    expect(isMidweekFixture('2025-08-22T19:45:00Z')).toBe(false)
  })

  it('returns true for Monday', () => {
    expect(isMidweekFixture('2025-08-18T19:00:00Z')).toBe(true)
  })

  it('returns true for Thursday', () => {
    // 2025-08-21 is a Thursday
    expect(isMidweekFixture('2025-08-21T19:45:00Z')).toBe(true)
  })
})

describe('BST/GMT transition edge case', () => {
  it('correctly handles the last Sunday of October 2025 (GMT switch at 1:00 UTC)', () => {
    // 2025-10-26 is the last Sunday in October — clocks go back at 1:00 UTC
    // A fixture at 14:00 UTC on 2025-10-26 is after the switch so it shows GMT
    expect(formatKickoffTime('2025-10-26T14:00:00Z')).toBe('14:00 GMT')
  })

  it('still applies the +1 offset before the 26 Oct switch', () => {
    // Before 1:00 UTC on 2025-10-26 the London offset is still UTC+1,
    // so 00:30 UTC reads 01:30 local (labelled GMT by design).
    expect(formatKickoffTime('2025-10-26T00:30:00Z')).toBe('01:30 GMT')
  })

  it('applies the +1 offset after the spring-forward switch', () => {
    // 2025-03-30 is spring forward — clocks go forward at 1:00 UTC,
    // so 13:00 UTC reads 14:00 local (labelled GMT by design).
    expect(formatKickoffTime('2025-03-30T13:00:00Z')).toBe('14:00 GMT')
  })
})
