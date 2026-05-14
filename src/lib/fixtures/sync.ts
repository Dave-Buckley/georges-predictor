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

// ─── Helper: format a kickoff ISO timestamp for George ──────────────────────
// Short, plain-English format suitable for admin notifications. BST/GMT is
// handled by toLocaleString — "Europe/London" picks the right offset.
function formatFriendlyKickoff(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      timeZone: 'Europe/London',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  } catch {
    return iso
  }
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

/**
 * Filters fixture rows to those that were ALREADY FINISHED but whose score
 * has changed since the last sync — typically a VAR-driven correction the
 * football-data feed publishes after the on-field final whistle.
 *
 * Without this, prediction_scores stay locked to the original (wrong) score
 * because recalculateFixture only fires on the first FINISHED transition.
 *
 * The caller is responsible for filtering out fixtures whose gameweek has
 * already been closed — we never silently rewrite history on a closed week.
 */
export function detectScoreChanged(
  fixtureRows: FixtureRow[],
  prevStatusMap: Map<number, FixtureStatusSnapshot>
): Array<FixtureRow & { prev_home: number | null; prev_away: number | null }> {
  const out: Array<FixtureRow & { prev_home: number | null; prev_away: number | null }> = []
  for (const row of fixtureRows) {
    const prev = prevStatusMap.get(row.external_id)
    if (!prev) continue
    if (prev.status !== 'FINISHED' || row.status !== 'FINISHED') continue
    if (row.home_score === null || row.away_score === null) continue
    if (prev.home_score === row.home_score && prev.away_score === row.away_score) continue
    out.push({ ...row, prev_home: prev.home_score, prev_away: prev.away_score })
  }
  return out
}

// ─── Helper: Mirror API results onto manual placeholder fixtures ─────────────
// Used when George inserts a placeholder fixture (e.g. add-mancity-palace-gw36.ts)
// with a synthetic external_id so the predictor knows the match exists in a
// gameweek before football-data.org has published the rescheduled match in
// that matchday. When the API eventually publishes the real fixture, two rows
// end up coexisting in the DB: the placeholder (no score, manual_gameweek_override=true)
// and the real one (FINISHED, real external_id, sits in the API's matchday).
// The placeholder never gets a result without this mirror step because the
// sync engine matches by external_id and the synthetic id never appears in the
// API feed.
//
// Pure helper kept side-effect-free for testability. Returns the (manual, donor)
// pairs the caller should mirror.

export interface ManualFixtureNeedingResult {
  id: string
  external_id: number
  home_team_id: string
  away_team_id: string
  kickoff_time: string
  status: string
  home_score: number | null
  away_score: number | null
}

export interface MirrorDonor {
  id: string
  external_id: number
  home_team_id: string
  away_team_id: string
  kickoff_time: string
  status: string
  home_score: number | null
  away_score: number | null
}

// 48h tolerance covers same-day reschedules without crossing the season halfway
// point where the other leg of the home/away pair sits (typically months away).
export const MIRROR_KICKOFF_TOLERANCE_MS = 48 * 60 * 60 * 1000

export function findMirrorCandidates(
  manuals: ManualFixtureNeedingResult[],
  candidates: MirrorDonor[],
): Array<{ manual: ManualFixtureNeedingResult; donor: MirrorDonor }> {
  const pairs: Array<{ manual: ManualFixtureNeedingResult; donor: MirrorDonor }> = []
  for (const m of manuals) {
    const mTime = new Date(m.kickoff_time).getTime()
    let best: { donor: MirrorDonor; gap: number } | null = null
    for (const d of candidates) {
      if (d.id === m.id) continue
      if (d.home_team_id !== m.home_team_id) continue
      if (d.away_team_id !== m.away_team_id) continue
      if (d.status !== 'FINISHED') continue
      if (d.home_score === null || d.away_score === null) continue
      const gap = Math.abs(new Date(d.kickoff_time).getTime() - mTime)
      if (gap > MIRROR_KICKOFF_TOLERANCE_MS) continue
      if (best === null || gap < best.gap) {
        best = { donor: d, gap }
      }
    }
    if (best) pairs.push({ manual: m, donor: best.donor })
  }
  return pairs
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

  const { data: existingFixtures, error: existingError } = await adminClient
    .from('fixtures')
    .select('external_id, kickoff_time, gameweek_id, manual_gameweek_override, gameweeks(number)')
    .in('external_id', externalIds)

  if (existingError) {
    // Bubble up so the caller can fail-closed — silently returning [] would
    // cause the next upsert to revert any manually-moved fixtures.
    throw new Error(`detectReschedules read failed: ${existingError.message}`)
  }

  if (!existingFixtures || existingFixtures.length === 0) {
    return { reschedules: [], gameweekMoves: [] }
  }

  // Build lookup map: externalId -> { kickoff_time, gameweek_number, override }
  const existingMap = new Map<
    number,
    { kickoff_time: string; gameweek_number: number | null; override: boolean }
  >()
  for (const row of existingFixtures) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gw = (row as any).gameweeks
    existingMap.set(row.external_id, {
      kickoff_time: row.kickoff_time,
      gameweek_number: gw?.number ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      override: !!(row as any).manual_gameweek_override,
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

    // Skip gameweek-move detection when the fixture is manually overridden —
    // otherwise we'd spam notifications every sync for George's bundled
    // rescheduled fixtures.
    if (
      !existing.override &&
      existing.gameweek_number !== null &&
      existing.gameweek_number !== match.matchday
    ) {
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
    // Look up existing gameweek + override flag per fixture. When a fixture
    // has manual_gameweek_override=true we preserve its current gameweek_id
    // so George's manual moves (e.g. bundling rescheduled fixtures into the
    // predictor week they're played in) aren't reverted by the next sync.
    const externalIdsToFetch = matches.map((m) => m.id)
    const { data: overrideRows, error: overrideError } = await adminClient
      .from('fixtures')
      .select('external_id, gameweek_id, manual_gameweek_override')
      .in('external_id', externalIdsToFetch)

    // Fail-closed: if we can't read the override flag (e.g. column missing,
    // transient DB error), aborting is far safer than silently reverting
    // manually-moved fixtures to whatever the API matchday says.
    if (overrideError) {
      // Log the technical detail for developers, but surface a plain-English
      // message to George via admin_notifications.
      const techMsg = `Override read failed: ${overrideError.message}`
      errors.push(techMsg)
      await writeSyncLog(adminClient, false, 0, techMsg)
      await adminClient.from('admin_notifications').insert({
        type: 'sync_failure',
        title: 'Fixture update paused — Dave needs to check',
        message:
          'The nightly fixture update did not run properly tonight. To keep any fixtures you have moved manually safe, the update has been paused. No fixtures have been changed. Please let Dave know — everything will carry on as normal once he has had a look.',
      })
      return { success: false, fixtures_updated: 0, scored_fixtures: 0, rescheduled, errors }
    }

    const overrideMap = new Map<number, { gameweek_id: string; override: boolean }>()
    for (const row of (overrideRows ?? []) as Array<{
      external_id: number
      gameweek_id: string
      manual_gameweek_override: boolean | null
    }>) {
      overrideMap.set(row.external_id, {
        gameweek_id: row.gameweek_id,
        override: !!row.manual_gameweek_override,
      })
    }

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
      const apiGameweekId = gameweekUuidMap.get(match.matchday)

      if (!homeTeamId || !awayTeamId || !apiGameweekId) {
        skipped.push(`match ${match.id}: missing UUID`)
        continue
      }

      const overrideEntry = overrideMap.get(match.id)
      const gameweekId = overrideEntry?.override
        ? overrideEntry.gameweek_id
        : apiGameweekId

      const isRescheduled =
        reschedules.some((r) => r.externalId === match.id) ||
        !!overrideEntry?.override

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
          title: `Points awarded for ${scored_fixtures} new result${scored_fixtures !== 1 ? 's' : ''}`,
          message: `Everyone's predictions have been scored for: ${fixtureLabelsList}.`,
        })
      }
    }

    // ── 9a. Detect FINISHED-but-score-changed fixtures (VAR corrections) ─────
    // These fixtures were already FINISHED in a prior sync but the API has now
    // published a different score (typically a VAR-driven correction). Without
    // this branch, prediction_scores stays locked to the first score we saw.
    //
    // Safety rule: never silently re-score a fixture in a CLOSED gameweek.
    // Closed weeks have rolled into members.starting_points and may have
    // bonus awards George has manually confirmed — Dave reviews before any
    // change.
    const scoreChanged = detectScoreChanged(fixtureRows, prevStatusMap)
    if (scoreChanged.length > 0) {
      const changedExternalIds = scoreChanged.map((r) => r.external_id)
      const { data: changedDbRows } = await adminClient
        .from('fixtures')
        .select(`
          id, external_id, home_score, away_score,
          gameweek:gameweeks!gameweek_id(id, number, closed_at)
        `)
        .in('external_id', changedExternalIds)

      const fixtureLabelMap = new Map<number, string>()
      for (const match of matches) {
        fixtureLabelMap.set(match.id, `${match.homeTeam.shortName} vs ${match.awayTeam.shortName}`)
      }
      const prevScoreMap = new Map<number, { h: number | null; a: number | null }>()
      for (const r of scoreChanged) {
        prevScoreMap.set(r.external_id, { h: r.prev_home, a: r.prev_away })
      }

      const openGwRows: Array<{ id: string; external_id: number; home_score: number; away_score: number; gw_number: number }> = []
      const closedGwRows: Array<{ id: string; external_id: number; home_score: number; away_score: number; gw_number: number }> = []

      for (const row of (changedDbRows ?? []) as unknown as Array<{
        id: string
        external_id: number
        home_score: number | null
        away_score: number | null
        gameweek: { id: string; number: number; closed_at: string | null } | null
      }>) {
        if (row.home_score === null || row.away_score === null) continue
        const bucket = row.gameweek?.closed_at ? closedGwRows : openGwRows
        bucket.push({
          id: row.id,
          external_id: row.external_id,
          home_score: row.home_score,
          away_score: row.away_score,
          gw_number: row.gameweek?.number ?? -1,
        })
      }

      // Open weeks → recalc + notify
      if (openGwRows.length > 0) {
        const recalcResults = await Promise.all(
          openGwRows.map((r) => recalculateFixture(r.id, r.home_score, r.away_score))
        )
        for (const r of recalcResults) {
          if (r.errors.length > 0) {
            errors.push(...r.errors.map((e) => `Score-correction recalc error for ${r.fixture_id}: ${e}`))
          } else {
            scored_fixtures++
          }
        }

        const lines = openGwRows.map((r) => {
          const label = fixtureLabelMap.get(r.external_id) ?? `external_id:${r.external_id}`
          const prev = prevScoreMap.get(r.external_id)
          const prevStr = prev ? `${prev.h ?? '?'}-${prev.a ?? '?'}` : '?'
          return `${label} (was ${prevStr}, now ${r.home_score}-${r.away_score})`
        })
        await adminClient.from('admin_notifications').insert({
          type: 'scoring_complete',
          title: `Score correction picked up — ${openGwRows.length} fixture${openGwRows.length !== 1 ? 's' : ''} re-scored`,
          message:
            `The football data feed updated the final score on ${openGwRows.length} fixture${openGwRows.length !== 1 ? 's' : ''} that had already finished. ` +
            `Predictions have been re-scored against the new result: ${lines.join('; ')}. ` +
            `If anyone had a bonus award manually confirmed on these matches, please re-check whether it still scores correctly.`,
        })
      }

      // Closed weeks → notify only, do NOT touch
      if (closedGwRows.length > 0) {
        const lines = closedGwRows.map((r) => {
          const label = fixtureLabelMap.get(r.external_id) ?? `external_id:${r.external_id}`
          const prev = prevScoreMap.get(r.external_id)
          const prevStr = prev ? `${prev.h ?? '?'}-${prev.a ?? '?'}` : '?'
          return `GW${r.gw_number} ${label} (was ${prevStr}, now ${r.home_score}-${r.away_score})`
        })
        await adminClient.from('admin_notifications').insert({
          type: 'sync_failure',
          title: `Score change on a closed gameweek — Dave needs to check`,
          message:
            `The football data feed has changed the final score on a fixture in an already-closed gameweek. ` +
            `The app has NOT changed any points automatically because the week's totals have already been added to everyone's season tally. ` +
            `Dave needs to decide whether to re-score the affected predictions: ${lines.join('; ')}.`,
        })
      }
    }

    // ── 9a2. Mirror API results onto manual placeholder fixtures ─────────────
    // When a manual_gameweek_override=true fixture (synthetic external_id) is
    // still missing a result, look for a real API fixture covering the same
    // match (same team pair, kickoff within 48h) that's FINISHED, and mirror
    // its score onto the placeholder. Then re-score the placeholder's
    // predictions. See findMirrorCandidates for the matching rules.
    //
    // Closed-week safety: never silently rewrite a closed gameweek. If the
    // placeholder sits in a closed gameweek (points_applied=true), notify Dave
    // and skip — same rule the score-correction branch uses.
    try {
      const { data: overrideRowsRaw, error: overrideReadErr } = await adminClient
        .from('fixtures')
        .select(`
          id, external_id, home_team_id, away_team_id, kickoff_time,
          status, home_score, away_score,
          gameweek:gameweeks!gameweek_id(id, number, closed_at, points_applied)
        `)
        .eq('manual_gameweek_override', true)

      if (overrideReadErr) {
        errors.push(`Mirror read error: ${overrideReadErr.message}`)
      } else {
        type OverrideRow = ManualFixtureNeedingResult & {
          gameweek: { id: string; number: number; closed_at: string | null; points_applied: boolean } | null
        }
        const overrideRows = (overrideRowsRaw ?? []) as unknown as OverrideRow[]
        const needsResult = overrideRows.filter(
          (r) => r.status !== 'FINISHED' || r.home_score === null || r.away_score === null,
        )

        if (needsResult.length > 0) {
          // Pull every fixture row that could be a donor — same team pair as any
          // placeholder needing a result, status FINISHED. Use the OR-by-team-pair
          // pattern (we don't restrict by external_id since the donor's ID is
          // exactly what we don't know in advance).
          const teamPairFilters = needsResult
            .map((r) => `and(home_team_id.eq.${r.home_team_id},away_team_id.eq.${r.away_team_id})`)
            .join(',')
          const { data: donorCandidatesRaw, error: donorErr } = await adminClient
            .from('fixtures')
            .select('id, external_id, home_team_id, away_team_id, kickoff_time, status, home_score, away_score')
            .or(teamPairFilters)
            .eq('status', 'FINISHED')

          if (donorErr) {
            errors.push(`Mirror donor read error: ${donorErr.message}`)
          } else {
            const pairs = findMirrorCandidates(needsResult, (donorCandidatesRaw ?? []) as MirrorDonor[])
            const closedPairs: Array<{ manual: OverrideRow; donor: MirrorDonor }> = []
            const openPairs: Array<{ manual: OverrideRow; donor: MirrorDonor }> = []
            for (const p of pairs) {
              const fullManual = overrideRows.find((r) => r.id === p.manual.id)!
              if (fullManual.gameweek?.closed_at) {
                closedPairs.push({ manual: fullManual, donor: p.donor })
              } else {
                openPairs.push({ manual: fullManual, donor: p.donor })
              }
            }

            // Open weeks → mirror + recalc + notify
            for (const { manual, donor } of openPairs) {
              const { error: mirrorErr } = await adminClient
                .from('fixtures')
                .update({
                  status: 'FINISHED',
                  home_score: donor.home_score,
                  away_score: donor.away_score,
                  result_source: 'api',
                })
                .eq('id', manual.id)
              if (mirrorErr) {
                errors.push(`Mirror update error for ${manual.id}: ${mirrorErr.message}`)
                continue
              }
              const recalc = await recalculateFixture(manual.id, donor.home_score!, donor.away_score!)
              if (recalc.errors.length > 0) {
                errors.push(...recalc.errors.map((e) => `Mirror recalc error for ${manual.id}: ${e}`))
              } else {
                scored_fixtures++
              }
              await adminClient.from('admin_notifications').insert({
                type: 'scoring_complete',
                title: `Result picked up for a rescheduled fixture in GW${manual.gameweek?.number ?? '?'}`,
                message:
                  `A fixture you had bundled into GW${manual.gameweek?.number ?? '?'} (kickoff ${formatFriendlyKickoff(manual.kickoff_time)}) ` +
                  `has now been published in the football data feed with a final score of ${donor.home_score}-${donor.away_score}. ` +
                  `Predictions for this fixture have been scored automatically.`,
              })
            }

            // Closed weeks → notify only, do NOT touch (mirrors the rule in 9a)
            for (const { manual, donor } of closedPairs) {
              await adminClient.from('admin_notifications').insert({
                type: 'sync_failure',
                title: `Result arrived after GW${manual.gameweek?.number ?? '?'} was closed — Dave needs to check`,
                message:
                  `A rescheduled fixture you bundled into GW${manual.gameweek?.number ?? '?'} (kickoff ${formatFriendlyKickoff(manual.kickoff_time)}) ` +
                  `has now been published in the football data feed with a final score of ${donor.home_score}-${donor.away_score}, ` +
                  `but the gameweek is already closed and the weekly totals have been added to everyone's season tally. ` +
                  `The app has not changed any points automatically. Dave needs to decide whether to re-score this fixture.`,
              })
            }
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown mirror error'
      errors.push(`Manual fixture mirror error: ${msg}`)
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
        title: `Kickoff time changed: ${r.matchLabel}`,
        message: `${r.matchLabel} has a new kickoff time. It used to be ${formatFriendlyKickoff(r.oldKickoff)} and is now ${formatFriendlyKickoff(r.newKickoff)}.`,
      })
    }

    for (const move of gameweekMoves) {
      notifications.push({
        type: 'fixture_moved',
        title: `${move.matchLabel} has moved to a new gameweek`,
        message: `${move.matchLabel} was in Gameweek ${move.oldMatchday} and has been moved to Gameweek ${move.newMatchday}.`,
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
        title: 'Fixture update had a problem — Dave needs to check',
        message:
          'The nightly fixture update ran into an error and did not finish. Scores and fixtures may not be fully up to date until Dave takes a look. The app is still working normally for everyone else in the meantime.',
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
