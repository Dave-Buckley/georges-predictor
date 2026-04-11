// ─── Fixture Sync Engine ──────────────────────────────────────────────────────
// Orchestrates: fetch -> upsert teams -> upsert gameweeks -> upsert fixtures
//               -> detect reschedules -> write sync_log
//
// Always uses the admin (service role) client which bypasses RLS.
// Never throws — always returns a result object.

import { createAdminClient } from '@/lib/supabase/admin'
import { fetchAllMatches, type FootballDataMatch } from './football-data-client'
import type { TeamRow, GameweekRow } from '@/lib/supabase/types'

export interface SyncResult {
  success: boolean
  fixtures_updated: number
  rescheduled: string[]
  errors: string[]
}

// ─── Helper: Extract unique teams from matches ────────────────────────────────

function extractTeams(matches: FootballDataMatch[]): Map<number, {
  external_id: number
  name: string
  short_name: string
  tla: string
  crest_url: string
}> {
  const teams = new Map<number, {
    external_id: number
    name: string
    short_name: string
    tla: string
    crest_url: string
  }>()

  for (const match of matches) {
    for (const team of [match.homeTeam, match.awayTeam]) {
      if (!teams.has(team.id)) {
        teams.set(team.id, {
          external_id: team.id,
          name: team.name,
          short_name: team.shortName,
          tla: team.tla,
          crest_url: team.crest,
        })
      }
    }
  }

  return teams
}

// ─── Helper: Extract unique matchdays as gameweeks ───────────────────────────

function extractGameweeks(matches: FootballDataMatch[]): Array<{
  number: number
  season: number
}> {
  const matchdaySet = new Set<number>()
  const season = matches.length > 0
    ? new Date(matches[0].season.startDate).getFullYear()
    : new Date().getFullYear()

  for (const match of matches) {
    matchdaySet.add(match.matchday)
  }

  return Array.from(matchdaySet).map((number) => ({ number, season }))
}

// ─── Helper: Detect rescheduled fixtures ─────────────────────────────────────

interface RescheduleInfo {
  externalId: number
  oldKickoff: string
  newKickoff: string
  matchLabel: string
}

interface GameweekMoveInfo {
  externalId: number
  oldMatchday: number
  newMatchday: number
  matchLabel: string
}

async function detectReschedules(
  adminClient: ReturnType<typeof createAdminClient>,
  matches: FootballDataMatch[]
): Promise<{ reschedules: RescheduleInfo[]; gameweekMoves: GameweekMoveInfo[] }> {
  const externalIds = matches.map((m) => m.id)

  const { data: existingFixtures } = await adminClient
    .from('fixtures')
    .select('external_id, kickoff_time, gameweek_id, gameweeks(number)')
    .in('external_id', externalIds)

  if (!existingFixtures || existingFixtures.length === 0) {
    return { reschedules: [], gameweekMoves: [] }
  }

  // Build lookup map: externalId -> { kickoff_time, gameweek_number }
  const existingMap = new Map<number, { kickoff_time: string; gameweek_number: number | null }>()
  for (const row of existingFixtures) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gw = (row as any).gameweeks
    existingMap.set(row.external_id, {
      kickoff_time: row.kickoff_time,
      gameweek_number: gw?.number ?? null,
    })
  }

  const reschedules: RescheduleInfo[] = []
  const gameweekMoves: GameweekMoveInfo[] = []

  for (const match of matches) {
    const existing = existingMap.get(match.id)
    if (!existing) continue

    const existingKickoff = new Date(existing.kickoff_time).toISOString()
    const incomingKickoff = new Date(match.utcDate).toISOString()

    if (existingKickoff !== incomingKickoff) {
      reschedules.push({
        externalId: match.id,
        oldKickoff: existingKickoff,
        newKickoff: incomingKickoff,
        matchLabel: `${match.homeTeam.shortName} vs ${match.awayTeam.shortName}`,
      })
    }

    if (existing.gameweek_number !== null && existing.gameweek_number !== match.matchday) {
      gameweekMoves.push({
        externalId: match.id,
        oldMatchday: existing.gameweek_number,
        newMatchday: match.matchday,
        matchLabel: `${match.homeTeam.shortName} vs ${match.awayTeam.shortName}`,
      })
    }
  }

  return { reschedules, gameweekMoves }
}

// ─── Main Sync Orchestrator ───────────────────────────────────────────────────

/**
 * Full fixture sync pipeline:
 * 1. Fetch all PL matches from football-data.org
 * 2. Upsert teams
 * 3. Upsert gameweeks
 * 4. Detect reschedules / gameweek moves
 * 5. Upsert fixtures (resolving team + gameweek UUIDs)
 * 6. Create admin notifications for reschedules/moves
 * 7. Write sync_log
 *
 * Never throws — always returns a SyncResult.
 */
export async function syncFixtures(): Promise<SyncResult> {
  const adminClient = createAdminClient()
  const errors: string[] = []
  const rescheduled: string[] = []

  try {
    // ── 1. Validate environment ───────────────────────────────────────────────
    const apiKey = process.env.FOOTBALL_DATA_API_KEY
    if (!apiKey) {
      const msg = 'FOOTBALL_DATA_API_KEY is not set — sync aborted'
      console.error('[sync-fixtures]', msg)

      await adminClient.from('sync_log').insert({
        success: false,
        fixtures_updated: 0,
        error_message: msg,
      })

      return { success: false, fixtures_updated: 0, rescheduled: [], errors: [msg] }
    }

    // ── 2. Fetch matches ──────────────────────────────────────────────────────
    const matches = await fetchAllMatches(apiKey)
    if (!matches || matches.length === 0) {
      const msg = 'No matches returned from football-data.org'
      errors.push(msg)
      await writeSyncLog(adminClient, false, 0, msg)
      return { success: false, fixtures_updated: 0, rescheduled: [], errors }
    }

    // ── 3. Upsert teams ───────────────────────────────────────────────────────
    const teamsMap = extractTeams(matches)
    const teamsArray = Array.from(teamsMap.values())

    const { error: teamsError } = await adminClient
      .from('teams')
      .upsert(teamsArray, { onConflict: 'external_id' })

    if (teamsError) {
      errors.push(`Teams upsert error: ${teamsError.message}`)
    }

    // ── 4. Upsert gameweeks ───────────────────────────────────────────────────
    const gameweekRows = extractGameweeks(matches)

    const { error: gameweeksError } = await adminClient
      .from('gameweeks')
      .upsert(gameweekRows, { onConflict: 'number' })

    if (gameweeksError) {
      errors.push(`Gameweeks upsert error: ${gameweeksError.message}`)
    }

    // ── 5. Resolve UUIDs from database (after upserts) ───────────────────────
    const [teamsDbResult, gameweeksDbResult] = await Promise.all([
      adminClient.from('teams').select('id, external_id'),
      adminClient.from('gameweeks').select('id, number'),
    ])

    if (teamsDbResult.error || gameweeksDbResult.error) {
      const msg = `UUID resolution error: teams=${teamsDbResult.error?.message ?? 'ok'} gameweeks=${gameweeksDbResult.error?.message ?? 'ok'}`
      errors.push(msg)
      await writeSyncLog(adminClient, false, 0, msg)
      return { success: false, fixtures_updated: 0, rescheduled, errors }
    }

    const teamUuidMap = new Map<number, string>()
    for (const row of (teamsDbResult.data as Pick<TeamRow, 'id' | 'external_id'>[])) {
      teamUuidMap.set(row.external_id, row.id)
    }

    const gameweekUuidMap = new Map<number, string>()
    for (const row of (gameweeksDbResult.data as Pick<GameweekRow, 'id' | 'number'>[])) {
      gameweekUuidMap.set(row.number, row.id)
    }

    // ── 6. Detect reschedules before upsert ───────────────────────────────────
    const { reschedules, gameweekMoves } = await detectReschedules(adminClient, matches)

    for (const r of reschedules) {
      rescheduled.push(r.matchLabel)
    }

    // ── 7. Build fixture rows ─────────────────────────────────────────────────
    const fixtureRows: Array<{
      external_id: number
      gameweek_id: string
      home_team_id: string
      away_team_id: string
      kickoff_time: string
      status: string
      is_rescheduled: boolean
      home_score: number | null
      away_score: number | null
    }> = []

    const skipped: string[] = []

    for (const match of matches) {
      const homeTeamId = teamUuidMap.get(match.homeTeam.id)
      const awayTeamId = teamUuidMap.get(match.awayTeam.id)
      const gameweekId = gameweekUuidMap.get(match.matchday)

      if (!homeTeamId || !awayTeamId || !gameweekId) {
        skipped.push(`match ${match.id}: missing UUID`)
        continue
      }

      const isRescheduled = reschedules.some((r) => r.externalId === match.id)

      fixtureRows.push({
        external_id: match.id,
        gameweek_id: gameweekId,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        kickoff_time: match.utcDate,
        status: match.status,
        is_rescheduled: isRescheduled,
        home_score: match.score.fullTime.home,
        away_score: match.score.fullTime.away,
      })
    }

    if (skipped.length > 0) {
      errors.push(`Skipped ${skipped.length} fixtures due to missing UUIDs`)
    }

    // ── 8. Upsert fixtures ────────────────────────────────────────────────────
    const { error: fixturesError } = await adminClient
      .from('fixtures')
      .upsert(fixtureRows, { onConflict: 'external_id' })

    if (fixturesError) {
      errors.push(`Fixtures upsert error: ${fixturesError.message}`)
      await writeSyncLog(adminClient, false, 0, fixturesError.message)
      return { success: false, fixtures_updated: 0, rescheduled, errors }
    }

    // ── 9. Create admin notifications for reschedules/moves ───────────────────
    const notifications: Array<{
      type: string
      title: string
      message: string
    }> = []

    for (const r of reschedules) {
      notifications.push({
        type: 'fixture_rescheduled',
        title: `Fixture rescheduled: ${r.matchLabel}`,
        message: `Kickoff moved from ${r.oldKickoff} to ${r.newKickoff}`,
      })
    }

    for (const move of gameweekMoves) {
      notifications.push({
        type: 'fixture_moved',
        title: `Fixture moved gameweek: ${move.matchLabel}`,
        message: `Moved from GW${move.oldMatchday} to GW${move.newMatchday}`,
      })
    }

    if (notifications.length > 0) {
      await adminClient.from('admin_notifications').insert(notifications)
    }

    // ── 10. Write sync log ────────────────────────────────────────────────────
    const success = errors.length === 0
    await writeSyncLog(adminClient, success, fixtureRows.length, errors.join('; ') || null)

    return {
      success,
      fixtures_updated: fixtureRows.length,
      rescheduled,
      errors,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown sync error'
    console.error('[sync-fixtures] Fatal error:', msg)
    errors.push(msg)

    // Write sync_log and admin notification on fatal error
    try {
      await adminClient.from('sync_log').insert({
        success: false,
        fixtures_updated: 0,
        error_message: msg,
      })
      await adminClient.from('admin_notifications').insert({
        type: 'sync_failure',
        title: 'Fixture sync failed',
        message: msg,
      })
    } catch {
      // Best-effort — if logging itself fails, swallow the error
    }

    return { success: false, fixtures_updated: 0, rescheduled, errors }
  }
}

// ─── Utility: Write sync_log ──────────────────────────────────────────────────

async function writeSyncLog(
  adminClient: ReturnType<typeof createAdminClient>,
  success: boolean,
  fixtures_updated: number,
  error_message: string | null
): Promise<void> {
  await adminClient.from('sync_log').insert({
    success,
    fixtures_updated,
    error_message,
  })
}
