/**
 * aggregateSeasonStats pure-function tests — Phase 11 Plan 02 Task 1.
 *
 * This suite exercises the pure aggregation library in isolation:
 * no DB, no network, no imports beyond vitest + the module under test.
 *
 * Every test uses inline structural fixtures typed via `as any` where the DB
 * row shape is broader than what the library cares about. The library MUST
 * ignore unknown fields and only read the structural contract documented in
 * src/lib/profile/stats.ts.
 */
import { describe, it, expect } from 'vitest'

import {
  aggregateSeasonStats,
  type SeasonStats,
} from '@/lib/profile/stats'

// ─── Fixture helpers ─────────────────────────────────────────────────────────

const M = 'member-under-test'
const OTHER1 = 'member-other-1'
const OTHER2 = 'member-other-2'
const SEASON = 2025

function score(
  memberId: string,
  gameweekId: string,
  points: 0 | 10 | 30,
): unknown {
  return {
    id: `ps-${memberId}-${gameweekId}-${Math.random()}`,
    prediction_id: `pred-${memberId}-${gameweekId}`,
    fixture_id: `fx-${gameweekId}-0`,
    gameweek_id: gameweekId,
    member_id: memberId,
    predicted_home: 1,
    predicted_away: 0,
    actual_home: 1,
    actual_away: 0,
    result_correct: points > 0,
    score_correct: points === 30,
    points_awarded: points,
    calculated_at: '2025-08-01T00:00:00Z',
  }
}

function bonus(
  memberId: string,
  gameweekId: string,
  awarded: boolean | null,
  points = 20,
): unknown {
  return {
    id: `b-${memberId}-${gameweekId}-${Math.random()}`,
    gameweek_id: gameweekId,
    member_id: memberId,
    bonus_type_id: 'bt-1',
    fixture_id: null,
    awarded,
    confirmed_by: awarded === true ? 'admin' : null,
    confirmed_at: awarded === true ? '2025-09-01T00:00:00Z' : null,
    points_awarded: awarded === true ? points : 0,
    created_at: '2025-08-01T00:00:00Z',
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('aggregateSeasonStats', () => {
  it('empty-input smoke: zero scores, no picks, no awards => all-zero stats', () => {
    const out: SeasonStats = aggregateSeasonStats({
      predictionScores: [],
      bonusAwards: [],
      prizeAwards: [],
      preSeasonAward: null,
      losPicks: [],
      losCompetitions: [],
      h2hSteals: [],
      gameweeks: [],
      weeklyLeaderboard: [],
      allMemberTotals: [{ memberId: M, totalPoints: 0 }],
      memberId: M,
      season: SEASON,
    })

    expect(out.totalPoints).toBe(0)
    expect(out.rank).toBe(1)
    expect(out.predictionAccuracy).toBe(0)
    expect(out.correctResults).toBe(0)
    expect(out.correctScores).toBe(0)
    expect(out.bonusConfirmationRate).toBe(0)
    expect(out.losStatus).toBe('not-participating')
    expect(out.losTeamsUsed).toBe(0)
    expect(out.losWins).toBe(0)
    expect(out.gwWinnerCount).toBe(0)
    expect(out.achievements).toEqual([])
    expect(out.season).toBe(SEASON)
  })

  it('aggregates 10 prediction_scores mix: 5x @ 10pts + 2x @ 30pts + 3x @ 0pts', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ps: any[] = [
      score(M, 'gw1', 10),
      score(M, 'gw1', 10),
      score(M, 'gw1', 10),
      score(M, 'gw1', 10),
      score(M, 'gw1', 10),
      score(M, 'gw2', 30),
      score(M, 'gw2', 30),
      score(M, 'gw3', 0),
      score(M, 'gw3', 0),
      score(M, 'gw3', 0),
    ]

    const out = aggregateSeasonStats({
      predictionScores: ps,
      bonusAwards: [],
      prizeAwards: [],
      preSeasonAward: null,
      losPicks: [],
      losCompetitions: [],
      h2hSteals: [],
      gameweeks: [],
      weeklyLeaderboard: [],
      allMemberTotals: [{ memberId: M, totalPoints: 110 }],
      memberId: M,
      season: SEASON,
    })

    expect(out.totalPoints).toBe(5 * 10 + 2 * 30) // 50 + 60 = 110
    expect(out.correctResults).toBe(5)
    expect(out.correctScores).toBe(2)
    // accuracy = (correctResults + correctScores) / totalPredictions = 7/10
    expect(out.predictionAccuracy).toBeCloseTo(0.7, 5)
  })

  it('bonus confirmation rate: all confirmed / mixed / all rejected / empty', () => {
    // All confirmed
    let out = aggregateSeasonStats({
      predictionScores: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      bonusAwards: [bonus(M, 'gw1', true), bonus(M, 'gw2', true)] as any[],
      prizeAwards: [],
      preSeasonAward: null,
      losPicks: [],
      losCompetitions: [],
      h2hSteals: [],
      gameweeks: [],
      weeklyLeaderboard: [],
      allMemberTotals: [{ memberId: M, totalPoints: 40 }],
      memberId: M,
      season: SEASON,
    })
    expect(out.bonusConfirmationRate).toBe(1)

    // Mixed: 2 confirmed, 1 pending, 1 rejected -> 2/4
    out = aggregateSeasonStats({
      predictionScores: [],
      bonusAwards: [
        bonus(M, 'gw1', true),
        bonus(M, 'gw2', true),
        bonus(M, 'gw3', null),
        bonus(M, 'gw4', false),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ] as any[],
      prizeAwards: [],
      preSeasonAward: null,
      losPicks: [],
      losCompetitions: [],
      h2hSteals: [],
      gameweeks: [],
      weeklyLeaderboard: [],
      allMemberTotals: [{ memberId: M, totalPoints: 40 }],
      memberId: M,
      season: SEASON,
    })
    expect(out.bonusConfirmationRate).toBe(0.5)

    // Empty -> 0
    out = aggregateSeasonStats({
      predictionScores: [],
      bonusAwards: [],
      prizeAwards: [],
      preSeasonAward: null,
      losPicks: [],
      losCompetitions: [],
      h2hSteals: [],
      gameweeks: [],
      weeklyLeaderboard: [],
      allMemberTotals: [{ memberId: M, totalPoints: 0 }],
      memberId: M,
      season: SEASON,
    })
    expect(out.bonusConfirmationRate).toBe(0)
  })

  it('losStatus: winner / active / eliminated / not-participating', () => {
    // Winner
    const winnerOut = aggregateSeasonStats({
      predictionScores: [],
      bonusAwards: [],
      prizeAwards: [],
      preSeasonAward: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      losPicks: [
        { id: 'p1', competition_id: 'c1', member_id: M, gameweek_id: 'gw1', team_id: 't1', fixture_id: 'fx', outcome: 'win' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ] as any[],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      losCompetitions: [
        { id: 'c1', season: SEASON, competition_num: 1, status: 'complete', starts_at_gw: 1, ended_at_gw: 5, winner_id: M },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ] as any[],
      h2hSteals: [],
      gameweeks: [],
      weeklyLeaderboard: [],
      allMemberTotals: [{ memberId: M, totalPoints: 0 }],
      memberId: M,
      season: SEASON,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      losCompetitionMembers: [
        { competition_id: 'c1', member_id: M, status: 'active', eliminated_at_gw: null },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ] as any[],
    })
    expect(winnerOut.losStatus).toBe('winner')
    expect(winnerOut.losWins).toBe(1)

    // Active
    const activeOut = aggregateSeasonStats({
      predictionScores: [],
      bonusAwards: [],
      prizeAwards: [],
      preSeasonAward: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      losPicks: [
        { id: 'p1', competition_id: 'c1', member_id: M, gameweek_id: 'gw1', team_id: 't1', fixture_id: 'fx' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ] as any[],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      losCompetitions: [
        { id: 'c1', season: SEASON, competition_num: 1, status: 'active', starts_at_gw: 1, ended_at_gw: null, winner_id: null },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ] as any[],
      h2hSteals: [],
      gameweeks: [],
      weeklyLeaderboard: [],
      allMemberTotals: [{ memberId: M, totalPoints: 0 }],
      memberId: M,
      season: SEASON,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      losCompetitionMembers: [
        { competition_id: 'c1', member_id: M, status: 'active', eliminated_at_gw: null },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ] as any[],
    })
    expect(activeOut.losStatus).toBe('active')

    // Eliminated
    const eliminatedOut = aggregateSeasonStats({
      predictionScores: [],
      bonusAwards: [],
      prizeAwards: [],
      preSeasonAward: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      losPicks: [
        { id: 'p1', competition_id: 'c1', member_id: M, gameweek_id: 'gw1', team_id: 't1', fixture_id: 'fx' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ] as any[],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      losCompetitions: [
        { id: 'c1', season: SEASON, competition_num: 1, status: 'active', starts_at_gw: 1, ended_at_gw: null, winner_id: null },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ] as any[],
      h2hSteals: [],
      gameweeks: [],
      weeklyLeaderboard: [],
      allMemberTotals: [{ memberId: M, totalPoints: 0 }],
      memberId: M,
      season: SEASON,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      losCompetitionMembers: [
        { competition_id: 'c1', member_id: M, status: 'eliminated', eliminated_at_gw: 3 },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ] as any[],
    })
    expect(eliminatedOut.losStatus).toBe('eliminated')

    // Not participating
    const npOut = aggregateSeasonStats({
      predictionScores: [],
      bonusAwards: [],
      prizeAwards: [],
      preSeasonAward: null,
      losPicks: [],
      losCompetitions: [],
      h2hSteals: [],
      gameweeks: [],
      weeklyLeaderboard: [],
      allMemberTotals: [{ memberId: M, totalPoints: 0 }],
      memberId: M,
      season: SEASON,
    })
    expect(npOut.losStatus).toBe('not-participating')
  })

  it('losTeamsUsed de-duplicates distinct team ids across competitions', () => {
    const out = aggregateSeasonStats({
      predictionScores: [],
      bonusAwards: [],
      prizeAwards: [],
      preSeasonAward: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      losPicks: [
        { id: 'p1', competition_id: 'c1', member_id: M, gameweek_id: 'gw1', team_id: 't-A', fixture_id: 'fx1' },
        { id: 'p2', competition_id: 'c1', member_id: M, gameweek_id: 'gw2', team_id: 't-B', fixture_id: 'fx2' },
        { id: 'p3', competition_id: 'c2', member_id: M, gameweek_id: 'gw3', team_id: 't-A', fixture_id: 'fx3' }, // dup across cycles
        { id: 'p4', competition_id: 'c2', member_id: M, gameweek_id: 'gw4', team_id: 't-C', fixture_id: 'fx4' },
        { id: 'p5', competition_id: 'c1', member_id: OTHER1, gameweek_id: 'gw1', team_id: 't-Z', fixture_id: 'fx5' }, // not this member
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ] as any[],
      losCompetitions: [],
      h2hSteals: [],
      gameweeks: [],
      weeklyLeaderboard: [],
      allMemberTotals: [{ memberId: M, totalPoints: 0 }],
      memberId: M,
      season: SEASON,
    })
    // t-A, t-B, t-C => 3 distinct teams
    expect(out.losTeamsUsed).toBe(3)
  })

  it('losWins counts competitions won across season', () => {
    const out = aggregateSeasonStats({
      predictionScores: [],
      bonusAwards: [],
      prizeAwards: [],
      preSeasonAward: null,
      losPicks: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      losCompetitions: [
        { id: 'c1', season: SEASON, competition_num: 1, status: 'complete', starts_at_gw: 1, ended_at_gw: 5, winner_id: M },
        { id: 'c2', season: SEASON, competition_num: 2, status: 'complete', starts_at_gw: 6, ended_at_gw: 8, winner_id: OTHER1 },
        { id: 'c3', season: SEASON, competition_num: 3, status: 'complete', starts_at_gw: 9, ended_at_gw: 12, winner_id: M },
        { id: 'c4', season: 2024, competition_num: 4, status: 'complete', starts_at_gw: 1, ended_at_gw: 4, winner_id: M }, // wrong season
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ] as any[],
      h2hSteals: [],
      gameweeks: [],
      weeklyLeaderboard: [],
      allMemberTotals: [{ memberId: M, totalPoints: 0 }],
      memberId: M,
      season: SEASON,
    })
    expect(out.losWins).toBe(2) // c1 + c3
  })

  it('gwWinnerCount excludes ties — only sole wins count', () => {
    const out = aggregateSeasonStats({
      predictionScores: [],
      bonusAwards: [],
      prizeAwards: [],
      preSeasonAward: null,
      losPicks: [],
      losCompetitions: [],
      h2hSteals: [],
      gameweeks: [],
      // Caller-computed weekly leaderboard: the caller is responsible for
      // determining who topped each GW; ties produce >1 entry in topMemberIds.
      weeklyLeaderboard: [
        { gameweekId: 'gw1', topMemberIds: [M] }, // sole win
        { gameweekId: 'gw2', topMemberIds: [M, OTHER1] }, // tie — does not count
        { gameweekId: 'gw3', topMemberIds: [OTHER1] }, // not ours
        { gameweekId: 'gw4', topMemberIds: [M] }, // sole win
      ],
      allMemberTotals: [{ memberId: M, totalPoints: 0 }],
      memberId: M,
      season: SEASON,
    })
    expect(out.gwWinnerCount).toBe(2)
  })

  it('achievements include gw-winner (per sole win), los-winner (per won comp), h2h-survivor, pre-season-all-correct', () => {
    const out = aggregateSeasonStats({
      predictionScores: [],
      bonusAwards: [],
      prizeAwards: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      preSeasonAward: {
        id: 'psa-1',
        member_id: M,
        season: SEASON,
        calculated_points: 360,
        awarded_points: 360,
        flags: {
          all_top4_correct: true,
          all_relegated_correct: true,
          all_promoted_correct: true,
          all_correct_overall: true,
        },
        confirmed: true,
        confirmed_by: 'admin',
        confirmed_at: '2025-08-01T00:00:00Z',
      },
      losPicks: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      losCompetitions: [
        { id: 'c1', season: SEASON, competition_num: 1, status: 'complete', starts_at_gw: 1, ended_at_gw: 5, winner_id: M },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ] as any[],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      h2hSteals: [
        { id: 'h1', detected_in_gw_id: 'gw5', resolves_in_gw_id: 'gw6', position: 1, tied_member_ids: [M, OTHER1], winner_ids: [M], resolved_at: '2025-10-01T00:00:00Z' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ] as any[],
      gameweeks: [{ id: 'gw1', number: 1 }, { id: 'gw4', number: 4 }],
      weeklyLeaderboard: [
        { gameweekId: 'gw1', topMemberIds: [M] },
        { gameweekId: 'gw4', topMemberIds: [M] },
      ],
      allMemberTotals: [{ memberId: M, totalPoints: 400 }],
      memberId: M,
      season: SEASON,
    })

    const kinds = out.achievements.map((a) => a.kind)
    // Two GW wins + one LOS win + one H2H survivor + pre-season all-correct
    expect(kinds.filter((k) => k === 'gw-winner').length).toBe(2)
    expect(kinds.filter((k) => k === 'los-winner').length).toBe(1)
    expect(kinds.filter((k) => k === 'h2h-survivor').length).toBe(1)
    expect(kinds.filter((k) => k === 'pre-season-all-correct').length).toBe(1)
  })

  it('rank derived via dense rank on allMemberTotals (ties share rank)', () => {
    // Totals: OTHER1=100, M=80, OTHER2=80, third=50 => ranks 1, 2, 2, 3
    const out = aggregateSeasonStats({
      predictionScores: [],
      bonusAwards: [],
      prizeAwards: [],
      preSeasonAward: null,
      losPicks: [],
      losCompetitions: [],
      h2hSteals: [],
      gameweeks: [],
      weeklyLeaderboard: [],
      allMemberTotals: [
        { memberId: OTHER1, totalPoints: 100 },
        { memberId: M, totalPoints: 80 },
        { memberId: OTHER2, totalPoints: 80 },
        { memberId: 'x', totalPoints: 50 },
      ],
      memberId: M,
      season: SEASON,
    })
    expect(out.rank).toBe(2)
  })

  it('rank returns null if memberId not in allMemberTotals', () => {
    const out = aggregateSeasonStats({
      predictionScores: [],
      bonusAwards: [],
      prizeAwards: [],
      preSeasonAward: null,
      losPicks: [],
      losCompetitions: [],
      h2hSteals: [],
      gameweeks: [],
      weeklyLeaderboard: [],
      allMemberTotals: [{ memberId: OTHER1, totalPoints: 100 }],
      memberId: M,
      season: SEASON,
    })
    expect(out.rank).toBe(null)
  })

  it('totalPoints combines prediction scores + confirmed bonus + confirmed prize + confirmed pre-season award', () => {
    const out = aggregateSeasonStats({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      predictionScores: [score(M, 'gw1', 30), score(M, 'gw1', 10)] as any[], // 40
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      bonusAwards: [
        bonus(M, 'gw1', true, 20), // +20
        bonus(M, 'gw1', null, 20), // pending — not counted
        bonus(M, 'gw2', false, 20), // rejected — not counted
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ] as any[],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prizeAwards: [
        { id: 'pa1', prize_id: 'pz1', member_id: M, gameweek_id: 'gw1', status: 'confirmed', points_awarded: 50 },
        { id: 'pa2', prize_id: 'pz2', member_id: M, gameweek_id: 'gw2', status: 'pending', points_awarded: 30 },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ] as any[],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      preSeasonAward: {
        id: 'psa-1',
        member_id: M,
        season: SEASON,
        calculated_points: 60,
        awarded_points: 60,
        flags: { all_top4_correct: false, all_relegated_correct: false, all_promoted_correct: false, all_correct_overall: false },
        confirmed: true,
        confirmed_by: 'admin',
        confirmed_at: '2025-08-01T00:00:00Z',
      },
      losPicks: [],
      losCompetitions: [],
      h2hSteals: [],
      gameweeks: [],
      weeklyLeaderboard: [],
      allMemberTotals: [{ memberId: M, totalPoints: 170 }],
      memberId: M,
      season: SEASON,
    })
    // 40 (preds) + 20 (confirmed bonus) + 50 (confirmed prize) + 60 (pre-season) = 170
    expect(out.totalPoints).toBe(170)
  })
})
