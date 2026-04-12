/**
 * Weekly admin XLSX builder — pure, synchronous.
 *
 * Sheets: README, Standings, Predictions, Scores, Bonuses, LOS, H2H.
 * Consumes GameweekReportData. No DB, no side effects.
 */
import * as XLSX from 'xlsx'

import type { GameweekReportData } from './_data/gather-gameweek-data'

/**
 * Build the weekly admin XLSX report buffer.
 *
 * README row 4 carries George's "double-check API scores weekly" reminder
 * (project memory — weekly guide note).
 */
export function buildWeeklyAdminXlsx(data: GameweekReportData): Buffer {
  const wb = XLSX.utils.book_new()
  const displayById = new Map(
    data.standings.map((s) => [s.memberId, s.displayName]),
  )

  // ─── README ────────────────────────────────────────────────────────────────
  const readmeAoa: (string | number)[][] = [
    ["George's Predictor — Weekly Admin Report"],
    [`GW ${data.gwNumber} • Season ${data.seasonLabel}`],
    [
      `Generated for admin review${data.closedAtIso ? ` • Closed ${data.closedAtIso}` : ''}`,
    ],
    [
      'Reminder: double-check API scores weekly — you can edit any score in the admin panel if the API is wrong.',
    ],
    [''],
    ['Sheets:'],
    ['  Standings — rank, name, totals, weekly.'],
    ['  Predictions — one row per (member × fixture).'],
    ['  Scores — breakdown (base + bonus + Double Bubble).'],
    ['  Bonuses — pending/confirmed/rejected state.'],
    ['  LOS — per-member team + survived/eliminated.'],
    ['  H2H — detected + resolving steals this GW.'],
  ]
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(readmeAoa),
    'README',
  )

  // ─── Standings ─────────────────────────────────────────────────────────────
  const standingsRows = data.standings.map((s) => ({
    Rank: s.rank,
    'Display Name': s.displayName,
    'Total Points': s.totalPoints,
    'Weekly Points': s.weeklyPoints,
  }))
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(standingsRows, {
      header: ['Rank', 'Display Name', 'Total Points', 'Weekly Points'],
    }),
    'Standings',
  )

  // ─── Predictions ───────────────────────────────────────────────────────────
  const fixturesById = new Map(data.fixtures.map((f) => [f.id, f]))
  const predictionRows: Array<Record<string, unknown>> = []
  for (const [memberId, preds] of Object.entries(data.predictionsByMember)) {
    for (const p of preds) {
      const f = fixturesById.get(p.fixtureId)
      predictionRows.push({
        Member: displayById.get(memberId) ?? memberId,
        Fixture: f ? `${f.home} vs ${f.away}` : p.fixtureId,
        'Home Pred': p.homePrediction,
        'Away Pred': p.awayPrediction,
        'Home Actual': f?.homeScore ?? '',
        'Away Actual': f?.awayScore ?? '',
        Points: p.pointsAwarded,
        'Bonus Fixture': p.isBonusFixture ? 'yes' : '',
      })
    }
  }
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(predictionRows),
    'Predictions',
  )

  // ─── Scores (breakdown per member) ─────────────────────────────────────────
  const multiplier = data.doubleBubbleActive ? 2 : 1
  const scoreRows = data.standings.map((s) => {
    const preds = data.predictionsByMember[s.memberId] ?? []
    const base = preds.reduce((sum, p) => sum + p.pointsAwarded, 0)
    const bonus = preds.reduce((sum, p) => sum + p.bonusPointsAwarded, 0)
    return {
      Member: s.displayName,
      'Base Points': base,
      'Bonus Points': bonus,
      'Double Bubble Multiplier': multiplier,
      Total: (base + bonus) * multiplier,
    }
  })
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(scoreRows, {
      header: [
        'Member',
        'Base Points',
        'Bonus Points',
        'Double Bubble Multiplier',
        'Total',
      ],
    }),
    'Scores',
  )

  // ─── Bonuses (pending/confirmed/rejected) ──────────────────────────────────
  const bonusRows: Array<Record<string, unknown>> = []
  for (const [memberId, pick] of Object.entries(data.bonus.pickByMember)) {
    if (!pick.fixtureId) continue
    const status =
      pick.awarded === true
        ? 'confirmed'
        : pick.awarded === false
          ? 'rejected'
          : 'pending'
    const f = fixturesById.get(pick.fixtureId)
    bonusRows.push({
      Member: displayById.get(memberId) ?? memberId,
      Fixture: f ? `${f.home} vs ${f.away}` : pick.fixtureId,
      'Bonus Type': data.bonus.type ?? '',
      Status: status,
    })
  }
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(bonusRows),
    'Bonuses',
  )

  // ─── LOS ───────────────────────────────────────────────────────────────────
  const losRows = data.losStatus.map((l) => ({
    Member: displayById.get(l.memberId) ?? l.memberId,
    'Team Picked': l.teamPicked ?? '',
    Survived:
      l.survived === true ? 'yes' : l.survived === false ? 'no' : 'pending',
    Eliminated: l.eliminated ? 'yes' : '',
  }))
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(losRows),
    'LOS',
  )

  // ─── H2H ───────────────────────────────────────────────────────────────────
  const h2hRows = data.h2hSteals.map((s) => ({
    Position: s.position,
    Members: s.memberIds
      .map((id) => displayById.get(id) ?? id)
      .join(', '),
    'Detected In GW': s.detectedInGwId,
    'Resolves In GW': s.resolvesInGwId ?? '',
    Winner: s.winnerId ? (displayById.get(s.winnerId) ?? s.winnerId) : '',
    'Resolved At': s.resolvedAt ?? '',
  }))
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(h2hRows, {
      header: [
        'Position',
        'Members',
        'Detected In GW',
        'Resolves In GW',
        'Winner',
        'Resolved At',
      ],
    }),
    'H2H',
  )

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return Buffer.isBuffer(buf) ? buf : Buffer.from(buf as Uint8Array)
}
