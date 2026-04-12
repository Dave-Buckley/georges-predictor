/**
 * Tests for gatherGameweekData — Phase 10 aggregator that feeds all 4 report
 * artifacts. Behaviours covered:
 *
 *   1. standings sorted by totalPoints DESC, rank 1-indexed
 *   2. predictionsByMember shape + bonus flags
 *   3. losStatus eliminated/survived tri-state
 *   4. h2hSteals include both newly-detected and resolving-this-week rows
 *   5. topWeekly top-3 by weeklyPoints with alpha tiebreak
 *   6. closedAtIso null when gameweek not yet closed
 *   7. doubleBubbleActive reflects gameweeks.double_bubble
 *   8. Empty gameweek — no predictions — no throw
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the admin client before importing the module under test.
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

import { createAdminClient } from '@/lib/supabase/admin'
import {
  gatherGameweekData,
  shapeData,
  type GameweekReportData,
} from '@/lib/reports/_data/gather-gameweek-data'
import { mockSupabaseFrom } from './fixtures/gameweek-data'

const GW_ID = '11111111-1111-1111-1111-111111111111'
const GW2_ID = '22222222-2222-2222-2222-222222222222'

// ─── Raw row fixtures (shaped exactly as Supabase returns them) ──────────────

const MEMBERS = [
  { id: 'm-1', display_name: 'Alice', starting_points: 50, email_weekly_personal: true, email_weekly_group: true },
  { id: 'm-2', display_name: 'Bob', starting_points: 0, email_weekly_personal: true, email_weekly_group: true },
  { id: 'm-3', display_name: 'Charlie', starting_points: 0, email_weekly_personal: true, email_weekly_group: true },
]

const GAMEWEEK = {
  id: GW_ID,
  number: 5,
  season: 2025,
  status: 'active',
  double_bubble: true,
  closed_at: '2025-09-20T23:59:59Z',
  closed_by: null,
  created_at: '2025-08-01T00:00:00Z',
  kickoff_backup_sent_at: null,
  reports_sent_at: null,
}

const FIXTURES = [
  {
    id: 'fix-1',
    gameweek_id: GW_ID,
    home_team_id: 't-home-1',
    away_team_id: 't-away-1',
    kickoff_time: '2025-09-14T14:00:00Z',
    status: 'FINISHED',
    home_score: 2,
    away_score: 1,
    home_team: { id: 't-home-1', name: 'Arsenal' },
    away_team: { id: 't-away-1', name: 'Chelsea' },
  },
  {
    id: 'fix-2',
    gameweek_id: GW_ID,
    home_team_id: 't-home-2',
    away_team_id: 't-away-2',
    kickoff_time: '2025-09-14T16:30:00Z',
    status: 'FINISHED',
    home_score: 0,
    away_score: 0,
    home_team: { id: 't-home-2', name: 'Liverpool' },
    away_team: { id: 't-away-2', name: 'Everton' },
  },
]

const PREDICTIONS = [
  { id: 'p-1', member_id: 'm-1', fixture_id: 'fix-1', home_score: 2, away_score: 1 },
  { id: 'p-2', member_id: 'm-1', fixture_id: 'fix-2', home_score: 1, away_score: 0 },
  { id: 'p-3', member_id: 'm-2', fixture_id: 'fix-1', home_score: 1, away_score: 0 },
  { id: 'p-4', member_id: 'm-3', fixture_id: 'fix-1', home_score: 2, away_score: 2 },
]

const PREDICTION_SCORES = [
  { prediction_id: 'p-1', fixture_id: 'fix-1', member_id: 'm-1', points_awarded: 30 },
  { prediction_id: 'p-2', fixture_id: 'fix-2', member_id: 'm-1', points_awarded: 10 },
  { prediction_id: 'p-3', fixture_id: 'fix-1', member_id: 'm-2', points_awarded: 10 },
  { prediction_id: 'p-4', fixture_id: 'fix-1', member_id: 'm-3', points_awarded: 0 },
]

const BONUS_AWARDS = [
  {
    gameweek_id: GW_ID,
    member_id: 'm-1',
    fixture_id: 'fix-1',
    awarded: true,
    points_awarded: 20,
    bonus_type: { id: 'b-1', name: 'golden_glory' },
  },
  {
    gameweek_id: GW_ID,
    member_id: 'm-2',
    fixture_id: 'fix-1',
    awarded: null,
    points_awarded: 0,
    bonus_type: { id: 'b-1', name: 'golden_glory' },
  },
]

const LOS_PICKS = [
  {
    member_id: 'm-1',
    gameweek_id: GW_ID,
    fixture_id: 'fix-1',
    outcome: 'win',
    team: { id: 't-home-1', name: 'Arsenal' },
  },
  {
    member_id: 'm-2',
    gameweek_id: GW_ID,
    fixture_id: 'fix-2',
    outcome: 'draw',
    team: { id: 't-home-2', name: 'Liverpool' },
  },
  // m-3 has no pick this gw → losStatus.survived === null (pending)
]

const LOS_COMPETITION_MEMBERS = [
  { member_id: 'm-1', status: 'active', eliminated_at_gw: null },
  { member_id: 'm-2', status: 'eliminated', eliminated_at_gw: 5 },
  { member_id: 'm-3', status: 'active', eliminated_at_gw: null },
]

const H2H_STEALS = [
  // Detected in this gw, resolves later
  {
    detected_in_gw_id: GW_ID,
    resolves_in_gw_id: GW2_ID,
    position: 1,
    tied_member_ids: ['m-1', 'm-2'],
    winner_ids: null,
    resolved_at: null,
  },
  // Detected earlier, resolving THIS gw — reports must still surface this
  {
    detected_in_gw_id: 'older-gw',
    resolves_in_gw_id: GW_ID,
    position: 2,
    tied_member_ids: ['m-2', 'm-3'],
    winner_ids: ['m-2'],
    resolved_at: '2025-09-19T12:00:00Z',
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function installMockClient(tables: Parameters<typeof mockSupabaseFrom>[0]) {
  const mock = mockSupabaseFrom(tables)
  vi.mocked(createAdminClient).mockReturnValue(
    mock as unknown as ReturnType<typeof createAdminClient>,
  )
  return mock
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('gatherGameweekData', () => {
  it('1. standings are sorted by totalPoints DESC with 1-indexed rank', async () => {
    installMockClient({
      gameweeks: GAMEWEEK,
      fixtures: FIXTURES,
      predictions: PREDICTIONS,
      prediction_scores: PREDICTION_SCORES,
      bonus_awards: BONUS_AWARDS,
      los_picks: LOS_PICKS,
      h2h_steals: H2H_STEALS,
      members: MEMBERS,
      los_competition_members: LOS_COMPETITION_MEMBERS,
    })

    const data = await gatherGameweekData(GW_ID)

    // Alice: starting 50 + 30 (p-1) + 10 (p-2) + 20 (bonus) = 110
    // Bob:   starting 0  + 10 (p-3) + 0 (pending bonus)     = 10
    // Charlie: starting 0 + 0 (p-4)                          = 0
    expect(data.standings.map((s) => s.displayName)).toEqual([
      'Alice',
      'Bob',
      'Charlie',
    ])
    expect(data.standings[0].rank).toBe(1)
    expect(data.standings[0].totalPoints).toBe(110)
    expect(data.standings[1].rank).toBe(2)
    expect(data.standings[2].rank).toBe(3)
  })

  it('2. predictionsByMember keyed by memberId with isBonusFixture + bonus points only on awarded=true', async () => {
    installMockClient({
      gameweeks: GAMEWEEK,
      fixtures: FIXTURES,
      predictions: PREDICTIONS,
      prediction_scores: PREDICTION_SCORES,
      bonus_awards: BONUS_AWARDS,
      los_picks: LOS_PICKS,
      h2h_steals: H2H_STEALS,
      members: MEMBERS,
      los_competition_members: LOS_COMPETITION_MEMBERS,
    })

    const data = await gatherGameweekData(GW_ID)

    const alice = data.predictionsByMember['m-1']
    expect(alice).toHaveLength(2)

    const aliceFix1 = alice.find((p) => p.fixtureId === 'fix-1')!
    expect(aliceFix1.pointsAwarded).toBe(30)
    expect(aliceFix1.isBonusFixture).toBe(true)
    expect(aliceFix1.bonusPointsAwarded).toBe(20)

    // Bob's bonus pick is still pending (awarded=null) → bonusPointsAwarded=0
    const bob = data.predictionsByMember['m-2']
    const bobFix1 = bob.find((p) => p.fixtureId === 'fix-1')!
    expect(bobFix1.isBonusFixture).toBe(true)
    expect(bobFix1.bonusPointsAwarded).toBe(0)
  })

  it('3. losStatus: eliminated=true when LOS member row shows eliminated; survived=null when no pick', async () => {
    installMockClient({
      gameweeks: GAMEWEEK,
      fixtures: FIXTURES,
      predictions: PREDICTIONS,
      prediction_scores: PREDICTION_SCORES,
      bonus_awards: BONUS_AWARDS,
      los_picks: LOS_PICKS,
      h2h_steals: H2H_STEALS,
      members: MEMBERS,
      los_competition_members: LOS_COMPETITION_MEMBERS,
    })

    const data = await gatherGameweekData(GW_ID)

    const statusByMember = Object.fromEntries(
      data.losStatus.map((s) => [s.memberId, s]),
    )
    // Bob: eliminated=true (competition_members status=eliminated)
    expect(statusByMember['m-2'].eliminated).toBe(true)
    // Alice: survived=true (win outcome)
    expect(statusByMember['m-1'].survived).toBe(true)
    // Charlie: no los_pick row → survived=null (pending)
    expect(statusByMember['m-3'].survived).toBe(null)
  })

  it('4. h2hSteals include rows where detected_in_gw_id OR resolves_in_gw_id matches queried gw', async () => {
    installMockClient({
      gameweeks: GAMEWEEK,
      fixtures: FIXTURES,
      predictions: PREDICTIONS,
      prediction_scores: PREDICTION_SCORES,
      bonus_awards: BONUS_AWARDS,
      los_picks: LOS_PICKS,
      h2h_steals: H2H_STEALS,
      members: MEMBERS,
      los_competition_members: LOS_COMPETITION_MEMBERS,
    })

    const data = await gatherGameweekData(GW_ID)
    expect(data.h2hSteals).toHaveLength(2)
    // Newly detected
    expect(data.h2hSteals.some((s) => s.detectedInGwId === GW_ID)).toBe(true)
    // Resolving this gw
    expect(data.h2hSteals.some((s) => s.resolvesInGwId === GW_ID)).toBe(true)
  })

  it('5. topWeekly returns top 3 by weeklyPoints with alpha tiebreak', async () => {
    installMockClient({
      gameweeks: GAMEWEEK,
      fixtures: FIXTURES,
      predictions: PREDICTIONS,
      prediction_scores: PREDICTION_SCORES,
      bonus_awards: BONUS_AWARDS,
      los_picks: LOS_PICKS,
      h2h_steals: H2H_STEALS,
      members: MEMBERS,
      los_competition_members: LOS_COMPETITION_MEMBERS,
    })

    const data = await gatherGameweekData(GW_ID)
    expect(data.topWeekly).toHaveLength(3)
    // Alice weekly: 30+10+20(bonus)=60; Bob: 10; Charlie: 0.
    expect(data.topWeekly[0].memberId).toBe('m-1')
    expect(data.topWeekly[0].weeklyPoints).toBe(60)
    expect(data.topWeekly[1].memberId).toBe('m-2')
    expect(data.topWeekly[2].memberId).toBe('m-3')
  })

  it('6. closedAtIso is null if gameweeks.closed_at is null', async () => {
    installMockClient({
      gameweeks: { ...GAMEWEEK, closed_at: null },
      fixtures: FIXTURES,
      predictions: PREDICTIONS,
      prediction_scores: PREDICTION_SCORES,
      bonus_awards: BONUS_AWARDS,
      los_picks: LOS_PICKS,
      h2h_steals: H2H_STEALS,
      members: MEMBERS,
      los_competition_members: LOS_COMPETITION_MEMBERS,
    })

    const data = await gatherGameweekData(GW_ID)
    expect(data.closedAtIso).toBe(null)
  })

  it('7. doubleBubbleActive reflects gameweeks.double_bubble', async () => {
    installMockClient({
      gameweeks: { ...GAMEWEEK, double_bubble: false },
      fixtures: FIXTURES,
      predictions: PREDICTIONS,
      prediction_scores: PREDICTION_SCORES,
      bonus_awards: BONUS_AWARDS,
      los_picks: LOS_PICKS,
      h2h_steals: H2H_STEALS,
      members: MEMBERS,
      los_competition_members: LOS_COMPETITION_MEMBERS,
    })

    const data = await gatherGameweekData(GW_ID)
    expect(data.doubleBubbleActive).toBe(false)
  })

  it('8. empty gameweek (no predictions) returns empty containers without throwing', async () => {
    installMockClient({
      gameweeks: GAMEWEEK,
      fixtures: [],
      predictions: [],
      prediction_scores: [],
      bonus_awards: [],
      los_picks: [],
      h2h_steals: [],
      members: MEMBERS,
      los_competition_members: [],
    })

    const data = await gatherGameweekData(GW_ID)
    expect(data.fixtures).toEqual([])
    expect(data.predictionsByMember).toEqual({})
    expect(data.h2hSteals).toEqual([])
    expect(data.topWeekly).toEqual([])
    // standings still populated from members table (weekly=0, total=starting)
    expect(data.standings).toHaveLength(3)
    expect(data.standings.every((s) => s.weeklyPoints === 0)).toBe(true)
  })
})

describe('shapeData (pure transform helper)', () => {
  it('is exported as a pure function testable in isolation', () => {
    const result: GameweekReportData = shapeData({
      gameweek: GAMEWEEK,
      fixtures: FIXTURES,
      predictions: PREDICTIONS,
      predictionScores: PREDICTION_SCORES,
      bonusAwards: BONUS_AWARDS,
      losPicks: LOS_PICKS,
      losMembers: LOS_COMPETITION_MEMBERS,
      h2hSteals: H2H_STEALS,
      members: MEMBERS,
      gwId: GW_ID,
    })
    expect(result.gwId).toBe(GW_ID)
    expect(result.gwNumber).toBe(5)
    expect(result.seasonLabel).toBe('2025-26')
  })
})
