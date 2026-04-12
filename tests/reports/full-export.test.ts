/**
 * Full-season export XLSX tests.
 *
 * buildFullExportXlsx is PURE (no DB). gatherFullExportData touches the DB
 * and is the only async function in this module — tested via Plan 03 later.
 */
import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'

import { buildFullExportXlsx } from '@/lib/reports/full-export-xlsx'
import { mockFullSeasonData } from './fixtures/gameweek-data'

describe('buildFullExportXlsx', () => {
  it('returns a valid Buffer — XLSX.read opens cleanly (DATA-04)', () => {
    const buf = buildFullExportXlsx(mockFullSeasonData())
    expect(Buffer.isBuffer(buf) || buf instanceof Uint8Array).toBe(true)
    // This is the DATA-04 smoke test — file must not be "corrupted".
    const wb = XLSX.read(buf, { type: 'buffer' })
    expect(wb.SheetNames.length).toBeGreaterThan(0)
  })

  it('has every expected sheet', () => {
    const buf = buildFullExportXlsx(mockFullSeasonData())
    const wb = XLSX.read(buf, { type: 'buffer' })
    expect(wb.SheetNames).toEqual([
      'README',
      'Members',
      'Fixtures',
      'Standings by GW',
      'Predictions (All GWs)',
      'Scores (All GWs)',
      'Bonuses (All GWs)',
      'LOS History',
      'H2H History',
      'Pre-Season Picks',
      'Pre-Season Awards',
    ])
  })

  it('README has title + manual-run instructions (at least 3 lines)', () => {
    const buf = buildFullExportXlsx(mockFullSeasonData())
    const wb = XLSX.read(buf, { type: 'buffer' })
    const readme: string[][] = XLSX.utils.sheet_to_json(wb.Sheets.README, {
      header: 1,
      defval: '',
    })
    expect(readme[0]?.[0]).toBe("George's Predictor — Full Season Export")
    // Count non-empty content rows (instructions) after the title/metadata.
    const contentRows = readme
      .slice(2)
      .filter((r) => r.some((c) => String(c).trim().length > 0))
    expect(contentRows.length).toBeGreaterThanOrEqual(3)
  })

  it('Predictions (All GWs) row count = gwCount × memberCount × fixturesPerGw', () => {
    const data = mockFullSeasonData()
    const buf = buildFullExportXlsx(data)
    const wb = XLSX.read(buf, { type: 'buffer' })
    const rows: unknown[] = XLSX.utils.sheet_to_json(
      wb.Sheets['Predictions (All GWs)'],
    )
    // Each mock gw has 10 members × 5 predictions each = 50 rows × 3 gw = 150
    const expected = data.gameweeks.reduce((sum, gw) => {
      return (
        sum +
        Object.values(gw.predictionsByMember).reduce(
          (s, arr) => s + arr.length,
          0,
        )
      )
    }, 0)
    expect(rows.length).toBe(expected)
  })

  it('Pre-Season Awards sheet round-trips with confirmed boolean + calculated/awarded points', () => {
    const data = mockFullSeasonData()
    const buf = buildFullExportXlsx(data)
    const wb = XLSX.read(buf, { type: 'buffer' })
    const rows: Array<Record<string, unknown>> = XLSX.utils.sheet_to_json(
      wb.Sheets['Pre-Season Awards'],
    )
    expect(rows.length).toBe(data.preSeasonAwards.length)
    const first = rows[0]
    expect(first).toHaveProperty('Display Name')
    expect(first).toHaveProperty('Calculated Points')
    expect(first).toHaveProperty('Awarded Points')
    expect(first).toHaveProperty('Confirmed')
  })
})
