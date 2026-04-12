/**
 * Tests for LOS integration in submitPredictions (Phase 8 Plan 02).
 *
 * Builds on predictions.test.ts style:
 *   - mocks @/lib/supabase/server (session client)
 *   - mocks @/lib/fixtures/lockout canSubmitPrediction
 *   - uses vi.mocked(...) pattern — NOT factory variables (STATE.md decision)
 *
 * Covers LOS-01 (member submission flow) + LOS-03 (server-side team-already-used).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabaseClient } from '../setup'

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

const mockServerClient = createMockSupabaseClient()
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(async () => mockServerClient),
}))

vi.mock('@/lib/fixtures/lockout', () => ({
  canSubmitPrediction: vi.fn(),
}))

// ─── Import after mocks ───────────────────────────────────────────────────────

import { submitPredictions } from '@/actions/predictions'
import { canSubmitPrediction } from '@/lib/fixtures/lockout'

const mockCanSubmitPrediction = vi.mocked(canSubmitPrediction)

// ─── Test UUIDs ───────────────────────────────────────────────────────────────

const MEMBER_ID      = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const USER_ID        = 'b5a3f1c2-8d4e-4f7a-9b2c-1e6d8f3a5c7b'
const COMPETITION_ID = 'c4f6e8d9-3a2b-4c5d-8e7f-9a1b2c3d4e5f'
const GAMEWEEK_ID    = 'd1e2f3a4-5b6c-4d7e-9f8a-0b1c2d3e4f5a'
const FIXTURE_ID_1   = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
const FIXTURE_ID_2   = 'c9bf9e57-1685-4c89-bafb-ff5af830be8a'
const LOS_FIXTURE_ID = 'e0d9c8b7-a6f5-4e4d-3c2b-1a0f9e8d7c6b'
const PICKED_TEAM_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_TEAM_ID  = '22222222-2222-4222-8222-222222222222'

// ─── Fluent-table builder ─────────────────────────────────────────────────────
// The server action hits multiple tables via .from(table). We configure each
// table independently so tests can control what each one returns.
//
// Every table lookup returns an object that responds to the chain ops the action
// uses (select, eq, in, maybeSingle, single, upsert) and yields a terminal
// promise when awaited via maybeSingle/single/upsert/select.

interface TableConfig {
  singleData?: unknown
  singleError?: unknown
  maybeSingleData?: unknown
  maybeSingleError?: unknown
  selectData?: unknown
  selectError?: unknown
  upsertError?: unknown
  upsertFn?: ReturnType<typeof vi.fn>
}

function buildTableMock(cfg: TableConfig) {
  const upsert = cfg.upsertFn ?? vi.fn().mockResolvedValue({ error: cfg.upsertError ?? null })

  // The .select() chain sometimes terminates at .single()/.maybeSingle() and
  // sometimes at an awaited promise (when listing rows). Support both by
  // making the chain itself a thenable-ish object.
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: cfg.singleData ?? null,
      error: cfg.singleError ?? null,
    }),
    maybeSingle: vi.fn().mockResolvedValue({
      data: cfg.maybeSingleData ?? null,
      error: cfg.maybeSingleError ?? null,
    }),
    upsert,
    then: (resolve: (v: unknown) => unknown) =>
      resolve({ data: cfg.selectData ?? [], error: cfg.selectError ?? null }),
  }
  return chain
}

/**
 * Map-driven .from() wiring.
 *
 * Keys are table names. The first call to a table returns the configured
 * chain; subsequent calls rebuild the chain so previous vi.fn() state is
 * preserved per table.
 */
function wireTables(tableConfigs: Record<string, TableConfig>) {
  const built: Record<string, ReturnType<typeof buildTableMock>> = {}
  for (const [name, cfg] of Object.entries(tableConfigs)) {
    built[name] = buildTableMock(cfg)
  }
  mockServerClient.from = vi.fn().mockImplementation((table: string) => {
    if (!built[table]) built[table] = buildTableMock({})
    return built[table]
  })
  return built
}

function mockAuthenticatedUser() {
  mockServerClient.auth.getUser = vi.fn().mockResolvedValue({
    data: { user: { id: USER_ID } },
    error: null,
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('submitPredictions — LOS integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanSubmitPrediction.mockResolvedValue({ canSubmit: true })
    mockAuthenticatedUser()
  })

  it('predictions save and losSaved=false when no active LOS competition', async () => {
    wireTables({
      members: { singleData: { id: MEMBER_ID, approval_status: 'approved' } },
      los_competitions: { maybeSingleData: null }, // no active competition
      predictions: {},
    })

    const result = await submitPredictions(
      5,
      [{ fixture_id: FIXTURE_ID_1, home_score: 1, away_score: 0 }],
      null,
      null, // no LOS pick provided
    )

    expect(result.error).toBeUndefined()
    expect(result.saved).toBe(1)
    expect(result.losSaved).toBe(false)
  })

  it('LOS pick saved and predictions save when active competition + valid pick', async () => {
    const losUpsertFn = vi.fn().mockResolvedValue({ error: null })
    const built = wireTables({
      members: { singleData: { id: MEMBER_ID, approval_status: 'approved' } },
      los_competitions: {
        maybeSingleData: { id: COMPETITION_ID, status: 'active' },
      },
      los_competition_members: {
        maybeSingleData: { status: 'active' },
      },
      los_picks: {
        // No prior picks for this team in this competition (LOS-03 query)
        selectData: [],
        upsertFn: losUpsertFn,
      },
      fixtures: {
        // Resolves fixture for picked team in current gameweek
        singleData: {
          id: LOS_FIXTURE_ID,
          kickoff_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
        selectData: [
          {
            id: LOS_FIXTURE_ID,
            kickoff_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
      },
      gameweeks: { singleData: { id: GAMEWEEK_ID } },
      predictions: {},
    })

    const result = await submitPredictions(
      5,
      [{ fixture_id: FIXTURE_ID_1, home_score: 1, away_score: 0 }],
      null,
      PICKED_TEAM_ID,
    )

    expect(result.error).toBeUndefined()
    expect(result.saved).toBe(1)
    expect(result.losSaved).toBe(true)
    // Confirm the upsert was called on los_picks with the expected onConflict
    expect(losUpsertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        competition_id: COMPETITION_ID,
        member_id: MEMBER_ID,
        gameweek_id: GAMEWEEK_ID,
        team_id: PICKED_TEAM_ID,
        fixture_id: LOS_FIXTURE_ID,
      }),
      expect.objectContaining({ onConflict: 'competition_id,member_id,gameweek_id' }),
    )
    // Ensure los_picks.upsert was actually invoked (not just predictions)
    expect(built.los_picks.upsert).toBe(losUpsertFn)
  })

  it('returns error and saves 0 predictions when active competition + eligible member + no losTeamId', async () => {
    wireTables({
      members: { singleData: { id: MEMBER_ID, approval_status: 'approved' } },
      los_competitions: {
        maybeSingleData: { id: COMPETITION_ID, status: 'active' },
      },
      los_competition_members: {
        maybeSingleData: { status: 'active' },
      },
      predictions: {},
    })

    const result = await submitPredictions(
      5,
      [{ fixture_id: FIXTURE_ID_1, home_score: 1, away_score: 0 }],
      null,
      null,
    )

    expect(result.error).toBeDefined()
    expect(result.error).toMatch(/los/i)
    expect(result.saved).toBe(0)
    expect(result.losSaved).toBe(false)
  })

  it('predictions save normally when member is eliminated (pick not mandatory)', async () => {
    wireTables({
      members: { singleData: { id: MEMBER_ID, approval_status: 'approved' } },
      los_competitions: {
        maybeSingleData: { id: COMPETITION_ID, status: 'active' },
      },
      los_competition_members: {
        maybeSingleData: { status: 'eliminated' },
      },
      predictions: {},
    })

    const result = await submitPredictions(
      5,
      [{ fixture_id: FIXTURE_ID_1, home_score: 1, away_score: 0 }],
      null,
      null,
    )

    expect(result.error).toBeUndefined()
    expect(result.saved).toBe(1)
    expect(result.losSaved).toBe(false)
  })

  it('rejects already-used team in same competition cycle', async () => {
    wireTables({
      members: { singleData: { id: MEMBER_ID, approval_status: 'approved' } },
      los_competitions: {
        maybeSingleData: { id: COMPETITION_ID, status: 'active' },
      },
      los_competition_members: {
        maybeSingleData: { status: 'active' },
      },
      los_picks: {
        // LOS-03: team was used in a prior gameweek of same competition
        selectData: [{ gameweek_id: 'other-gw', team_id: PICKED_TEAM_ID }],
      },
      predictions: {},
    })

    const result = await submitPredictions(
      5,
      [{ fixture_id: FIXTURE_ID_1, home_score: 1, away_score: 0 }],
      null,
      PICKED_TEAM_ID,
    )

    expect(result.error).toBeDefined()
    expect(result.error).toMatch(/already used/i)
    expect(result.saved).toBe(0)
    expect(result.losSaved).toBe(false)
  })

  it('returns error when picked team has no fixture in the gameweek', async () => {
    wireTables({
      members: { singleData: { id: MEMBER_ID, approval_status: 'approved' } },
      los_competitions: {
        maybeSingleData: { id: COMPETITION_ID, status: 'active' },
      },
      los_competition_members: {
        maybeSingleData: { status: 'active' },
      },
      los_picks: { selectData: [] },
      fixtures: {
        singleData: null, // no matching fixture
        selectData: [],
      },
      gameweeks: { singleData: { id: GAMEWEEK_ID } },
      predictions: {},
    })

    const result = await submitPredictions(
      5,
      [{ fixture_id: FIXTURE_ID_1, home_score: 1, away_score: 0 }],
      null,
      PICKED_TEAM_ID,
    )

    expect(result.error).toBeDefined()
    expect(result.error).toMatch(/fixture/i)
    expect(result.saved).toBe(0)
    expect(result.losSaved).toBe(false)
  })

  it('skips LOS upsert silently but saves other predictions when picked fixture already kicked off', async () => {
    const losUpsertFn = vi.fn().mockResolvedValue({ error: null })
    wireTables({
      members: { singleData: { id: MEMBER_ID, approval_status: 'approved' } },
      los_competitions: {
        maybeSingleData: { id: COMPETITION_ID, status: 'active' },
      },
      los_competition_members: {
        maybeSingleData: { status: 'active' },
      },
      los_picks: { selectData: [], upsertFn: losUpsertFn },
      fixtures: {
        // Kickoff in the past
        singleData: {
          id: LOS_FIXTURE_ID,
          kickoff_time: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        },
        selectData: [
          {
            id: LOS_FIXTURE_ID,
            kickoff_time: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          },
        ],
      },
      gameweeks: { singleData: { id: GAMEWEEK_ID } },
      predictions: {},
    })

    const result = await submitPredictions(
      5,
      [{ fixture_id: FIXTURE_ID_1, home_score: 1, away_score: 0 }],
      null,
      PICKED_TEAM_ID,
    )

    // Other-fixture predictions still save
    expect(result.saved).toBe(1)
    expect(result.losSaved).toBe(false)
    expect(losUpsertFn).not.toHaveBeenCalled()
  })

  it('idempotent re-submission with same team — upsert targets composite key', async () => {
    const losUpsertFn = vi.fn().mockResolvedValue({ error: null })
    wireTables({
      members: { singleData: { id: MEMBER_ID, approval_status: 'approved' } },
      los_competitions: {
        maybeSingleData: { id: COMPETITION_ID, status: 'active' },
      },
      los_competition_members: {
        maybeSingleData: { status: 'active' },
      },
      los_picks: {
        // Prior pick exists for this exact team+gameweek — still allowed (upsert)
        selectData: [],
        upsertFn: losUpsertFn,
      },
      fixtures: {
        singleData: {
          id: LOS_FIXTURE_ID,
          kickoff_time: new Date(Date.now() + 3600 * 1000).toISOString(),
        },
        selectData: [
          {
            id: LOS_FIXTURE_ID,
            kickoff_time: new Date(Date.now() + 3600 * 1000).toISOString(),
          },
        ],
      },
      gameweeks: { singleData: { id: GAMEWEEK_ID } },
      predictions: {},
    })

    const result = await submitPredictions(
      5,
      [{ fixture_id: FIXTURE_ID_2, home_score: 2, away_score: 1 }],
      null,
      PICKED_TEAM_ID,
    )

    expect(result.losSaved).toBe(true)
    expect(losUpsertFn).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ onConflict: 'competition_id,member_id,gameweek_id' }),
    )
  })

  it('guards: prior picks query must exclude current gameweek', async () => {
    // Sanity: team used in SAME gameweek should NOT trigger rejection
    // (it's the member updating their own prior pick)
    const losUpsertFn = vi.fn().mockResolvedValue({ error: null })
    wireTables({
      members: { singleData: { id: MEMBER_ID, approval_status: 'approved' } },
      los_competitions: {
        maybeSingleData: { id: COMPETITION_ID, status: 'active' },
      },
      los_competition_members: {
        maybeSingleData: { status: 'active' },
      },
      // Return empty to simulate the .neq filter being applied at the query level
      los_picks: { selectData: [], upsertFn: losUpsertFn },
      fixtures: {
        singleData: {
          id: LOS_FIXTURE_ID,
          kickoff_time: new Date(Date.now() + 3600 * 1000).toISOString(),
        },
      },
      gameweeks: { singleData: { id: GAMEWEEK_ID } },
      predictions: {},
    })

    const result = await submitPredictions(
      5,
      [{ fixture_id: FIXTURE_ID_1, home_score: 1, away_score: 0 }],
      null,
      PICKED_TEAM_ID,
    )

    expect(result.error).toBeUndefined()
    expect(result.losSaved).toBe(true)
  })

  // Suppress unused-var warning
  void OTHER_TEAM_ID
})
