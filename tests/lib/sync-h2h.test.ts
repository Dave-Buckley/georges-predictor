/**
 * Integration tests for H2H sync hook (Phase 8 Plan 02).
 *
 * Covers detectH2HForGameweek + resolveStealsForGameweek (src/lib/h2h/sync-hook.ts).
 * Mocks the admin Supabase client; pure detectWeeklyTies + resolveSteal are
 * already tested in Plan 01 so we only verify orchestration + DB interaction
 * + idempotency here.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock admin client (must register BEFORE import) ─────────────────────────

const adminMock: { from: ReturnType<typeof vi.fn> } = { from: vi.fn() }

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => adminMock),
}))

// ─── Import after mock ───────────────────────────────────────────────────────

import { detectH2HForGameweek, resolveStealsForGameweek } from '@/lib/h2h/sync-hook'

// ─── Fixture UUIDs ───────────────────────────────────────────────────────────

const GW_CURRENT = 'd1e2f3a4-5b6c-4d7e-9f8a-0b1c2d3e4f5a'
const GW_NEXT    = 'e2f3a4b5-6c7d-4e8f-9a0b-1c2d3e4f5a6b'
const MEMBER_A   = '11111111-1111-4111-8111-111111111111'
const MEMBER_B   = '22222222-2222-4222-8222-222222222222'
const MEMBER_C   = '33333333-3333-4333-8333-333333333333'
const STEAL_ID   = '99999999-9999-4999-8999-999999999999'

// ─── Chain builder ───────────────────────────────────────────────────────────

function makeChain() {
  const chain: Record<string, unknown> = {}
  const fn = <T,>(val: T) => val
  const reassign = (f: () => void) => (f(), chain)

  const setup = () => {
    chain.select = vi.fn().mockReturnValue(chain)
    chain.eq = vi.fn().mockReturnValue(chain)
    chain.is = vi.fn().mockReturnValue(chain)
    chain.in = vi.fn().mockReturnValue(chain)
    chain.neq = vi.fn().mockReturnValue(chain)
    chain.order = vi.fn().mockReturnValue(chain)
    chain.limit = vi.fn().mockReturnValue(chain)
    chain.single = vi.fn().mockResolvedValue({ data: null, error: null })
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    chain.upsert = vi.fn().mockResolvedValue({ data: null, error: null })
    chain.insert = vi.fn().mockResolvedValue({ data: null, error: null })
    chain.update = vi.fn().mockReturnValue(chain)
    chain.delete = vi.fn().mockReturnValue(chain)
    chain.then = (resolve: (v: unknown) => unknown) =>
      resolve({ data: [], error: null })
  }
  setup()
  void fn
  void reassign
  return chain as {
    select: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    is: ReturnType<typeof vi.fn>
    in: ReturnType<typeof vi.fn>
    neq: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    limit: ReturnType<typeof vi.fn>
    single: ReturnType<typeof vi.fn>
    maybeSingle: ReturnType<typeof vi.fn>
    upsert: ReturnType<typeof vi.fn>
    insert: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
    then: (resolve: (v: unknown) => unknown) => unknown
  }
}

interface TableCfg {
  singleData?: unknown
  maybeSingleData?: unknown
  selectData?: unknown
  insertFn?: ReturnType<typeof vi.fn>
  updateFn?: ReturnType<typeof vi.fn>
}

function wire(state: Record<string, TableCfg>) {
  adminMock.from = vi.fn().mockImplementation((table: string) => {
    const cfg = state[table] ?? {}
    const chain = makeChain()
    if (cfg.singleData !== undefined) {
      chain.single = vi.fn().mockResolvedValue({ data: cfg.singleData, error: null })
    }
    if (cfg.maybeSingleData !== undefined) {
      chain.maybeSingle = vi.fn().mockResolvedValue({ data: cfg.maybeSingleData, error: null })
    }
    if (cfg.selectData !== undefined) {
      const data = cfg.selectData
      chain.then = (resolve: (v: unknown) => unknown) =>
        resolve({ data, error: null })
    }
    if (cfg.insertFn) chain.insert = cfg.insertFn
    if (cfg.updateFn) chain.update = cfg.updateFn
    return chain
  })
}

// ─── detectH2HForGameweek tests ──────────────────────────────────────────────

describe('detectH2HForGameweek', () => {
  beforeEach(() => vi.clearAllMocks())

  it('skips and returns 0 when gameweek closed_at is NULL', async () => {
    wire({
      gameweeks: {
        singleData: { id: GW_CURRENT, number: 10, closed_at: null },
      },
    })

    const result = await detectH2HForGameweek(adminMock, GW_CURRENT)

    expect(result.stealsCreated).toBe(0)
  })

  it('creates no steals when clear 1st/2nd (no ties)', async () => {
    const stealInsertFn = vi.fn().mockResolvedValue({ error: null })
    wire({
      gameweeks: {
        singleData: { id: GW_CURRENT, number: 10, closed_at: '2026-04-01T12:00:00Z' },
        selectData: [{ id: GW_NEXT, number: 11 }],
      },
      prediction_scores: {
        selectData: [
          { member_id: MEMBER_A, points_awarded: 30 },
          { member_id: MEMBER_B, points_awarded: 10 },
        ],
      },
      bonus_awards: { selectData: [] },
      h2h_steals: { insertFn: stealInsertFn },
      admin_notifications: {},
    })

    const result = await detectH2HForGameweek(adminMock, GW_CURRENT)

    expect(result.stealsCreated).toBe(0)
    expect(stealInsertFn).not.toHaveBeenCalled()
  })

  it('creates one h2h_steals row for a tie at position 1', async () => {
    const stealInsertFn = vi.fn().mockResolvedValue({ error: null })
    const notifInsertFn = vi.fn().mockResolvedValue({ error: null })

    // Need gameweeks table to handle TWO calls: the initial .single() for
    // closed_at, and the next-GW lookup.
    let gwCallCount = 0
    adminMock.from = vi.fn().mockImplementation((table: string) => {
      const chain = makeChain()
      if (table === 'gameweeks') {
        gwCallCount++
        if (gwCallCount === 1) {
          chain.single = vi.fn().mockResolvedValue({
            data: { id: GW_CURRENT, number: 10, closed_at: '2026-04-01T12:00:00Z' },
            error: null,
          })
        } else {
          // next-gw lookup
          chain.single = vi.fn().mockResolvedValue({
            data: { id: GW_NEXT, number: 11 },
            error: null,
          })
          chain.maybeSingle = vi.fn().mockResolvedValue({
            data: { id: GW_NEXT, number: 11 },
            error: null,
          })
        }
      } else if (table === 'prediction_scores') {
        chain.then = (resolve) =>
          resolve({
            data: [
              { member_id: MEMBER_A, points_awarded: 30 },
              { member_id: MEMBER_B, points_awarded: 30 },
              { member_id: MEMBER_C, points_awarded: 10 },
            ],
            error: null,
          })
      } else if (table === 'bonus_awards') {
        chain.then = (resolve) => resolve({ data: [], error: null })
      } else if (table === 'h2h_steals') {
        chain.insert = stealInsertFn
      } else if (table === 'admin_notifications') {
        chain.insert = notifInsertFn
      }
      return chain
    })

    const result = await detectH2HForGameweek(adminMock, GW_CURRENT)

    expect(result.stealsCreated).toBe(1)
    expect(stealInsertFn).toHaveBeenCalledTimes(1)
    const insertArg = stealInsertFn.mock.calls[0][0]
    expect(insertArg).toMatchObject({
      position: 1,
      detected_in_gw_id: GW_CURRENT,
      resolves_in_gw_id: GW_NEXT,
    })
    // member_ids alphabetically sorted (pure function contract)
    expect(insertArg.tied_member_ids.sort()).toEqual([MEMBER_A, MEMBER_B].sort())
    expect(notifInsertFn).toHaveBeenCalled()
  })

  it('respects Pitfall 3 — excludes unconfirmed bonus awards', async () => {
    // Setup: A and B tied on predictions. B has an unconfirmed bonus that
    // would break the tie if counted. With proper filter it's excluded → tie persists.
    const stealInsertFn = vi.fn().mockResolvedValue({ error: null })
    let gwCallCount = 0
    adminMock.from = vi.fn().mockImplementation((table: string) => {
      const chain = makeChain()
      if (table === 'gameweeks') {
        gwCallCount++
        if (gwCallCount === 1) {
          chain.single = vi.fn().mockResolvedValue({
            data: { id: GW_CURRENT, number: 10, closed_at: '2026-04-01T12:00:00Z' },
            error: null,
          })
        } else {
          chain.single = vi.fn().mockResolvedValue({
            data: { id: GW_NEXT, number: 11 },
            error: null,
          })
          chain.maybeSingle = vi.fn().mockResolvedValue({
            data: { id: GW_NEXT, number: 11 },
            error: null,
          })
        }
      } else if (table === 'prediction_scores') {
        chain.then = (resolve) =>
          resolve({
            data: [
              { member_id: MEMBER_A, points_awarded: 30 },
              { member_id: MEMBER_B, points_awarded: 30 },
            ],
            error: null,
          })
      } else if (table === 'bonus_awards') {
        // Query MUST filter awarded=true — if it does, this empty list is returned.
        // Simulate that filter being respected.
        chain.then = (resolve) => resolve({ data: [], error: null })
      } else if (table === 'h2h_steals') {
        chain.insert = stealInsertFn
      } else if (table === 'admin_notifications') {
        chain.insert = vi.fn().mockResolvedValue({ error: null })
      }
      return chain
    })

    const result = await detectH2HForGameweek(adminMock, GW_CURRENT)

    expect(result.stealsCreated).toBe(1)
  })
})

// ─── resolveStealsForGameweek tests ──────────────────────────────────────────

describe('resolveStealsForGameweek', () => {
  beforeEach(() => vi.clearAllMocks())

  it('resolves a pending steal — highest next-week total wins', async () => {
    const updateFn = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })
    const notifInsertFn = vi.fn().mockResolvedValue({ error: null })

    adminMock.from = vi.fn().mockImplementation((table: string) => {
      const chain = makeChain()
      if (table === 'h2h_steals') {
        // Pending steal with A+B tied
        chain.then = (resolve) =>
          resolve({
            data: [
              {
                id: STEAL_ID,
                detected_in_gw_id: GW_CURRENT,
                resolves_in_gw_id: GW_NEXT,
                position: 1,
                tied_member_ids: [MEMBER_A, MEMBER_B],
              },
            ],
            error: null,
          })
        chain.update = updateFn
      } else if (table === 'prediction_scores') {
        chain.then = (resolve) =>
          resolve({
            data: [
              { member_id: MEMBER_A, points_awarded: 30 },
              { member_id: MEMBER_B, points_awarded: 10 },
            ],
            error: null,
          })
      } else if (table === 'bonus_awards') {
        chain.then = (resolve) => resolve({ data: [], error: null })
      } else if (table === 'admin_notifications') {
        chain.insert = notifInsertFn
      }
      return chain
    })

    const result = await resolveStealsForGameweek(adminMock, GW_NEXT)

    expect(result.resolvedCount).toBe(1)
    expect(updateFn).toHaveBeenCalledTimes(1)
    const updateArg = updateFn.mock.calls[0][0]
    expect(updateArg.winner_ids).toEqual([MEMBER_A])
    expect(updateArg.resolved_at).toBeTruthy()
    expect(notifInsertFn).toHaveBeenCalled()
  })

  it('returns { resolvedCount: 0 } when no pending steals', async () => {
    wire({
      h2h_steals: { selectData: [] },
    })

    const result = await resolveStealsForGameweek(adminMock, GW_NEXT)

    expect(result.resolvedCount).toBe(0)
  })
})
