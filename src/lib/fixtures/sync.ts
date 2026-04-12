// ─── Fixture Sync Engine ──────────────────────────────────────────────────────
// Orchestrates: fetch -> upsert teams -> upsert gameweeks -> upsert fixtures
//               -> detect reschedules -> detect FINISHED transitions -> score
//               -> write sync_log
//
// Always uses the admin (service role) client which bypasses RLS.
// Never throws — always returns a result object.

import { createAdminClient } from '@/lib/supabase/admin'
import { fetchAllMatches, type FootballDataMatch } from './football-data-client'
import { recalculateFixture } from '@/lib/scoring/recalculate'
import { runLosRound } from '@/lib/los/round'
import { detectH2HForGameweek, resolveStealsForGameweek } from '@/lib/h2h/sync-hook'
import { maybeSendKickoffBackup } from '@/lib/reports/kickoff-backup-hook'
import type { TeamRow, GameweekRow } from '@/lib/supabase/types'

export interface SyncResult {
  success: boolean
  fixtures_updated: number
  scored_fixtures: number
  rescheduled: string[]
  errors: string[]
}

// ─── Helper: Detect newly-FINISHED fixtures (exported for testing) ────────────

export interface FixtureStatusSnapshot {
  external_id: number
  status: string
  home_score: number | null
  away_score: number | null
}

export interface FixtureRow {
  external_id: number
  status: string
  home_score: number | null
  away_score: number | null
}

/**
 * Filters fixture rows to only those transitioning to FINISHED for the first time.
 * Fixtures already FINISHED in prevStatusMap are excluded (no double-scoring).
 */
export function detectNewlyFinished(
  fixtureRows: FixtureRow[],
  prevStatusMap: Map<number, FixtureStatusSnapshot>
): FixtureRow[] {
  return fixtureRows.filter((row) => {
    const prev = prevStatusMap.get(row.external_id)
    return (
      row.status === 'FINISHED'
      && prev?.status !== 'FINISHED'
      && row.home_score !== null
      && row.away_score !== null
    )
  })
}

// ─── Helper: Detect gameweeks where ALL fixtures are FINISHED ────────────────
// Given a set of newly-FINISHED external_ids, resolves them to gameweek UUIDs,
// then returns only those gameweeks where every fixture has status='FINISHED'.
// Called after scoring so LOS round evaluation and H2H steal detection can run.

export async function detectFullyFinishedGameweeks(
  adminClient: ReturnType<typeof createAdminClient>,
  newlyFinishedExternalIds: number[],
): Promise<string[]> {
  if (newlyFinishedExternalIds.length === 0) return []

  // Resolve gameweek IDs touched by these fixtures
  const { data: touchedRows } = await adminClient
    .from('fixtures')
    .select('gameweek_id')
    .in('external_id', newlyFinishedExternalIds)

  const touchedGwIds = Array.from(
    new Set(((touchedRows ?? []) as Array<{ gameweek_id: string }>).map((r) => r.gameweek_id)),
  )

  if (touchedGwIds.length === 0) return []

  // For each touched gw, check whether ANY fixture is still non-FINISHED
  const fullyFinished: string[] = []
  for (const gwId of touchedGwIds) {
    const { count } = await adminClient
      .from('fixtures')
      .select('id', { count: 'exact', head: true })
      .eq('gameweek_id', gwId)
      .neq('status', 'FINISHED')
    if ((count ?? 0) === 0) {
      fullyFinished.push(gwId)
    }
  }

  return fullyFinished
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

      return { success: false, fixtures_updated: 0, scored_fixtures: 0, rescheduled: [], errors: [msg] }
    }

    // ── 2. Fetch matches ──────────────────────────────────────────────────────
    const matches = await fetchAllMatches(apiKey)
    if (!matches || matches.length === 0) {
      const msg = 'No matches returned from football-data.org'
      errors.push(msg)
      await writeSyncLog(adminClient, false, 0, msg)
      return { success: false, fixtures_updated: 0, scored_fixtures: 0, rescheduled: [], errors }
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
      return { success: false, fixtures_updated: 0, scored_fixtures: 0, rescheduled, errors }
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

    // ── 6b. Snapshot previous statuses/scores (for FINISHED-transition detection) ─
    const { data: previousStatuses } = await adminClient
      .from('fixtures')
      .select('external_id, status, home_score, away_score')
      .in('external_id', matches.map((m) => m.id))

    const prevStatusMap = new Map<number, FixtureStatusSnapshot>()
    for (const row of (previousStatuses ?? [])) {
      prevStatusMap.set(row.external_id, {
        external_id: row.external_id,
        status: row.status,
        home_score: row.home_score,
        away_score: row.away_score,
      })
    }

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
      return { success: false, fixtures_updated: 0, scored_fixtures: 0, rescheduled, errors }
    }

    // ── 9. Detect FINISHED transitions and trigger scoring ────────────────────
    let scored_fixtures = 0
    const newlyFinished = detectNewlyFinished(fixtureRows, prevStatusMap)

    if (newlyFinished.length > 0) {
      // Resolve UUIDs for newly-finished fixtures (query by external_id)
      const newlyFinishedExternalIds = newlyFinished.map((r) => r.external_id)
      const { data: finishedDbRows } = await adminClient
        .from('fixtures')
        .select('id, external_id, home_score, away_score')
        .in('external_id', newlyFinishedExternalIds)

      if (finishedDbRows && finishedDbRows.length > 0) {
        // Update result_source to 'api' for all newly-finished fixtures
        await adminClient
          .from('fixtures')
          .update({ result_source: 'api' })
          .in('external_id', newlyFinishedExternalIds)

        // Call recalculateFixture for each newly-finished fixture
        const scoringResults = await Promise.all(
          finishedDbRows.map((dbRow: { id: string; external_id: number; home_score: number | null; away_score: number | null }) =>
            recalculateFixture(dbRow.id, dbRow.home_score, dbRow.away_score)
          )
        )

        for (const result of scoringResults) {
          if (result.errors.length > 0) {
            errors.push(...result.errors.map((e) => `Scoring error for ${result.fixture_id}: ${e}`))
          } else {
            scored_fixtures++
          }
        }

        // Create admin notification for scoring completion
        const fixtureLabelMap = new Map<number, string>()
        for (const match of matches) {
          fixtureLabelMap.set(match.id, `${match.homeTeam.shortName} vs ${match.awayTeam.shortName}`)
        }
        const fixtureLabelsList = newlyFinishedExternalIds
          .map((extId) => fixtureLabelMap.get(extId) ?? `external_id:${extId}`)
          .join(', ')

        await adminClient.from('admin_notifications').insert({
          type: 'scoring_complete',
          title: `Scores calculated for ${scored_fixtures} fixture${scored_fixtures !== 1 ? 's' : ''}`,
          message: fixtureLabelsList,
        })
      }
    }

    // ── 9b. LOS round evaluation + H2H tie detection/resolution ──────────────
    // Run ONLY for gameweeks where every fixture has status='FINISHED'.
    // detectH2HForGameweek is a no-op when closed_at IS NULL (pre-close state).
    // resolveStealsForGameweek resolves any steals whose resolves_in_gw_id = this gw.
    try {
      const newlyFinishedExternalIds = newlyFinished.map((r) => r.external_id)
      const fullyFinishedGwIds = await detectFullyFinishedGameweeks(
        adminClient,
        newlyFinishedExternalIds,
      )

      for (const gwId of fullyFinishedGwIds) {
        // LOS round evaluation (application-level orchestrator)
        try {
          await runLosRound(adminClient, gwId)
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown LOS round error'
          errors.push(`LOS round error for gw ${gwId}: ${msg}`)
        }

        // H2H tie detection — no-op unless gameweek has been closed by George
        try {
          await detectH2HForGameweek(adminClient, gwId)
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown H2H detect error'
          errors.push(`H2H detect error for gw ${gwId}: ${msg}`)
        }

        // H2H steal resolution — resolves any pending steals landing in this gw
        try {
          await resolveStealsForGameweek(adminClient, gwId)
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown H2H resolve error'
          errors.push(`H2H resolve error for gw ${gwId}: ${msg}`)
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown post-scoring pipeline error'
      errors.push(`Post-scoring pipeline error: ${msg}`)
    }

    // ── 9c. Kickoff backup hook ──────────────────────────────────────────────
    // Piggybacks on the existing sync cron. Sends one email (PDF+XLSX) to
    // George + Dave the first sync after any fixture of a gameweek kicks off.
    // Idempotent via `gameweeks.kickoff_backup_sent_at`. Wrapped in try/catch so
    // a failure here never breaks the sync pipeline.
    try {
      await maybeSendKickoffBackup(adminClient)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown kickoff backup error'
      console.error('[sync-fixtures] kickoff backup hook failed:', msg)
      errors.push(`Kickoff backup hook error: ${msg}`)
    }

    // ── 10. Create admin notifications for reschedules/moves ─────────────────
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

    // ── 11. Write sync log ────────────────────────────────────────────────────
    const success = errors.length === 0
    await writeSyncLog(adminClient, success, fixtureRows.length, errors.join('; ') || null)

    return {
      success,
      fixtures_updated: fixtureRows.length,
      scored_fixtures,
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

    return { success: false, fixtures_updated: 0, scored_fixtures: 0, rescheduled, errors }
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
