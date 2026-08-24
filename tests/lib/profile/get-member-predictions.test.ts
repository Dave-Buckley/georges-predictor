/**
 * Tests for the kick-off reveal gate on /members/[slug] predictions.
 *
 * This is the security-critical part of the feature. /members/[slug] runs on
 * the ADMIN client, which bypasses RLS, so the rule encoded in
 * `predictions_select_member` (migration 003) has to be re-implemented in
 * application code. These tests are what stops that drifting.
 *
 * The rule: a prediction is visible once its fixture has kicked off, because
 * that is also the moment it can no longer be changed. Before kick-off it must
 * not leak — otherwise a member could read a rival's pick and change their own.
 */
import { describe, it, expect, vi } from 'vitest'

import {
  getMemberPredictionsForGameweek,
  getRevealedGameweekNumbers,
} from '@/lib/profile/get-member-predictions'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const NOW = '2026-08-22T12:00:00.000Z'
const MEMBER = 'member-1'
const GW_ID = 'gw-1'

const KICKED_OFF = {
  id: 'fx-played',
  kickoff_time: '2026-08-21T19:00:00.000Z', // before NOW
  status: 'FINISHED',
  home_score: 3,
  away_score: 0,
  home_team: { name: 'Arsenal', short_name: 'Arsenal', crest_url: 'a.png' },
  away_team: { name: 'Coventry City', short_name: 'Coventry', crest_url: 'c.png' },
}

const NOT_STARTED = {
  id: 'fx-upcoming',
  kickoff_time: '2026-08-23T14:00:00.000Z', // after NOW
  status: 'TIMED',
  home_score: null,
  away_score: null,
  home_team: { name: 'Everton', short_name: 'Everton', crest_url: 'e.png' },
  away_team: { name: 'Crystal Palace', short_name: 'Palace', crest_url: 'p.png' },
}

/**
 * Minimal Supabase double. Records which fixture ids each `.in()` was called
 * with so a test can assert the hidden fixture was never even queried for.
 */
function makeAdmin() {
  const inCalls: string[][] = []

  const client = {
    from: vi.fn((table: string) => {
      if (table === 'gameweeks') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi
            .fn()
            .mockResolvedValue({ data: { id: GW_ID, number: 1 }, error: null }),
          order: vi.fn().mockResolvedValue({
            data: [{ id: GW_ID, number: 1 }],
            error: null,
          }),
        }
      }
      if (table === 'fixtures') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          lte: vi
            .fn()
            .mockResolvedValue({ data: [{ gameweek_id: GW_ID }], error: null }),
          order: vi.fn().mockResolvedValue({
            data: [KICKED_OFF, NOT_STARTED],
            error: null,
          }),
        }
      }
      if (table === 'predictions') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn((_col: string, ids: string[]) => {
            inCalls.push(ids)
            return Promise.resolve({
              data: [
                { fixture_id: 'fx-played', home_score: 3, away_score: 0 },
                // The member DID predict the upcoming match. It must not surface.
                { fixture_id: 'fx-upcoming', home_score: 1, away_score: 1 },
              ],
              error: null,
            })
          }),
        }
      }
      // prediction_scores
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn(() =>
          Promise.resolve({
            data: [
              { fixture_id: 'fx-played', points_awarded: 30, score_correct: true },
            ],
            error: null,
          }),
        ),
      }
    }),
  }

  return { client, inCalls }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getMemberPredictionsForGameweek — kick-off reveal gate', () => {
  it('Test 1: hides a fixture that has not kicked off', async () => {
    const { client } = makeAdmin()

    const result = await getMemberPredictionsForGameweek(
      client as never,
      MEMBER,
      1,
      { nowIso: NOW },
    )

    expect(result).not.toBeNull()
    expect(result!.rows).toHaveLength(1)
    expect(result!.rows[0].fixtureId).toBe('fx-played')
    expect(result!.hiddenCount).toBe(1)
  })

  it('Test 2: the un-kicked-off pick never appears in the output at all', async () => {
    const { client } = makeAdmin()

    const result = await getMemberPredictionsForGameweek(
      client as never,
      MEMBER,
      1,
      { nowIso: NOW },
    )

    // The double deliberately returns a prediction for fx-upcoming. Nothing
    // about it — not the score, not the fixture — may reach the caller.
    const serialised = JSON.stringify(result)
    expect(serialised).not.toContain('fx-upcoming')
    expect(serialised).not.toContain('Palace')
  })

  it('Test 3: the hidden fixture is not even included in the predictions query', async () => {
    const { client, inCalls } = makeAdmin()

    await getMemberPredictionsForGameweek(client as never, MEMBER, 1, {
      nowIso: NOW,
    })

    // Defence in depth: we filter fixtures BEFORE asking for predictions, so a
    // future change to the mapping cannot accidentally expose a withheld pick.
    expect(inCalls.length).toBeGreaterThan(0)
    for (const ids of inCalls) {
      expect(ids).toContain('fx-played')
      expect(ids).not.toContain('fx-upcoming')
    }
  })

  it('Test 4: includeUnplayed shows everything — viewing your own profile', async () => {
    const { client } = makeAdmin()

    const result = await getMemberPredictionsForGameweek(
      client as never,
      MEMBER,
      1,
      { nowIso: NOW, includeUnplayed: true },
    )

    expect(result!.rows).toHaveLength(2)
    expect(result!.hiddenCount).toBe(0)
  })

  it('Test 5: a revealed prediction stays revealed long after the match', async () => {
    const { client } = makeAdmin()

    // A year later. Kicked-off fixtures must still be visible, so the gameweek
    // navigation can page back through the whole season.
    const result = await getMemberPredictionsForGameweek(
      client as never,
      MEMBER,
      1,
      { nowIso: '2027-08-22T12:00:00.000Z', includeUnplayed: false },
    )

    expect(result!.rows.length).toBeGreaterThanOrEqual(1)
    expect(result!.rows.some((r) => r.fixtureId === 'fx-played')).toBe(true)
  })

  it('Test 6: scored predictions carry their points and exact-score flag', async () => {
    const { client } = makeAdmin()

    const result = await getMemberPredictionsForGameweek(
      client as never,
      MEMBER,
      1,
      { nowIso: NOW },
    )

    const row = result!.rows[0]
    expect(row.predictedHome).toBe(3)
    expect(row.predictedAway).toBe(0)
    expect(row.actualHome).toBe(3)
    expect(row.pointsAwarded).toBe(30)
    expect(row.exact).toBe(true)
    expect(result!.totalPoints).toBe(30)
  })
})

describe('getRevealedGameweekNumbers', () => {
  it('Test 7: only offers gameweeks with at least one kicked-off fixture', async () => {
    const { client } = makeAdmin()

    const numbers = await getRevealedGameweekNumbers(client as never, NOW)

    expect(numbers).toEqual([1])
  })

  it('Test 8: returns an empty list rather than throwing when the query fails', async () => {
    const broken = {
      from: vi.fn(() => {
        throw new Error('connection lost')
      }),
    }

    const numbers = await getRevealedGameweekNumbers(broken as never, NOW)

    expect(numbers).toEqual([])
  })
})
