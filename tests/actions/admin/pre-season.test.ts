/**
 * Tests for admin pre-season server actions (Phase 9 Plan 02).
 *
 * Covers setPreSeasonPicksForMember:
 * - requireAdmin guard (non-admin rejection)
 * - Lockout BYPASS (admin can submit after gw1_kickoff has passed)
 * - Source-list + duplicate validation still applied
 * - submitted_by_admin=true + imported_by=admin.userId recorded
 * - Idempotent upsert with onConflict member_id,season
 *
 * Plan 03 extends this file with confirmPreSeasonAward + calculate tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabaseClient } from '../../setup'

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

const mockAdminClient = createMockSupabaseClient()
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mockAdminClient),
}))

const mockServerClient = createMockSupabaseClient()
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(() => mockServerClient),
}))

import { createAdminClient } from '@/lib/supabase/admin'
import {
  setPreSeasonPicksForMember,
  setSeasonActuals,
  calculatePreSeasonAwards,
  confirmPreSeasonAward,
  bulkConfirmPreSeasonAwards,
} from '@/actions/admin/pre-season'

// ─── Constants ────────────────────────────────────────────────────────────────

const ADMIN_USER_ID = '33333333-3333-4333-8333-333333333333'
const MEMBER_ID = '44444444-4444-4444-8444-444444444444'

const PL_TEAMS = [
  'Arsenal',
  'Aston Villa',
  'Bournemouth',
  'Brentford',
  'Brighton & Hove Albion',
  'Burnley',
  'Chelsea',
  'Crystal Palace',
  'Everton',
  'Fulham',
  'Liverpool',
  'Manchester City',
  'Manchester United',
  'Newcastle United',
  "Nott'ham Forest",
  'Sunderland',
  'Tottenham Hotspur',
  'West Ham United',
  'Wolverhampton Wanderers',
  'Leeds United',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockAdminAuth() {
  mockServerClient.auth.getUser = vi.fn().mockResolvedValue({
    data: { user: { id: ADMIN_USER_ID, app_metadata: { role: 'admin' } } },
    error: null,
  })
}

function mockNonAdminAuth() {
  mockServerClient.auth.getUser = vi.fn().mockResolvedValue({
    data: { user: { id: 'member-id', app_metadata: { role: 'member' } } },
    error: null,
  })
}

function mockAdminClientImpl({
  plTeams = PL_TEAMS,
  upsertError = null as null | { message: string },
  captureUpsert,
  captureConflictOpt,
}: {
  plTeams?: string[]
  upsertError?: null | { message: string }
  captureUpsert?: (payload: unknown) => void
  captureConflictOpt?: (opts: unknown) => void
}) {
  const mockClient = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'teams') {
        return {
          select: vi
            .fn()
            .mockResolvedValue({
              data: plTeams.map((name) => ({ name })),
              error: null,
            }),
        }
      }
      if (table === 'pre_season_picks') {
        return {
          upsert: vi.fn().mockImplementation((payload: unknown, opts: unknown) => {
            captureUpsert?.(payload)
            captureConflictOpt?.(opts)
            return Promise.resolve({ error: upsertError })
          }),
        }
      }
      return { select: vi.fn().mockReturnThis() }
    }),
  }
  vi.mocked(createAdminClient).mockReturnValue(
    mockClient as unknown as ReturnType<typeof createAdminClient>,
  )
}

function buildValidPayload(overrides: Record<string, unknown> = {}) {
  return {
    member_id: MEMBER_ID,
    season: 2026,
    top4: ['Arsenal', 'Liverpool', 'Manchester City', 'Chelsea'],
    tenth_place: 'Fulham',
    relegated: ['Burnley', 'Sunderland', 'Bournemouth'],
    promoted: ['Leicester City', 'Ipswich Town', 'Southampton'],
    promoted_playoff_winner: 'Norwich City',
    ...overrides,
  }
}

function buildFormData(payload: unknown) {
  const fd = new FormData()
  fd.set('payload', JSON.stringify(payload))
  return fd
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('setPreSeasonPicksForMember', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns { error: Unauthorized } when caller is not admin', async () => {
    mockNonAdminAuth()
    const result = await setPreSeasonPicksForMember(buildFormData(buildValidPayload()))
    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toMatch(/Unauthorized/i)
  })

  it('bypasses gw1_kickoff lockout — admin can submit even when window is closed', async () => {
    // There is NO lockout check in the admin action — validated by no seasons call
    mockAdminAuth()
    let captured: unknown = null
    mockAdminClientImpl({ captureUpsert: (p) => (captured = p) })

    const result = await setPreSeasonPicksForMember(buildFormData(buildValidPayload()))
    expect(result).toEqual({ success: true })
    expect(captured).toMatchObject({
      member_id: MEMBER_ID,
      season: 2026,
      submitted_by_admin: true,
      imported_by: ADMIN_USER_ID,
    })
  })

  it('applies source-list validation — rejects PL team in promoted slot', async () => {
    mockAdminAuth()
    mockAdminClientImpl({})
    const payload = buildValidPayload({
      promoted: ['Arsenal', 'Ipswich Town', 'Southampton'],
    })
    const result = await setPreSeasonPicksForMember(buildFormData(payload))
    expect(result).toMatchObject({ error: expect.stringMatching(/Championship/i) })
  })

  it('applies source-list validation — rejects Championship team in top4', async () => {
    mockAdminAuth()
    mockAdminClientImpl({ plTeams: PL_TEAMS.filter((t) => t !== 'Leeds United') })
    const payload = buildValidPayload({
      top4: ['Leeds United', 'Liverpool', 'Manchester City', 'Chelsea'],
    })
    const result = await setPreSeasonPicksForMember(buildFormData(payload))
    expect(result).toMatchObject({ error: expect.stringMatching(/Premier League/i) })
  })

  it('rejects duplicates in a category', async () => {
    mockAdminAuth()
    mockAdminClientImpl({})
    const payload = buildValidPayload({
      top4: ['Arsenal', 'Arsenal', 'Manchester City', 'Chelsea'],
    })
    const result = await setPreSeasonPicksForMember(buildFormData(payload))
    expect(result).toMatchObject({ error: expect.stringMatching(/[Dd]uplicate/i) })
  })

  it('records submitted_by_admin=true, submitted_at + imported_at, imported_by=admin.userId', async () => {
    mockAdminAuth()
    let captured: Record<string, unknown> = {}
    mockAdminClientImpl({ captureUpsert: (p) => (captured = p as Record<string, unknown>) })

    const result = await setPreSeasonPicksForMember(buildFormData(buildValidPayload()))
    expect(result).toEqual({ success: true })
    expect(captured.submitted_by_admin).toBe(true)
    expect(captured.imported_by).toBe(ADMIN_USER_ID)
    expect(captured.submitted_at).toBeTruthy()
    expect(captured.imported_at).toBeTruthy()
  })

  it('resubmit: upsert with onConflict member_id,season', async () => {
    mockAdminAuth()
    let conflictOpts: unknown = null
    mockAdminClientImpl({ captureConflictOpt: (o) => (conflictOpts = o) })

    const result = await setPreSeasonPicksForMember(buildFormData(buildValidPayload()))
    expect(result).toEqual({ success: true })
    expect(conflictOpts).toMatchObject({ onConflict: 'member_id,season' })
  })

  it('returns { error } when upsert fails', async () => {
    mockAdminAuth()
    mockAdminClientImpl({ upsertError: { message: 'db error' } })

    const result = await setPreSeasonPicksForMember(buildFormData(buildValidPayload()))
    expect(result).toMatchObject({ error: 'db error' })
  })

  it('rejects invalid member_id UUID in payload', async () => {
    mockAdminAuth()
    mockAdminClientImpl({})
    const payload = buildValidPayload({ member_id: 'not-a-uuid' })
    const result = await setPreSeasonPicksForMember(buildFormData(payload))
    expect(result).toHaveProperty('error')
  })
})

// ═══ setSeasonActuals ═════════════════════════════════════════════════════════

function buildValidActualsPayload(overrides: Record<string, unknown> = {}) {
  return {
    season: 2025,
    final_top4: ['Arsenal', 'Liverpool', 'Manchester City', 'Chelsea'],
    final_tenth: 'Fulham',
    final_relegated: ['Burnley', 'Sunderland', 'Bournemouth'],
    final_promoted: ['Leicester City', 'Ipswich Town', 'Southampton'],
    final_playoff_winner: 'Norwich City',
    ...overrides,
  }
}

function mockActualsAdminClient({
  updateError = null as null | { message: string },
  captureUpdate,
}: {
  updateError?: null | { message: string }
  captureUpdate?: (payload: unknown) => void
} = {}) {
  const mockClient = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'seasons') {
        return {
          update: vi.fn().mockImplementation((payload: unknown) => {
            captureUpdate?.(payload)
            return {
              eq: vi.fn().mockResolvedValue({ error: updateError }),
            }
          }),
        }
      }
      return { select: vi.fn().mockReturnThis() }
    }),
  }
  vi.mocked(createAdminClient).mockReturnValue(
    mockClient as unknown as ReturnType<typeof createAdminClient>,
  )
}

describe('setSeasonActuals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects non-admin caller', async () => {
    mockNonAdminAuth()
    const result = await setSeasonActuals(buildFormData(buildValidActualsPayload()))
    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toMatch(/Unauthorized/i)
  })

  it('rejects invalid payload (wrong array length for final_top4)', async () => {
    mockAdminAuth()
    mockActualsAdminClient()
    const payload = buildValidActualsPayload({
      final_top4: ['Arsenal', 'Liverpool', 'Manchester City'], // only 3
    })
    const result = await setSeasonActuals(buildFormData(payload))
    expect(result).toHaveProperty('error')
  })

  it('updates seasons row with actuals + sets actuals_locked_at', async () => {
    mockAdminAuth()
    let captured: Record<string, unknown> = {}
    mockActualsAdminClient({
      captureUpdate: (p) => (captured = p as Record<string, unknown>),
    })
    const result = await setSeasonActuals(buildFormData(buildValidActualsPayload()))
    expect(result).toEqual({ success: true })
    expect(captured.final_top4).toEqual(['Arsenal', 'Liverpool', 'Manchester City', 'Chelsea'])
    expect(captured.final_tenth).toBe('Fulham')
    expect(captured.final_relegated).toEqual(['Burnley', 'Sunderland', 'Bournemouth'])
    expect(captured.final_promoted).toEqual(['Leicester City', 'Ipswich Town', 'Southampton'])
    expect(captured.final_playoff_winner).toBe('Norwich City')
    expect(captured.actuals_locked_at).toBeTruthy()
  })

  it('can be called multiple times (upsert semantics via UPDATE)', async () => {
    mockAdminAuth()
    mockActualsAdminClient()
    const r1 = await setSeasonActuals(buildFormData(buildValidActualsPayload()))
    expect(r1).toEqual({ success: true })

    mockAdminAuth()
    mockActualsAdminClient()
    const r2 = await setSeasonActuals(
      buildFormData(
        buildValidActualsPayload({ final_tenth: 'Brighton & Hove Albion' }),
      ),
    )
    expect(r2).toEqual({ success: true })
  })

  it('returns { error } when update fails', async () => {
    mockAdminAuth()
    mockActualsAdminClient({ updateError: { message: 'db error' } })
    const result = await setSeasonActuals(buildFormData(buildValidActualsPayload()))
    expect(result).toMatchObject({ error: 'db error' })
  })
})

// ═══ calculatePreSeasonAwards ═════════════════════════════════════════════════

interface CalcClientOpts {
  seasonRow?: Record<string, unknown> | null
  picksRows?: Array<Record<string, unknown>>
  existingAwards?: Record<string, { confirmed: boolean } | null>
  upsertError?: null | { message: string }
  captureUpserts?: (payload: unknown) => void
  notificationError?: null | { message: string }
  captureNotifications?: (payload: unknown) => void
}

function mockCalcAdminClient(opts: CalcClientOpts = {}) {
  const {
    seasonRow = {
      season: 2025,
      final_top4: ['Arsenal', 'Liverpool', 'Manchester City', 'Chelsea'],
      final_tenth: 'Fulham',
      final_relegated: ['Burnley', 'Sunderland', 'Bournemouth'],
      final_promoted: ['Leicester City', 'Ipswich Town', 'Southampton'],
      final_playoff_winner: 'Norwich City',
      actuals_locked_at: '2026-05-25T00:00:00Z',
    },
    picksRows = [],
    existingAwards = {},
    upsertError = null,
    captureUpserts,
    notificationError = null,
    captureNotifications,
  } = opts

  const mockClient = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'seasons') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: seasonRow, error: null }),
            }),
          }),
        }
      }
      if (table === 'pre_season_picks') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: picksRows, error: null }),
          }),
        }
      }
      if (table === 'pre_season_awards') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockImplementation(() => {
                  // Support lookup per member
                  return Promise.resolve({ data: null, error: null })
                }),
              }),
            }),
          }),
          upsert: vi.fn().mockImplementation((payload: unknown) => {
            captureUpserts?.(payload)
            return Promise.resolve({ error: upsertError })
          }),
        }
      }
      if (table === 'admin_notifications') {
        return {
          insert: vi.fn().mockImplementation((payload: unknown) => {
            captureNotifications?.(payload)
            return Promise.resolve({ error: notificationError })
          }),
        }
      }
      return { select: vi.fn().mockReturnThis() }
    }),
  }
  // Override pre_season_awards.select().eq().eq().maybeSingle() per-member
  const originalFrom = mockClient.from
  mockClient.from = vi.fn().mockImplementation((table: string) => {
    if (table === 'pre_season_awards') {
      let memberKey: string | null = null
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockImplementation((_col: string, val: string) => {
            memberKey = val
            return {
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockImplementation(() => {
                  return Promise.resolve({
                    data: existingAwards[memberKey ?? ''] ?? null,
                    error: null,
                  })
                }),
              }),
            }
          }),
        }),
        upsert: vi.fn().mockImplementation((payload: unknown) => {
          captureUpserts?.(payload)
          return Promise.resolve({ error: upsertError })
        }),
      }
    }
    return originalFrom(table)
  })

  vi.mocked(createAdminClient).mockReturnValue(
    mockClient as unknown as ReturnType<typeof createAdminClient>,
  )
}

function buildCalcFormData(season: number) {
  const fd = new FormData()
  fd.set('season', String(season))
  return fd
}

describe('calculatePreSeasonAwards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects non-admin caller', async () => {
    mockNonAdminAuth()
    const result = await calculatePreSeasonAwards(buildCalcFormData(2025))
    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toMatch(/Unauthorized/i)
  })

  it('rejects if seasons.actuals_locked_at is null', async () => {
    mockAdminAuth()
    mockCalcAdminClient({
      seasonRow: {
        season: 2025,
        final_top4: [],
        final_tenth: null,
        final_relegated: [],
        final_promoted: [],
        final_playoff_winner: null,
        actuals_locked_at: null,
      },
    })
    const result = await calculatePreSeasonAwards(buildCalcFormData(2025))
    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toMatch(/actuals/i)
  })

  it('returns success with 0 awards when no picks exist', async () => {
    mockAdminAuth()
    mockCalcAdminClient({ picksRows: [] })
    const result = await calculatePreSeasonAwards(buildCalcFormData(2025))
    expect(result).toMatchObject({ success: true, awardsCreated: 0 })
  })

  it('upserts pre_season_awards for each pick row', async () => {
    mockAdminAuth()
    const upserts: unknown[] = []
    mockCalcAdminClient({
      picksRows: [
        {
          member_id: MEMBER_ID,
          season: 2025,
          top4: ['Arsenal', 'Liverpool', 'Manchester City', 'Chelsea'],
          tenth_place: 'Fulham',
          relegated: ['Burnley', 'Sunderland', 'Bournemouth'],
          promoted: ['Leicester City', 'Ipswich Town', 'Southampton'],
          promoted_playoff_winner: 'Norwich City',
        },
      ],
      captureUpserts: (p) => upserts.push(p),
    })
    const result = await calculatePreSeasonAwards(buildCalcFormData(2025))
    expect(result).toMatchObject({ success: true, awardsCreated: 1 })
    expect(upserts.length).toBeGreaterThanOrEqual(1)
    // Perfect score = 12 × 30 = 360
    expect(upserts[0]).toMatchObject({
      member_id: MEMBER_ID,
      season: 2025,
      calculated_points: 360,
    })
  })

  it('emits pre_season_awards_ready notification after calc', async () => {
    mockAdminAuth()
    const notifications: unknown[] = []
    mockCalcAdminClient({
      picksRows: [],
      captureNotifications: (p) => notifications.push(p),
    })
    await calculatePreSeasonAwards(buildCalcFormData(2025))
    const hasReady = notifications.some(
      (n) =>
        typeof n === 'object' &&
        n !== null &&
        (n as Record<string, unknown>).type === 'pre_season_awards_ready',
    )
    expect(hasReady).toBe(true)
  })

  it('emits pre_season_all_correct notification for a perfect scorer', async () => {
    mockAdminAuth()
    const notifications: unknown[] = []
    mockCalcAdminClient({
      picksRows: [
        {
          member_id: MEMBER_ID,
          season: 2025,
          top4: ['Arsenal', 'Liverpool', 'Manchester City', 'Chelsea'],
          tenth_place: 'Fulham',
          relegated: ['Burnley', 'Sunderland', 'Bournemouth'],
          promoted: ['Leicester City', 'Ipswich Town', 'Southampton'],
          promoted_playoff_winner: 'Norwich City',
        },
      ],
      captureNotifications: (p) => notifications.push(p),
    })
    const result = await calculatePreSeasonAwards(buildCalcFormData(2025))
    expect(result).toMatchObject({ success: true, flagsEmitted: { all_correct: 1 } })
    const hasAllCorrect = notifications.some(
      (n) =>
        typeof n === 'object' &&
        n !== null &&
        (n as Record<string, unknown>).type === 'pre_season_all_correct',
    )
    expect(hasAllCorrect).toBe(true)
  })

  it('preserves confirmed flag on re-run for already-confirmed rows (idempotent)', async () => {
    mockAdminAuth()
    const upserts: Array<Record<string, unknown>> = []
    mockCalcAdminClient({
      picksRows: [
        {
          member_id: MEMBER_ID,
          season: 2025,
          top4: ['Arsenal', 'Liverpool', 'Manchester City', 'Chelsea'],
          tenth_place: 'Fulham',
          relegated: ['Burnley', 'Sunderland', 'Bournemouth'],
          promoted: ['Leicester City', 'Ipswich Town', 'Southampton'],
          promoted_playoff_winner: 'Norwich City',
        },
      ],
      existingAwards: { [MEMBER_ID]: { confirmed: true } },
      captureUpserts: (p) => upserts.push(p as Record<string, unknown>),
    })
    await calculatePreSeasonAwards(buildCalcFormData(2025))
    expect(upserts.length).toBe(1)
    const upsert = upserts[0]
    // Already-confirmed row: confirmed field should NOT be reset
    expect(upsert.confirmed).toBeUndefined()
    // awarded_points should also NOT be overwritten
    expect(upsert.awarded_points).toBeUndefined()
    // But calculated_points IS updated
    expect(upsert.calculated_points).toBe(360)
  })

  it('notification insert failures do NOT fail the calc (Pattern 5 try/catch)', async () => {
    mockAdminAuth()
    mockCalcAdminClient({
      picksRows: [
        {
          member_id: MEMBER_ID,
          season: 2025,
          top4: ['Arsenal', 'Liverpool', 'Manchester City', 'Chelsea'],
          tenth_place: 'Fulham',
          relegated: ['Burnley', 'Sunderland', 'Bournemouth'],
          promoted: ['Leicester City', 'Ipswich Town', 'Southampton'],
          promoted_playoff_winner: 'Norwich City',
        },
      ],
      notificationError: { message: 'notification failure' },
    })
    const result = await calculatePreSeasonAwards(buildCalcFormData(2025))
    expect(result).toMatchObject({ success: true })
  })

  it('rejects invalid season param', async () => {
    mockAdminAuth()
    mockCalcAdminClient({})
    const fd = new FormData()
    fd.set('season', 'not-a-number')
    const result = await calculatePreSeasonAwards(fd)
    expect(result).toHaveProperty('error')
  })
})

// ═══ confirmPreSeasonAward ════════════════════════════════════════════════════

function mockConfirmAdminClient({
  existingAward = { calculated_points: 300 } as Record<string, unknown> | null,
  upsertError = null as null | { message: string },
  captureUpsert,
}: {
  existingAward?: Record<string, unknown> | null
  upsertError?: null | { message: string }
  captureUpsert?: (payload: unknown) => void
} = {}) {
  const mockClient = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'pre_season_awards') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: existingAward,
                  error: null,
                }),
              }),
            }),
          }),
          upsert: vi.fn().mockImplementation((payload: unknown) => {
            captureUpsert?.(payload)
            return Promise.resolve({ error: upsertError })
          }),
        }
      }
      return { select: vi.fn().mockReturnThis() }
    }),
  }
  vi.mocked(createAdminClient).mockReturnValue(
    mockClient as unknown as ReturnType<typeof createAdminClient>,
  )
}

function buildConfirmFormData(overrides: Record<string, unknown> = {}) {
  const fd = new FormData()
  fd.set('member_id', (overrides.member_id as string) ?? MEMBER_ID)
  fd.set('season', String(overrides.season ?? 2025))
  if (overrides.override_points !== undefined) {
    fd.set('override_points', String(overrides.override_points))
  }
  return fd
}

describe('confirmPreSeasonAward', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects non-admin caller', async () => {
    mockNonAdminAuth()
    const result = await confirmPreSeasonAward(buildConfirmFormData())
    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toMatch(/Unauthorized/i)
  })

  it('confirms with calculated_points when no override provided', async () => {
    mockAdminAuth()
    let captured: Record<string, unknown> = {}
    mockConfirmAdminClient({
      existingAward: { calculated_points: 300 },
      captureUpsert: (p) => (captured = p as Record<string, unknown>),
    })
    const result = await confirmPreSeasonAward(buildConfirmFormData())
    expect(result).toEqual({ success: true })
    expect(captured.awarded_points).toBe(300)
    expect(captured.confirmed).toBe(true)
    expect(captured.confirmed_by).toBe(ADMIN_USER_ID)
    expect(captured.confirmed_at).toBeTruthy()
  })

  it('uses override_points when provided', async () => {
    mockAdminAuth()
    let captured: Record<string, unknown> = {}
    mockConfirmAdminClient({
      existingAward: { calculated_points: 300 },
      captureUpsert: (p) => (captured = p as Record<string, unknown>),
    })
    const result = await confirmPreSeasonAward(
      buildConfirmFormData({ override_points: 250 }),
    )
    expect(result).toEqual({ success: true })
    expect(captured.awarded_points).toBe(250)
  })

  it('rejects when no pre_season_awards row exists', async () => {
    mockAdminAuth()
    mockConfirmAdminClient({ existingAward: null })
    const result = await confirmPreSeasonAward(buildConfirmFormData())
    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toMatch(/calculated/i)
  })

  it('rejects invalid member_id UUID', async () => {
    mockAdminAuth()
    mockConfirmAdminClient()
    const fd = new FormData()
    fd.set('member_id', 'not-a-uuid')
    fd.set('season', '2025')
    const result = await confirmPreSeasonAward(fd)
    expect(result).toHaveProperty('error')
  })

  it('is idempotent — calling twice yields the same final row', async () => {
    mockAdminAuth()
    const upserts: Array<Record<string, unknown>> = []
    mockConfirmAdminClient({
      existingAward: { calculated_points: 300 },
      captureUpsert: (p) => upserts.push(p as Record<string, unknown>),
    })
    await confirmPreSeasonAward(buildConfirmFormData())

    mockAdminAuth()
    mockConfirmAdminClient({
      existingAward: { calculated_points: 300 },
      captureUpsert: (p) => upserts.push(p as Record<string, unknown>),
    })
    await confirmPreSeasonAward(buildConfirmFormData())

    expect(upserts.length).toBe(2)
    expect(upserts[0].awarded_points).toBe(upserts[1].awarded_points)
    expect(upserts[0].confirmed).toBe(true)
    expect(upserts[1].confirmed).toBe(true)
  })
})

// ═══ bulkConfirmPreSeasonAwards ═══════════════════════════════════════════════

function mockBulkAdminClient({
  pending = [] as Array<{ member_id: string; calculated_points: number }>,
  updateError = null as null | { message: string },
  captureUpdates,
}: {
  pending?: Array<{ member_id: string; calculated_points: number }>
  updateError?: null | { message: string }
  captureUpdates?: (payload: unknown) => void
} = {}) {
  const mockClient = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'pre_season_awards') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: pending, error: null }),
            }),
          }),
          update: vi.fn().mockImplementation((payload: unknown) => {
            captureUpdates?.(payload)
            return {
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: updateError }),
              }),
            }
          }),
        }
      }
      return { select: vi.fn().mockReturnThis() }
    }),
  }
  vi.mocked(createAdminClient).mockReturnValue(
    mockClient as unknown as ReturnType<typeof createAdminClient>,
  )
}

function buildBulkFormData(season = 2025) {
  const fd = new FormData()
  fd.set('season', String(season))
  return fd
}

describe('bulkConfirmPreSeasonAwards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects non-admin caller', async () => {
    mockNonAdminAuth()
    const result = await bulkConfirmPreSeasonAwards(buildBulkFormData())
    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toMatch(/Unauthorized/i)
  })

  it('confirms all unconfirmed rows with calculated_points as awarded_points', async () => {
    mockAdminAuth()
    const updates: Array<Record<string, unknown>> = []
    mockBulkAdminClient({
      pending: [
        { member_id: MEMBER_ID, calculated_points: 300 },
        { member_id: '55555555-5555-4555-8555-555555555555', calculated_points: 150 },
      ],
      captureUpdates: (p) => updates.push(p as Record<string, unknown>),
    })
    const result = await bulkConfirmPreSeasonAwards(buildBulkFormData())
    expect(result).toMatchObject({ success: true, confirmedCount: 2 })
    expect(updates.length).toBe(2)
    expect(updates[0].awarded_points).toBe(300)
    expect(updates[0].confirmed).toBe(true)
    expect(updates[0].confirmed_by).toBe(ADMIN_USER_ID)
    expect(updates[1].awarded_points).toBe(150)
  })

  it('returns confirmedCount=0 when no pending rows', async () => {
    mockAdminAuth()
    mockBulkAdminClient({ pending: [] })
    const result = await bulkConfirmPreSeasonAwards(buildBulkFormData())
    expect(result).toMatchObject({ success: true, confirmedCount: 0 })
  })

  it('rejects invalid season param', async () => {
    mockAdminAuth()
    mockBulkAdminClient({})
    const fd = new FormData()
    fd.set('season', 'not-a-number')
    const result = await bulkConfirmPreSeasonAwards(fd)
    expect(result).toHaveProperty('error')
  })
})
