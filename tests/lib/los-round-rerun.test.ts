/**
 * Regression test: re-running an already-resolved LOS round must not wipe the
 * competition.
 *
 * The bug. runLosRound used to load only picks with `outcome IS NULL`.
 * evaluateLosRound derives "who missed this round" as active_member_ids minus
 * the members present in `picks`. So on a re-run of a settled gameweek every
 * pick was filtered out, `picks` arrived empty, and every still-active member
 * was classified as a missed submission and eliminated.
 *
 * It was dormant because sync.ts only calls runLosRound for gameweeks returned
 * by detectFullyFinishedGameweeks, which returns [] unless a fixture has
 * *newly* transitioned to FINISHED. A score correction or fixture re-sync on a
 * finished gameweek would have triggered it and knocked everyone out at once.
 *
 * The fix is to load every pick for the round, honouring the evaluator's
 * documented contract, and write back only the ones that were unevaluated.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock admin client (must register BEFORE import) ─────────────────────────

const adminMock = { from: vi.fn() }

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => adminMock),
}))

import { runLosRound } from '@/lib/los/round'

// ─── Scenario ─────────────────────────────────────────────────────────────────

const COMP = 'comp-1'
const GW = 'gw-1'
const HOME = 'team-home'
const AWAY = 'team-away'

/** Two survivors, both with picks already evaluated as wins. */
const SETTLED_PICKS = [
  {
    id: 'pick-a',
    member_id: 'member-a',
    team_id: HOME,
    fixture_id: 'fx-1',
    outcome: 'win',
  },
  {
    id: 'pick-b',
    member_id: 'member-b',
    team_id: HOME,
    fixture_id: 'fx-1',
    outcome: 'win',
  },
]

const FIXTURES = [
  {
    id: 'fx-1',
    status: 'FINISHED',
    home_team_id: HOME,
    away_team_id: AWAY,
    home_score: 2,
    away_score: 0,
  },
]

interface Recorded {
  eliminatedUpdates: Array<Record<string, unknown>>
  pickUpserts: Array<Record<string, unknown>>
}

function setupClient(picksReturned: typeof SETTLED_PICKS): Recorded {
  const recorded: Recorded = { eliminatedUpdates: [], pickUpserts: [] }

  adminMock.from.mockImplementation((table: string) => {
    if (table === 'los_competitions') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: COMP, season: 2026, status: 'active' },
          error: null,
        }),
        update: vi.fn().mockReturnThis(),
      }
    }

    if (table === 'gameweeks') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi
          .fn()
          .mockResolvedValue({ data: { id: GW, number: 1 }, error: null }),
      }
    }

    if (table === 'fixtures') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: FIXTURES, error: null }),
      }
    }

    if (table === 'los_competition_members') {
      const chain: Record<string, unknown> = {
        select: vi.fn().mockReturnThis(),
        // Two calls end on .eq(): the active-members SELECT, and the
        // elimination UPDATE. Resolve as the member list; the update path
        // records instead (see below).
        eq: vi.fn().mockImplementation(function (this: unknown) {
          return chainWithResolve
        }),
        update: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
          recorded.eliminatedUpdates.push(payload)
          return {
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }
        }),
      }
      const chainWithResolve = {
        ...chain,
        eq: vi.fn().mockResolvedValue({
          data: [
            { member_id: 'member-a', status: 'active' },
            { member_id: 'member-b', status: 'active' },
          ],
          error: null,
        }),
      }
      return chain
    }

    if (table === 'los_picks') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation(function (this: unknown, col: string) {
          // Second .eq() (gameweek_id) resolves the query.
          if (col === 'gameweek_id') {
            return Promise.resolve({ data: picksReturned, error: null })
          }
          return this
        }),
        // Simulates the real `.is('outcome', null)` filter the buggy version
        // used. It must return nothing here, because every pick is settled —
        // that is exactly what starved the missed-submission sweep and made it
        // eliminate the whole field. Without this the test would pass against
        // the bug and prove nothing.
        is: vi.fn().mockResolvedValue({
          data: picksReturned.filter((p) => p.outcome === null),
          error: null,
        }),
        upsert: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
          recorded.pickUpserts.push(payload)
          return Promise.resolve({ data: null, error: null })
        }),
      }
    }

    // admin_notifications and anything else
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
  })

  return recorded
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('runLosRound — re-running a settled round', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Test 1: does not mark surviving members as missed', async () => {
    setupClient(SETTLED_PICKS)

    const result = await runLosRound(adminMock as never, GW)

    // The whole point. Before the fix this returned both members.
    expect(result.missedMemberIds).toEqual([])
  })

  it('Test 2: does not eliminate anybody', async () => {
    setupClient(SETTLED_PICKS)

    const result = await runLosRound(adminMock as never, GW)

    expect(result.eliminatedMemberIds).toEqual([])
  })

  it('Test 3: does not rewrite picks that were already evaluated', async () => {
    const recorded = setupClient(SETTLED_PICKS)

    const result = await runLosRound(adminMock as never, GW)

    // Nothing new to settle, so nothing is written and the count is honest.
    expect(recorded.pickUpserts).toHaveLength(0)
    expect(result.evaluatedPickCount).toBe(0)
  })
})
