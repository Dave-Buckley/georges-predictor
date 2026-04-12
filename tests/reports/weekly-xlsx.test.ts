/**
 * Weekly admin XLSX + kickoff backup XLSX builder tests.
 *
 * Round-trip pattern: buildXxxXlsx(data) → Buffer → XLSX.read(buffer) → inspect.
 */
import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'

import { buildWeeklyAdminXlsx } from '@/lib/reports/weekly-xlsx'
import { buildKickoffBackupXlsx } from '@/lib/reports/kickoff-backup-xlsx'
import { mockGameweekData } from './fixtures/gameweek-data'

describe('buildWeeklyAdminXlsx', () => {
  it('returns a Buffer parseable by XLSX.read', () => {
    const buf = buildWeeklyAdminXlsx(mockGameweekData())
    expect(Buffer.isBuffer(buf) || buf instanceof Uint8Array).toBe(true)
    const wb = XLSX.read(buf, { type: 'buffer' })
    expect(wb.SheetNames.length).toBeGreaterThan(0)
  })

  it('has the expected sheet set', () => {
    const buf = buildWeeklyAdminXlsx(mockGameweekData())
    const wb = XLSX.read(buf, { type: 'buffer' })
    // Exactly these sheets (pre-season appears only in full-export)
    expect(wb.SheetNames).toEqual([
      'README',
      'Standings',
      'Predictions',
      'Scores',
      'Bonuses',
      'LOS',
      'H2H',
    ])
  })

  it('README row 1 is the report title and includes George\'s double-check reminder', () => {
    const buf = buildWeeklyAdminXlsx(mockGameweekData())
    const wb = XLSX.read(buf, { type: 'buffer' })
    const readme: string[][] = XLSX.utils.sheet_to_json(wb.Sheets.README, {
      header: 1,
      defval: '',
    })
    expect(readme[0]?.[0]).toBe("George's Predictor — Weekly Admin Report")
    // Somewhere in the first 10 rows we expect the "double-check" reminder.
    const body = readme.slice(0, 10).map((r) => r.join(' ')).join('\n')
    expect(body).toMatch(/double-check API scores weekly/i)
  })

  it('Standings sheet has header + one row per member', () => {
    const data = mockGameweekData()
    const buf = buildWeeklyAdminXlsx(data)
    const wb = XLSX.read(buf, { type: 'buffer' })
    const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets.Standings, {
      header: 1,
      defval: '',
    })
    // header row + 10 members
    expect(rows.length).toBe(data.standings.length + 1)
    const header = (rows[0] as string[]).map((h) => String(h))
    expect(header).toEqual(
      expect.arrayContaining(['Rank', 'Display Name', 'Total Points', 'Weekly Points']),
    )
  })

  it('Predictions sheet has one row per (member × fixture)', () => {
    const data = mockGameweekData()
    const buf = buildWeeklyAdminXlsx(data)
    const wb = XLSX.read(buf, { type: 'buffer' })
    const rows: unknown[] = XLSX.utils.sheet_to_json(wb.Sheets.Predictions)
    // Mock seeds 10 members × 5 fixtures (first 5) = 50 rows
    const expected = Object.values(data.predictionsByMember).reduce(
      (sum, arr) => sum + arr.length,
      0,
    )
    expect(rows.length).toBe(expected)
  })

  it('Scores sheet includes calculation breakdown columns', () => {
    const buf = buildWeeklyAdminXlsx(mockGameweekData())
    const wb = XLSX.read(buf, { type: 'buffer' })
    const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets.Scores, {
      header: 1,
      defval: '',
    })
    const header = (rows[0] as string[]).map((h) => String(h))
    expect(header).toEqual(
      expect.arrayContaining([
        'Base Points',
        'Bonus Points',
        'Double Bubble Multiplier',
        'Total',
      ]),
    )
  })

  it('Bonuses sheet separates pending / confirmed / rejected via status column', () => {
    // Build a mock with all three states
    const data = mockGameweekData()
    data.bonus.pickByMember['m-1'] = { fixtureId: 'fix-3', awarded: null }
    data.bonus.pickByMember['m-2'] = { fixtureId: 'fix-3', awarded: true }
    data.bonus.pickByMember['m-3'] = { fixtureId: 'fix-3', awarded: false }
    const buf = buildWeeklyAdminXlsx(data)
    const wb = XLSX.read(buf, { type: 'buffer' })
    const rows: Array<Record<string, unknown>> = XLSX.utils.sheet_to_json(
      wb.Sheets.Bonuses,
    )
    const statuses = new Set(rows.map((r) => r.Status))
    expect(statuses.has('pending')).toBe(true)
    expect(statuses.has('confirmed')).toBe(true)
    expect(statuses.has('rejected')).toBe(true)
  })

  it('H2H sheet resolves winner displayName', () => {
    const data = mockGameweekData({
      h2hSteals: [
        {
          detectedInGwId: 'gw-1',
          resolvesInGwId: 'gw-2',
          resolvedAt: null,
          position: 1,
          memberIds: ['m-1', 'm-2'],
          winnerId: 'm-1',
        },
      ],
    })
    const buf = buildWeeklyAdminXlsx(data)
    const wb = XLSX.read(buf, { type: 'buffer' })
    const rows: Array<Record<string, unknown>> = XLSX.utils.sheet_to_json(
      wb.Sheets.H2H,
    )
    expect(rows.length).toBeGreaterThan(0)
    const first = rows[0]
    expect(first).toHaveProperty('Position')
    // Winner resolved to displayName not UUID
    expect(first.Winner).toBe('Member A')
  })
})

describe('buildKickoffBackupXlsx', () => {
  it('returns a Buffer with the expected sheets', () => {
    const buf = buildKickoffBackupXlsx(mockGameweekData())
    const wb = XLSX.read(buf, { type: 'buffer' })
    expect(wb.SheetNames).toEqual([
      'README',
      'Predictions',
      'LOS Picks',
      'Bonus Picks',
    ])
  })

  it('README rows 1 + 3 carry kickoff-backup framing', () => {
    const data = mockGameweekData()
    const buf = buildKickoffBackupXlsx(data)
    const wb = XLSX.read(buf, { type: 'buffer' })
    const readme: string[][] = XLSX.utils.sheet_to_json(wb.Sheets.README, {
      header: 1,
      defval: '',
    })
    expect(readme[0]?.[0]).toBe(`Kickoff Backup — GW${data.gwNumber}`)
    // row 3 (index 2) should mention "locked"
    const row3 = (readme[2] ?? []).join(' ')
    expect(row3).toMatch(/locked/i)
  })

  it('Predictions sheet uses long format (row per member × fixture)', () => {
    const data = mockGameweekData()
    const buf = buildKickoffBackupXlsx(data)
    const wb = XLSX.read(buf, { type: 'buffer' })
    const rows: unknown[] = XLSX.utils.sheet_to_json(wb.Sheets.Predictions)
    const expected = Object.values(data.predictionsByMember).reduce(
      (sum, arr) => sum + arr.length,
      0,
    )
    expect(rows.length).toBe(expected)
  })
})
