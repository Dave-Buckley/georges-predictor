/**
 * Full-season export XLSX builder + gatherer.
 *
 * Two exports:
 *   1. `buildFullExportXlsx(data)`   — PURE, sync. No DB, no side effects.
 *   2. `gatherFullExportData()`      — async DB caller (only function in
 *      this module that touches Supabase). Loops `gatherGameweekData` for
 *      every gameweek in the current season and merges pre-season picks +
 *      awards via the Phase 9 export primitive.
 *
 * Kept together so the shape and the collector evolve in lockstep.
 */
import * as XLSX from 'xlsx'

import { createAdminClient } from '@/lib/supabase/admin'

import {
  gatherGameweekData,
  type GameweekReportData,
} from './_data/gather-gameweek-data'

// ─── Public types ────────────────────────────────────────────────────────────

export interface FullExportData {
  season: string
  gameweeks: GameweekReportData[]
  preSeasonAwards: Array<{
    memberId: string
    displayName: string
    calculatedPoints: number
    awardedPoints: number | null
    confirmed: boolean
    flags: Record<string, boolean>
    picks: Record<string, string | string[]>
  }>
  membersMasterList: Array<{
    id: string
    displayName: string
    email: string
    totalPoints: number
  }>
  fixturesMasterList: Array<{
    gwNumber: number
    fixtureId: string
    home: string
    away: string
    kickoffIso: string
    homeScore: number | null
    awayScore: number | null
    status: string
  }>
  h2hHistory: Array<{
    detectedInGw: number
    resolvesInGw: number | null
    members: string[]
    winner: string | null
    position: number
  }>
  losHistory: Array<{
    memberId: string
    displayName: string
    teamsUsed: string[]
    eliminated: boolean
    eliminatedAtGw: number | null
  }>
  generatedAtIso: string
}

// ─── Pure builder ────────────────────────────────────────────────────────────

export function buildFullExportXlsx(data: FullExportData): Buffer {
  const wb = XLSX.utils.book_new()
  const displayByMemberId = new Map(
    data.membersMasterList.map((m) => [m.id, m.displayName]),
  )

  // ─── README ────────────────────────────────────────────────────────────────
  const readmeAoa: (string | number)[][] = [
    ["George's Predictor — Full Season Export"],
    [`Season ${data.season} • Generated ${data.generatedAtIso}`],
    ['Manual-run instructions:'],
    [
      '  1. If the platform is offline, this workbook contains every prediction, score, LOS pick, bonus pick, and pre-season forecast for the season.',
    ],
    [
      '  2. To continue the competition manually, update scores in the Fixtures sheet and recalculate points using the 10/30 rule (10 for correct outcome, 30 for exact score).',
    ],
    [
      '  3. Bonus awards: confirmed=true rows already count. Pending rows need George to mark awarded (or not) before doubling.',
    ],
    [
      '  4. Double Bubble multiplier is 2x — applied to (base + bonus) per gameweek when active.',
    ],
    [
      '  5. LOS: track teamsUsed per member. On elimination, set eliminated=yes + eliminatedAtGw.',
    ],
    [''],
    ['Sheets follow in this order:'],
    [
      '  Members / Fixtures / Standings by GW / Predictions (All GWs) / Scores (All GWs) / Bonuses (All GWs) / LOS History / H2H History / Pre-Season Picks / Pre-Season Awards',
    ],
  ]
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(readmeAoa),
    'README',
  )

  // ─── Members ───────────────────────────────────────────────────────────────
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      data.membersMasterList.map((m) => ({
        'Member ID': m.id,
        'Display Name': m.displayName,
        Email: m.email,
        'Season Total': m.totalPoints,
      })),
    ),
    'Members',
  )

  // ─── Fixtures ──────────────────────────────────────────────────────────────
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      data.fixturesMasterList.map((f) => ({
        GW: f.gwNumber,
        'Fixture ID': f.fixtureId,
        Home: f.home,
        Away: f.away,
        'Kickoff (ISO)': f.kickoffIso,
        'Home Score': f.homeScore ?? '',
        'Away Score': f.awayScore ?? '',
        Status: f.status,
      })),
    ),
    'Fixtures',
  )

  // ─── Standings by GW ───────────────────────────────────────────────────────
  const standingsRows: Array<Record<string, unknown>> = []
  for (const gw of data.gameweeks) {
    for (const s of gw.standings) {
      standingsRows.push({
        GW: gw.gwNumber,
        Rank: s.rank,
        'Display Name': s.displayName,
        'Total Points': s.totalPoints,
        'Weekly Points': s.weeklyPoints,
      })
    }
  }
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(standingsRows),
    'Standings by GW',
  )

  // ─── Predictions (All GWs) ─────────────────────────────────────────────────
  const predRows: Array<Record<string, unknown>> = []
  for (const gw of data.gameweeks) {
    const fxById = new Map(gw.fixtures.map((f) => [f.id, f]))
    const displayInGw = new Map(
      gw.standings.map((s) => [s.memberId, s.displayName]),
    )
    for (const [memberId, preds] of Object.entries(gw.predictionsByMember)) {
      for (const p of preds) {
        const f = fxById.get(p.fixtureId)
        predRows.push({
          GW: gw.gwNumber,
          Member: displayInGw.get(memberId) ?? memberId,
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
  }
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(predRows),
    'Predictions (All GWs)',
  )

  // ─── Scores (All GWs) ──────────────────────────────────────────────────────
  const scoreRows: Array<Record<string, unknown>> = []
  for (const gw of data.gameweeks) {
    const multiplier = gw.doubleBubbleActive ? 2 : 1
    for (const s of gw.standings) {
      const preds = gw.predictionsByMember[s.memberId] ?? []
      const base = preds.reduce((sum, p) => sum + p.pointsAwarded, 0)
      const bonus = preds.reduce((sum, p) => sum + p.bonusPointsAwarded, 0)
      scoreRows.push({
        GW: gw.gwNumber,
        Member: s.displayName,
        'Base Points': base,
        'Bonus Points': bonus,
        'Double Bubble Multiplier': multiplier,
        Total: (base + bonus) * multiplier,
      })
    }
  }
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(scoreRows),
    'Scores (All GWs)',
  )

  // ─── Bonuses (All GWs) ─────────────────────────────────────────────────────
  const bonusRows: Array<Record<string, unknown>> = []
  for (const gw of data.gameweeks) {
    const fxById = new Map(gw.fixtures.map((f) => [f.id, f]))
    const displayInGw = new Map(
      gw.standings.map((s) => [s.memberId, s.displayName]),
    )
    for (const [memberId, pick] of Object.entries(gw.bonus.pickByMember)) {
      if (!pick.fixtureId) continue
      const status =
        pick.awarded === true
          ? 'confirmed'
          : pick.awarded === false
            ? 'rejected'
            : 'pending'
      const f = fxById.get(pick.fixtureId)
      bonusRows.push({
        GW: gw.gwNumber,
        Member: displayInGw.get(memberId) ?? memberId,
        Fixture: f ? `${f.home} vs ${f.away}` : pick.fixtureId,
        'Bonus Type': gw.bonus.type ?? '',
        Status: status,
      })
    }
  }
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(bonusRows),
    'Bonuses (All GWs)',
  )

  // ─── LOS History ───────────────────────────────────────────────────────────
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      data.losHistory.map((l) => ({
        Member: l.displayName,
        'Teams Used': l.teamsUsed.join(', '),
        Eliminated: l.eliminated ? 'yes' : '',
        'Eliminated At GW': l.eliminatedAtGw ?? '',
      })),
    ),
    'LOS History',
  )

  // ─── H2H History ───────────────────────────────────────────────────────────
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      data.h2hHistory.map((h) => ({
        'Detected In GW': h.detectedInGw,
        'Resolves In GW': h.resolvesInGw ?? '',
        Position: h.position,
        Members: h.members
          .map((id) => displayByMemberId.get(id) ?? id)
          .join(', '),
        Winner: h.winner
          ? (displayByMemberId.get(h.winner) ?? h.winner)
          : '',
      })),
    ),
    'H2H History',
  )

  // ─── Pre-Season Picks ──────────────────────────────────────────────────────
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      data.preSeasonAwards.map((a) => ({
        Member: a.displayName,
        ...Object.fromEntries(
          Object.entries(a.picks).map(([k, v]) => [
            k,
            Array.isArray(v) ? v.join(', ') : v,
          ]),
        ),
      })),
    ),
    'Pre-Season Picks',
  )

  // ─── Pre-Season Awards ─────────────────────────────────────────────────────
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      data.preSeasonAwards.map((a) => ({
        'Display Name': a.displayName,
        'Calculated Points': a.calculatedPoints,
        'Awarded Points': a.awardedPoints ?? '',
        Confirmed: a.confirmed ? 'yes' : '',
        ...Object.fromEntries(
          Object.entries(a.flags).map(([k, v]) => [`Flag: ${k}`, v ? 'yes' : '']),
        ),
      })),
    ),
    'Pre-Season Awards',
  )

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return Buffer.isBuffer(buf) ? buf : Buffer.from(buf as Uint8Array)
}

// ─── DB-touching gatherer (the ONLY async function in this module) ──────────

/**
 * Builds a FullExportData snapshot for the current season.
 *
 * NOTE: This is the only DB-touching function in this module; `buildFullExportXlsx`
 * is pure and fully unit-testable without mocks.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export async function gatherFullExportData(): Promise<FullExportData> {
  const admin = createAdminClient()

  // Find the current season from the latest gameweek row.
  const { data: latestGw } = await admin
    .from('gameweeks')
    .select('season')
    .order('season', { ascending: false })
    .limit(1)
    .maybeSingle()

  const season: number = (latestGw as { season?: number } | null)?.season ?? 0
  const seasonLabel = season
    ? `${season}-${String((season + 1) % 100).padStart(2, '0')}`
    : ''

  // Every gameweek in the season.
  const { data: gwRows } = await admin
    .from('gameweeks')
    .select('id, number')
    .eq('season', season)
    .order('number')

  const gameweeks: GameweekReportData[] = []
  for (const g of (gwRows ?? []) as Array<{ id: string; number: number }>) {
    gameweeks.push(await gatherGameweekData(g.id))
  }

  // Members master list.
  const { data: memberRows } = await admin
    .from('members')
    .select('id, display_name, email, starting_points')
    .eq('approval_status', 'approved')

  // Season totals — sum prediction_scores + confirmed bonuses.
  const { data: scoreRows } = await admin
    .from('prediction_scores')
    .select('member_id, points_awarded')
  const { data: bonusRows } = await admin
    .from('bonus_awards')
    .select('member_id, points_awarded, awarded')
    .eq('awarded', true)

  const totalByMember = new Map<string, number>()
  for (const s of (scoreRows ?? []) as Array<any>) {
    const prev = totalByMember.get(s.member_id) ?? 0
    totalByMember.set(s.member_id, prev + (s.points_awarded ?? 0))
  }
  for (const b of (bonusRows ?? []) as Array<any>) {
    const prev = totalByMember.get(b.member_id) ?? 0
    totalByMember.set(b.member_id, prev + (b.points_awarded ?? 0))
  }
  const membersMasterList = (memberRows ?? []).map((m: any) => ({
    id: m.id,
    displayName: m.display_name,
    email: m.email ?? '',
    totalPoints: (m.starting_points ?? 0) + (totalByMember.get(m.id) ?? 0),
  }))

  // Fixtures master list — flatten from each gameweek.
  const fixturesMasterList = gameweeks.flatMap((gw) =>
    gw.fixtures.map((f) => ({
      gwNumber: gw.gwNumber,
      fixtureId: f.id,
      home: f.home,
      away: f.away,
      kickoffIso: f.kickoffIso,
      homeScore: f.homeScore,
      awayScore: f.awayScore,
      status: f.status,
    })),
  )

  // H2H history — every row for this season's gameweeks.
  const gwIds = gameweeks.map((gw) => gw.gwId)
  const { data: h2hRows } = await admin
    .from('h2h_steals')
    .select(
      'detected_in_gw_id, resolves_in_gw_id, position, tied_member_ids, winner_ids',
    )
    .in('detected_in_gw_id', gwIds.length ? gwIds : ['__none__'])

  const gwNumberById = new Map(gameweeks.map((gw) => [gw.gwId, gw.gwNumber]))
  const h2hHistory = ((h2hRows ?? []) as Array<any>).map((h) => ({
    detectedInGw: gwNumberById.get(h.detected_in_gw_id) ?? 0,
    resolvesInGw: h.resolves_in_gw_id
      ? (gwNumberById.get(h.resolves_in_gw_id) ?? null)
      : null,
    position: h.position,
    members: (h.tied_member_ids ?? []) as string[],
    winner:
      Array.isArray(h.winner_ids) && h.winner_ids.length > 0
        ? h.winner_ids[0]
        : null,
  }))

  // LOS history — one row per member in the season's active competition.
  const { data: losCompRow } = await admin
    .from('los_competitions')
    .select('id')
    .eq('season', season)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const losCompId = (losCompRow as { id?: string } | null)?.id ?? null

  let losHistory: FullExportData['losHistory'] = []
  if (losCompId) {
    const { data: losMembers } = await admin
      .from('los_competition_members')
      .select('member_id, status, eliminated_at_gw')
      .eq('competition_id', losCompId)
    const { data: losPicks } = await admin
      .from('los_picks')
      .select('member_id, team:teams(name), gameweek_id')
      .eq('competition_id', losCompId)

    const teamsByMember = new Map<string, string[]>()
    for (const p of (losPicks ?? []) as Array<any>) {
      const teamName = p.team?.name
      if (!teamName) continue
      const arr = teamsByMember.get(p.member_id) ?? []
      arr.push(teamName)
      teamsByMember.set(p.member_id, arr)
    }

    const displayByMemberId2 = new Map(
      membersMasterList.map((m) => [m.id, m.displayName]),
    )
    losHistory = ((losMembers ?? []) as Array<any>).map((m) => ({
      memberId: m.member_id,
      displayName: displayByMemberId2.get(m.member_id) ?? 'Unknown',
      teamsUsed: teamsByMember.get(m.member_id) ?? [],
      eliminated:
        m.status === 'eliminated' || m.eliminated_at_gw != null,
      eliminatedAtGw: m.eliminated_at_gw ?? null,
    }))
  }

  // Pre-season picks + awards — reuse Phase 9 primitive.
  let preSeasonAwards: FullExportData['preSeasonAwards'] = []
  try {
    const { getPreSeasonExportRows } = await import('@/lib/pre-season/export')
    const rows = await getPreSeasonExportRows(season)
    preSeasonAwards = rows.map((r) => ({
      memberId: r.member_id,
      displayName: r.member_name,
      calculatedPoints: r.calculated_points ?? 0,
      awardedPoints: r.awarded_points,
      confirmed: r.confirmed,
      flags: {},
      picks: {
        top4: r.top4,
        tenth_place: r.tenth_place,
        relegated: r.relegated,
        promoted: r.promoted,
        promoted_playoff_winner: r.promoted_playoff_winner,
      },
    }))
  } catch {
    // If pre-season module is unavailable in a given deployment, skip.
    preSeasonAwards = []
  }

  return {
    season: seasonLabel,
    gameweeks,
    preSeasonAwards,
    membersMasterList,
    fixturesMasterList,
    h2hHistory,
    losHistory,
    generatedAtIso: new Date().toISOString(),
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
