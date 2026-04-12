/**
 * Kickoff backup XLSX — predictions locked as of first fixture kickoff.
 * Pure, synchronous. Sheets: README, Predictions, LOS Picks, Bonus Picks.
 */
import * as XLSX from 'xlsx'

import type { GameweekReportData } from './_data/gather-gameweek-data'

export function buildKickoffBackupXlsx(data: GameweekReportData): Buffer {
  const wb = XLSX.utils.book_new()
  const displayById = new Map(
    data.standings.map((s) => [s.memberId, s.displayName]),
  )
  const fixturesById = new Map(data.fixtures.map((f) => [f.id, f]))

  // README
  const readmeAoa: (string | number)[][] = [
    [`Kickoff Backup — GW${data.gwNumber}`],
    [`Season ${data.seasonLabel}`],
    [
      'All predictions locked as of first fixture kickoff. If the site goes down, this workbook contains everything needed to run the gameweek manually.',
    ],
    [''],
    ['Sheets: Predictions / LOS Picks / Bonus Picks.'],
  ]
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(readmeAoa),
    'README',
  )

  // Predictions — long format (row per member × fixture)
  const predRows: Array<Record<string, unknown>> = []
  for (const [memberId, preds] of Object.entries(data.predictionsByMember)) {
    for (const p of preds) {
      const f = fixturesById.get(p.fixtureId)
      predRows.push({
        Member: displayById.get(memberId) ?? memberId,
        Fixture: f ? `${f.home} vs ${f.away}` : p.fixtureId,
        'Home Pred': p.homePrediction,
        'Away Pred': p.awayPrediction,
      })
    }
  }
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(predRows),
    'Predictions',
  )

  // LOS Picks
  const losRows = data.losStatus
    .filter((l) => l.teamPicked)
    .map((l) => ({
      Member: displayById.get(l.memberId) ?? l.memberId,
      'Team Picked': l.teamPicked ?? '',
    }))
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(losRows),
    'LOS Picks',
  )

  // Bonus Picks
  const bonusRows: Array<Record<string, unknown>> = []
  for (const [memberId, pick] of Object.entries(data.bonus.pickByMember)) {
    if (!pick.fixtureId) continue
    const f = fixturesById.get(pick.fixtureId)
    bonusRows.push({
      Member: displayById.get(memberId) ?? memberId,
      Fixture: f ? `${f.home} vs ${f.away}` : pick.fixtureId,
      'Bonus Type': data.bonus.type ?? '',
    })
  }
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(bonusRows),
    'Bonus Picks',
  )

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return Buffer.isBuffer(buf) ? buf : Buffer.from(buf as Uint8Array)
}
