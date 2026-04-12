import { describe, it, expect } from 'vitest'
import {
  evaluateLosPick,
  evaluateLosRound,
  type LosRoundPickInput,
} from '@/lib/los/evaluate'

// ─── evaluateLosPick (LOS-02) ─────────────────────────────────────────────────

describe('evaluateLosPick', () => {
  const base = {
    pick_id: 'pick-1',
    home_team_id: 'team-home',
    away_team_id: 'team-away',
  }

  it('returns win + not eliminated when picked home team wins', () => {
    const result = evaluateLosPick({
      ...base,
      picked_team_id: 'team-home',
      home_score: 2,
      away_score: 1,
      fixture_status: 'FINISHED',
    })
    expect(result).toEqual({
      pick_id: 'pick-1',
      outcome: 'win',
      eliminated: false,
    })
  })

  it('returns win + not eliminated when picked away team wins', () => {
    const result = evaluateLosPick({
      ...base,
      picked_team_id: 'team-away',
      home_score: 0,
      away_score: 3,
      fixture_status: 'FINISHED',
    })
    expect(result.outcome).toBe('win')
    expect(result.eliminated).toBe(false)
  })

  it('returns lose + eliminated when picked home team loses', () => {
    const result = evaluateLosPick({
      ...base,
      picked_team_id: 'team-home',
      home_score: 0,
      away_score: 2,
      fixture_status: 'FINISHED',
    })
    expect(result.outcome).toBe('lose')
    expect(result.eliminated).toBe(true)
  })

  it('returns lose + eliminated when picked away team loses', () => {
    const result = evaluateLosPick({
      ...base,
      picked_team_id: 'team-away',
      home_score: 2,
      away_score: 1,
      fixture_status: 'FINISHED',
    })
    expect(result.outcome).toBe('lose')
    expect(result.eliminated).toBe(true)
  })

  it('returns draw + eliminated on a 1-1 draw regardless of picked side', () => {
    const home = evaluateLosPick({
      ...base,
      picked_team_id: 'team-home',
      home_score: 1,
      away_score: 1,
      fixture_status: 'FINISHED',
    })
    const away = evaluateLosPick({
      ...base,
      picked_team_id: 'team-away',
      home_score: 1,
      away_score: 1,
      fixture_status: 'FINISHED',
    })
    expect(home.outcome).toBe('draw')
    expect(home.eliminated).toBe(true)
    expect(away.outcome).toBe('draw')
    expect(away.eliminated).toBe(true)
  })

  it('returns pending when fixture_status is not FINISHED', () => {
    for (const status of ['SCHEDULED', 'TIMED', 'IN_PLAY', 'POSTPONED']) {
      const result = evaluateLosPick({
        ...base,
        picked_team_id: 'team-home',
        home_score: 2,
        away_score: 0,
        fixture_status: status,
      })
      expect(result.outcome).toBe('pending')
      expect(result.eliminated).toBe(false)
    }
  })

  it('returns pending when scores are null (fixture not yet scored)', () => {
    const result = evaluateLosPick({
      ...base,
      picked_team_id: 'team-home',
      home_score: null,
      away_score: null,
      fixture_status: 'FINISHED',
    })
    expect(result.outcome).toBe('pending')
    expect(result.eliminated).toBe(false)
  })

  it('returns pending when picked_team_id does not match either side (guard)', () => {
    const result = evaluateLosPick({
      ...base,
      picked_team_id: 'team-unrelated',
      home_score: 2,
      away_score: 1,
      fixture_status: 'FINISHED',
    })
    expect(result.outcome).toBe('pending')
    expect(result.eliminated).toBe(false)
  })
})

// ─── evaluateLosRound (LOS-05) ────────────────────────────────────────────────

describe('evaluateLosRound', () => {
  const mkPick = (overrides: Partial<LosRoundPickInput>): LosRoundPickInput => ({
    pick_id: 'p',
    member_id: 'm',
    team_id: 'team-home',
    fixture_id: 'f',
    home_team_id: 'team-home',
    away_team_id: 'team-away',
    home_score: 1,
    away_score: 0,
    fixture_status: 'FINISHED',
    ...overrides,
  })

  it('flags active members with no pick row as missed_submission (eliminated)', () => {
    const result = evaluateLosRound({
      active_member_ids: ['A', 'B', 'C'],
      picks: [
        mkPick({ pick_id: 'pa', member_id: 'A' }),
        mkPick({ pick_id: 'pb', member_id: 'B' }),
      ],
    })
    expect(result.missed_submission_member_ids).toEqual(['C'])
    expect(result.survivors).not.toContain('C')
  })

  it('excludes members whose pick lost from survivors', () => {
    const result = evaluateLosRound({
      active_member_ids: ['A', 'B', 'C'],
      picks: [
        // A wins
        mkPick({ pick_id: 'pa', member_id: 'A', home_score: 2, away_score: 0 }),
        // B loses
        mkPick({ pick_id: 'pb', member_id: 'B', home_score: 0, away_score: 2 }),
        // C draws
        mkPick({ pick_id: 'pc', member_id: 'C', home_score: 1, away_score: 1 }),
      ],
    })
    expect(result.survivors).toEqual(['A'])
    expect(result.missed_submission_member_ids).toEqual([])
  })

  it('sets winner_id when exactly one survivor remains', () => {
    const result = evaluateLosRound({
      active_member_ids: ['A', 'B'],
      picks: [
        mkPick({ pick_id: 'pa', member_id: 'A', home_score: 2, away_score: 0 }),
        mkPick({ pick_id: 'pb', member_id: 'B', home_score: 0, away_score: 2 }),
      ],
    })
    expect(result.winner_id).toBe('A')
    expect(result.survivors).toEqual(['A'])
  })

  it('returns winner_id=null when zero survivors (all eliminated simultaneously)', () => {
    const result = evaluateLosRound({
      active_member_ids: ['A', 'B'],
      picks: [
        mkPick({ pick_id: 'pa', member_id: 'A', home_score: 1, away_score: 1 }),
        mkPick({ pick_id: 'pb', member_id: 'B', home_score: 0, away_score: 2 }),
      ],
    })
    expect(result.winner_id).toBeNull()
    expect(result.survivors).toEqual([])
  })

  it('leaves pick-pending members (fixture not FINISHED) as survivors but winner_id=null', () => {
    const result = evaluateLosRound({
      active_member_ids: ['A', 'B'],
      picks: [
        mkPick({ pick_id: 'pa', member_id: 'A', fixture_status: 'SCHEDULED' }),
        mkPick({ pick_id: 'pb', member_id: 'B', home_score: 0, away_score: 2 }),
      ],
    })
    expect(result.survivors).toContain('A')
    expect(result.survivors).not.toContain('B')
    expect(result.winner_id).toBeNull() // A still pending
  })

  it('returns an evaluation entry per pick', () => {
    const result = evaluateLosRound({
      active_member_ids: ['A', 'B'],
      picks: [
        mkPick({ pick_id: 'pa', member_id: 'A', home_score: 2, away_score: 0 }),
        mkPick({ pick_id: 'pb', member_id: 'B', home_score: 0, away_score: 2 }),
      ],
    })
    expect(result.evaluations).toHaveLength(2)
    expect(result.evaluations.map((e) => e.pick_id).sort()).toEqual(['pa', 'pb'])
  })
})
