/**
 * Last One Standing round orchestrator (Phase 8 Plan 02).
 *
 * Bridges the pure evaluators (evaluate.ts + competition.ts) with the
 * database. Called from the sync pipeline once all fixtures in a gameweek
 * are FINISHED.
 *
 * Responsibilities:
 *   - Look up the active competition
 *   - Guard: only evaluate when ALL gameweek fixtures have status='FINISHED'
 *   - Load active members + un-evaluated picks, build pure-input rows
 *   - Call pure evaluateLosRound
 *   - Persist per-pick outcomes (only where outcome IS NULL — idempotent)
 *   - Mark eliminated members + missed-submission members
 *   - If sole survivor: reset competition, insert new cycle, fire notifications
 *
 * ALL writes use the admin client — system writes, not member writes.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { evaluateLosRound, type LosRoundPickInput } from './evaluate'
import { shouldResetCompetition, nextCompetitionNumber } from './competition'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RunLosRoundResult {
  evaluatedPickCount: number
  eliminatedMemberIds: string[]
  missedMemberIds: string[]
  winnerId: string | null
  competitionReset: boolean
  newCompetitionId: string | null
}

export interface ResetCompetitionResult {
  newCompetitionId: string
}

// ─── runLosRound ─────────────────────────────────────────────────────────────

/**
 * Evaluate the LOS round for a gameweek.
 *
 * Safe to call multiple times — the `outcome IS NULL` filter on los_picks
 * ensures already-evaluated picks are not re-processed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function runLosRound(
  adminClient: SupabaseClient<any>,
  gameweekId: string,
): Promise<RunLosRoundResult> {
  const empty: RunLosRoundResult = {
    evaluatedPickCount: 0,
    eliminatedMemberIds: [],
    missedMemberIds: [],
    winnerId: null,
    competitionReset: false,
    newCompetitionId: null,
  }

  // 1. Active competition
  const { data: activeCompetition } = await adminClient
    .from('los_competitions')
    .select('id, season, status')
    .eq('status', 'active')
    .maybeSingle()

  if (!activeCompetition) return empty

  // 2. Gameweek context (need number for eliminated_at_gw, next-gw starts_at)
  const { data: gw } = await adminClient
    .from('gameweeks')
    .select('id, number')
    .eq('id', gameweekId)
    .single()

  if (!gw) return empty

  // 3. Guard: all fixtures in the gameweek must be FINISHED
  const { data: gwFixtures } = await adminClient
    .from('fixtures')
    .select('id, status, home_team_id, away_team_id, home_score, away_score')
    .eq('gameweek_id', gameweekId)

  const fixtures = (gwFixtures ?? []) as Array<{
    id: string
    status: string
    home_team_id: string
    away_team_id: string
    home_score: number | null
    away_score: number | null
  }>

  if (fixtures.length === 0) return empty
  const allFinished = fixtures.every((f) => f.status === 'FINISHED')
  if (!allFinished) return empty

  // 4. Load active members in this competition
  const { data: activeMembersRows } = await adminClient
    .from('los_competition_members')
    .select('member_id, status')
    .eq('competition_id', activeCompetition.id)
    .eq('status', 'active')

  const active_member_ids: string[] = ((activeMembersRows ?? []) as Array<{ member_id: string }>)
    .map((r) => r.member_id)

  if (active_member_ids.length === 0) return empty

  // 5. Load un-evaluated picks for this gameweek+competition
  const { data: pickRows } = await adminClient
    .from('los_picks')
    .select('id, member_id, team_id, fixture_id, outcome')
    .eq('competition_id', activeCompetition.id)
    .eq('gameweek_id', gameweekId)
    .is('outcome', null)

  const picks = ((pickRows ?? []) as Array<{
    id: string
    member_id: string
    team_id: string
    fixture_id: string
    outcome: string | null
  }>)

  // Join picks with fixtures via local map
  const fixtureById = new Map<string, typeof fixtures[number]>()
  for (const f of fixtures) fixtureById.set(f.id, f)

  const pureInput: LosRoundPickInput[] = picks
    .map((p) => {
      const f = fixtureById.get(p.fixture_id)
      if (!f) return null
      return {
        pick_id: p.id,
        member_id: p.member_id,
        team_id: p.team_id,
        fixture_id: p.fixture_id,
        home_team_id: f.home_team_id,
        away_team_id: f.away_team_id,
        home_score: f.home_score,
        away_score: f.away_score,
        fixture_status: f.status,
      } satisfies LosRoundPickInput
    })
    .filter((x): x is LosRoundPickInput => x !== null)

  // Early exit: no un-evaluated picks AND no active members to mark missed.
  // We still run missed-submission logic even with 0 picks.
  const hasSurvivorsToSettle = active_member_ids.length > 0

  if (pureInput.length === 0 && !hasSurvivorsToSettle) {
    return empty
  }

  // 6. Pure evaluator
  const evaluation = evaluateLosRound({
    active_member_ids,
    picks: pureInput,
  })

  // 7. Persist pick outcomes (upsert) — only the un-evaluated picks
  const nowIso = new Date().toISOString()
  for (const ev of evaluation.evaluations) {
    const matchingPick = picks.find((p) => p.id === ev.pick_id)
    if (!matchingPick) continue
    const { error } = await adminClient
      .from('los_picks')
      .upsert(
        {
          id: ev.pick_id,
          competition_id: activeCompetition.id,
          member_id: matchingPick.member_id,
          gameweek_id: gameweekId,
          team_id: matchingPick.team_id,
          fixture_id: matchingPick.fixture_id,
          outcome: ev.outcome,
          evaluated_at: nowIso,
          updated_at: nowIso,
        },
        { onConflict: 'id' },
      )
    if (error) {
      console.error('[runLosRound] Pick upsert error:', error.message)
    }
  }

  // 8. Mark eliminated members from their picks (draw/lose)
  const eliminatedByPick: string[] = []
  for (const p of picks) {
    const ev = evaluation.evaluations.find((e) => e.pick_id === p.id)
    if (ev && ev.eliminated) eliminatedByPick.push(p.member_id)
  }

  for (const p of picks) {
    const ev = evaluation.evaluations.find((e) => e.pick_id === p.id)
    if (!ev || !ev.eliminated) continue
    const reason = ev.outcome === 'draw' ? 'draw' : ev.outcome === 'lose' ? 'lose' : 'admin_override'
    await adminClient
      .from('los_competition_members')
      .update({
        status: 'eliminated',
        eliminated_at_gw: gw.number,
        eliminated_reason: reason,
      })
      .eq('competition_id', activeCompetition.id)
      .eq('member_id', p.member_id)
  }

  // 9. Mark missed-submission members as eliminated
  for (const memberId of evaluation.missed_submission_member_ids) {
    await adminClient
      .from('los_competition_members')
      .update({
        status: 'eliminated',
        eliminated_at_gw: gw.number,
        eliminated_reason: 'missed',
      })
      .eq('competition_id', activeCompetition.id)
      .eq('member_id', memberId)
  }

  // 10. Competition reset check
  let competitionReset = false
  let newCompetitionId: string | null = null

  if (evaluation.winner_id && shouldResetCompetition(evaluation.survivors.length)) {
    const reset = await resetCompetitionIfNeeded(
      adminClient,
      activeCompetition.id,
      gw.number,
      evaluation.winner_id,
      activeCompetition.season,
    )
    competitionReset = true
    newCompetitionId = reset.newCompetitionId
  }

  return {
    evaluatedPickCount: evaluation.evaluations.length,
    eliminatedMemberIds: eliminatedByPick,
    missedMemberIds: evaluation.missed_submission_member_ids,
    winnerId: evaluation.winner_id,
    competitionReset,
    newCompetitionId,
  }
}

// ─── resetCompetitionIfNeeded ────────────────────────────────────────────────

/**
 * Marks the current competition complete and spins up a new active cycle.
 *
 * Steps (documented tradeoff):
 *   - Complete old comp (UPDATE status='complete', winner_id, ended_at_gw, ended_at)
 *   - Compute next competition_num via pure nextCompetitionNumber()
 *   - INSERT new los_competitions row (active, starts_at_gw = endedAtGw+1)
 *   - INSERT los_competition_members rows for every approved member
 *   - INSERT admin_notifications ('los_winner_found' + 'los_competition_started')
 *
 * Not wrapped in a transaction — race window is small given sync cadence and
 * the partial unique index on status='active' guards against duplicate actives.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function resetCompetitionIfNeeded(
  adminClient: SupabaseClient<any>,
  competitionId: string,
  endedAtGw: number,
  winnerId: string,
  season: number,
): Promise<ResetCompetitionResult> {
  const nowIso = new Date().toISOString()

  // 1. Complete old competition
  await adminClient
    .from('los_competitions')
    .update({
      status: 'complete',
      ended_at_gw: endedAtGw,
      ended_at: nowIso,
      winner_id: winnerId,
    })
    .eq('id', competitionId)

  // 2. Compute next competition_num
  const { data: allCompRows } = await adminClient
    .from('los_competitions')
    .select('competition_num')
    .eq('season', season)

  const priorNumbers = ((allCompRows ?? []) as Array<{ competition_num: number }>)
    .map((r) => r.competition_num)
  const nextNum = nextCompetitionNumber(priorNumbers)

  // 3. Insert new active competition
  const { data: newComp } = await adminClient
    .from('los_competitions')
    .insert({
      season,
      competition_num: nextNum,
      status: 'active',
      starts_at_gw: endedAtGw + 1,
    })
    .select('id')
    .single()

  const newCompetitionId = (newComp?.id as string | undefined) ?? ''

  // 4. Enrol every approved member in the new cycle
  const { data: approvedMembers } = await adminClient
    .from('members')
    .select('id')
    .eq('approval_status', 'approved')

  const memberRows = ((approvedMembers ?? []) as Array<{ id: string }>).map((m) => ({
    competition_id: newCompetitionId,
    member_id: m.id,
    status: 'active',
  }))

  if (memberRows.length > 0 && newCompetitionId) {
    await adminClient.from('los_competition_members').insert(memberRows)
  }

  // 5. Notifications
  await adminClient.from('admin_notifications').insert([
    {
      type: 'los_winner_found',
      title: 'Last One Standing winner found',
      message: `Competition winner: member ${winnerId}`,
      member_id: winnerId,
    },
    {
      type: 'los_competition_started',
      title: 'New Last One Standing competition started',
      message: `Competition ${nextNum} starts at gameweek ${endedAtGw + 1}`,
    },
  ])

  return { newCompetitionId }
}
