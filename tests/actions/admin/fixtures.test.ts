/**
 * Tests for admin fixture management server actions.
 *
 * All Supabase calls are mocked via tests/setup.ts.
 * Tests verify the contract of each server action — not the internals of Supabase.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabaseClient } from '../../setup'

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
  redirect: vi.fn().mockImplementation((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  }),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// Mock createAdminClient — used for DB operations
const mockAdminClient = createMockSupabaseClient()
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mockAdminClient),
}))

// Mock createServerSupabaseClient — used for getUser() auth checks
const mockServerClient = createMockSupabaseClient()
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(() => mockServerClient),
}))

// Mock syncFixtures
const mockSyncFixtures = vi.fn()
vi.mock('@/lib/fixtures/sync', () => ({
  syncFixtures: mockSyncFixtures,
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mockAdminUser() {
  mockServerClient.auth.getUser = vi.fn().mockResolvedValue({
    data: {
      user: {
        id: 'admin-user-id',
        app_metadata: { role: 'admin' },
        email: 'george@example.com',
      },
    },
    error: null,
  })
}

function mockNonAdminUser() {
  mockServerClient.auth.getUser = vi.fn().mockResolvedValue({
    data: {
      user: {
        id: 'member-user-id',
        app_metadata: { role: 'member' },
        email: 'member@example.com',
      },
    },
    error: null,
  })
}

const FIXTURE_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
const HOME_TEAM_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const AWAY_TEAM_ID = '550e8400-e29b-41d4-a716-446655440000'
const GAMEWEEK_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7'

// ─── addFixture ───────────────────────────────────────────────────────────────

describe('addFixture admin action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminUser()
  })

  it('rejects when home_team_id equals away_team_id', async () => {
    // Must look up gameweek first so we get past Zod validation to the refine check
    // The refine runs after individual field validation, so we need valid UUIDs
    mockAdminClient.from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: GAMEWEEK_ID },
        error: null,
      }),
    })

    const formData = new FormData()
    formData.set('home_team_id', HOME_TEAM_ID)
    formData.set('away_team_id', HOME_TEAM_ID) // same as home — should fail refine
    formData.set('kickoff_time', '2025-08-16T14:00:00Z')
    formData.set('gameweek_number', '1')

    const { addFixture } = await import('@/actions/admin/fixtures')
    const result = await addFixture(formData)

    expect(result).toEqual({ error: expect.stringContaining('different') })
  })

  it('validates input — rejects invalid UUID for home_team_id', async () => {
    const formData = new FormData()
    formData.set('home_team_id', 'not-a-uuid')
    formData.set('away_team_id', AWAY_TEAM_ID)
    formData.set('kickoff_time', '2025-08-16T14:00:00Z')
    formData.set('gameweek_number', '1')

    const { addFixture } = await import('@/actions/admin/fixtures')
    const result = await addFixture(formData)

    expect(result).toEqual({ error: expect.any(String) })
  })

  it('inserts fixture and returns success with fixtureId', async () => {
    // Mock gameweek lookup
    const insertChain = {
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: FIXTURE_ID },
        error: null,
      }),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    }

    mockAdminClient.from = vi.fn().mockImplementation((table: string) => {
      if (table === 'gameweeks') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: GAMEWEEK_ID },
            error: null,
          }),
        }
      }
      if (table === 'fixtures') {
        return insertChain
      }
      return insertChain
    })

    const formData = new FormData()
    formData.set('home_team_id', HOME_TEAM_ID)
    formData.set('away_team_id', AWAY_TEAM_ID)
    formData.set('kickoff_time', '2025-08-16T14:00:00Z')
    formData.set('gameweek_number', '1')

    const { addFixture } = await import('@/actions/admin/fixtures')
    const result = await addFixture(formData)

    expect(result).toEqual({ success: true, fixtureId: FIXTURE_ID })
  })

  it('returns error if gameweek does not exist', async () => {
    mockAdminClient.from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'No rows' },
      }),
    })

    const formData = new FormData()
    formData.set('home_team_id', HOME_TEAM_ID)
    formData.set('away_team_id', AWAY_TEAM_ID)
    formData.set('kickoff_time', '2025-08-16T14:00:00Z')
    formData.set('gameweek_number', '1')

    const { addFixture } = await import('@/actions/admin/fixtures')
    const result = await addFixture(formData)

    expect(result).toEqual({ error: expect.stringContaining('Gameweek 1 not found') })
  })

  it('returns error if caller is not admin', async () => {
    mockNonAdminUser()

    const formData = new FormData()
    formData.set('home_team_id', HOME_TEAM_ID)
    formData.set('away_team_id', AWAY_TEAM_ID)
    formData.set('kickoff_time', '2025-08-16T14:00:00Z')
    formData.set('gameweek_number', '1')

    const { addFixture } = await import('@/actions/admin/fixtures')
    const result = await addFixture(formData)

    expect(result).toEqual({ error: expect.any(String) })
  })
})

// ─── editFixture ──────────────────────────────────────────────────────────────

describe('editFixture admin action', () => {
  // Fixture that has NOT kicked off (kickoff is in the future)
  const FUTURE_KICKOFF = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString() // +24h
  // Fixture that HAS kicked off (kickoff is in the past)
  const PAST_KICKOFF = new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() // -2h

  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminUser()
  })

  it('updates only provided fields', async () => {
    const updateMock = vi.fn().mockReturnThis()
    const eqMock = vi.fn().mockResolvedValue({ data: {}, error: null })

    mockAdminClient.from = vi.fn().mockImplementation((table: string) => {
      if (table === 'fixtures') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: FIXTURE_ID,
              kickoff_time: FUTURE_KICKOFF,
              home_team_id: HOME_TEAM_ID,
              away_team_id: AWAY_TEAM_ID,
              status: 'SCHEDULED',
            },
            error: null,
          }),
          update: updateMock,
        }
      }
      return { update: updateMock, eq: eqMock }
    })

    // Chain update().eq() to return success
    updateMock.mockReturnValue({ eq: eqMock })

    const formData = new FormData()
    formData.set('fixture_id', FIXTURE_ID)
    formData.set('status', 'TIMED')
    // No kickoff_time, no scores

    const { editFixture } = await import('@/actions/admin/fixtures')
    const result = await editFixture(formData)

    expect(result).toEqual({ success: true })
    // update should have been called with only status
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'TIMED' })
    )
    expect(updateMock).toHaveBeenCalledWith(
      expect.not.objectContaining({ kickoff_time: expect.anything() })
    )
  })

  it('rejects kickoff_time change after kickoff WITHOUT admin_override', async () => {
    mockAdminClient.from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: FIXTURE_ID,
          kickoff_time: PAST_KICKOFF,
          home_team_id: HOME_TEAM_ID,
          away_team_id: AWAY_TEAM_ID,
          status: 'FINISHED',
        },
        error: null,
      }),
      update: vi.fn().mockReturnThis(),
    })

    const formData = new FormData()
    formData.set('fixture_id', FIXTURE_ID)
    formData.set('kickoff_time', '2025-10-01T14:00:00Z')
    // No admin_override

    const { editFixture } = await import('@/actions/admin/fixtures')
    const result = await editFixture(formData)

    expect(result).toEqual({
      error: expect.stringContaining('kick-off'),
    })
  })

  it('allows score update after kickoff — no admin override needed', async () => {
    const updateMock = vi.fn().mockReturnThis()
    const eqMock = vi.fn().mockResolvedValue({ data: {}, error: null })
    updateMock.mockReturnValue({ eq: eqMock })

    mockAdminClient.from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: FIXTURE_ID,
          kickoff_time: PAST_KICKOFF,
          home_team_id: HOME_TEAM_ID,
          away_team_id: AWAY_TEAM_ID,
          status: 'FINISHED',
        },
        error: null,
      }),
      update: updateMock,
    })

    const formData = new FormData()
    formData.set('fixture_id', FIXTURE_ID)
    formData.set('home_score', '2')
    formData.set('away_score', '1')
    // No kickoff_time change, no admin_override needed

    const { editFixture } = await import('@/actions/admin/fixtures')
    const result = await editFixture(formData)

    expect(result).toEqual({ success: true })
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ home_score: 2, away_score: 1 })
    )
  })

  it('allows kickoff_time change after kickoff WITH admin_override=true', async () => {
    const updateMock = vi.fn().mockReturnThis()
    const eqMock = vi.fn().mockResolvedValue({ data: {}, error: null })
    updateMock.mockReturnValue({ eq: eqMock })

    mockAdminClient.from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: FIXTURE_ID,
          kickoff_time: PAST_KICKOFF,
          home_team_id: HOME_TEAM_ID,
          away_team_id: AWAY_TEAM_ID,
          status: 'IN_PLAY',
        },
        error: null,
      }),
      update: updateMock,
    })

    const formData = new FormData()
    formData.set('fixture_id', FIXTURE_ID)
    formData.set('kickoff_time', '2025-10-01T14:00:00Z')
    formData.set('admin_override', 'true') // explicit override

    const { editFixture } = await import('@/actions/admin/fixtures')
    const result = await editFixture(formData)

    expect(result).toEqual({ success: true })
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ kickoff_time: expect.any(String), is_rescheduled: true })
    )
  })

  it('sets is_rescheduled=true when kickoff_time changes', async () => {
    const updateMock = vi.fn().mockReturnThis()
    const eqMock = vi.fn().mockResolvedValue({ data: {}, error: null })
    updateMock.mockReturnValue({ eq: eqMock })

    mockAdminClient.from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: FIXTURE_ID,
          kickoff_time: FUTURE_KICKOFF,
          home_team_id: HOME_TEAM_ID,
          away_team_id: AWAY_TEAM_ID,
          status: 'SCHEDULED',
        },
        error: null,
      }),
      update: updateMock,
    })

    const newKickoff = new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString() // +48h

    const formData = new FormData()
    formData.set('fixture_id', FIXTURE_ID)
    formData.set('kickoff_time', newKickoff)

    const { editFixture } = await import('@/actions/admin/fixtures')
    const result = await editFixture(formData)

    expect(result).toEqual({ success: true })
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ is_rescheduled: true })
    )
  })
})

// ─── moveFixture ──────────────────────────────────────────────────────────────

describe('moveFixture admin action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminUser()
  })

  it('rejects if target gameweek does not exist', async () => {
    // Use a valid gameweek number (within 1-38) that returns no row from DB
    mockAdminClient.from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'No rows' },
      }),
    })

    const formData = new FormData()
    formData.set('fixture_id', FIXTURE_ID)
    formData.set('target_gameweek_number', '38') // valid range but not in mock DB

    const { moveFixture } = await import('@/actions/admin/fixtures')
    const result = await moveFixture(formData)

    expect(result).toEqual({ error: expect.stringContaining('Gameweek 38 not found') })
  })

  it('changes gameweek_id to the target gameweek', async () => {
    const TARGET_GW_ID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
    const updateMock = vi.fn().mockReturnThis()
    const eqUpdateMock = vi.fn().mockResolvedValue({ data: {}, error: null })
    updateMock.mockReturnValue({ eq: eqUpdateMock })

    mockAdminClient.from = vi.fn().mockImplementation((table: string) => {
      if (table === 'gameweeks') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: TARGET_GW_ID, number: 5 },
            error: null,
          }),
        }
      }
      if (table === 'fixtures') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: FIXTURE_ID,
              gameweek_id: GAMEWEEK_ID,
              home_team_id: HOME_TEAM_ID,
              away_team_id: AWAY_TEAM_ID,
              gameweeks: { number: 1 },
            },
            error: null,
          }),
          update: updateMock,
        }
      }
      if (table === 'admin_notifications') {
        return {
          insert: vi.fn().mockReturnThis(),
          then: vi.fn().mockResolvedValue({ error: null }),
        }
      }
      return { update: updateMock, eq: eqUpdateMock, insert: vi.fn().mockReturnThis(), then: vi.fn().mockResolvedValue({ error: null }) }
    })

    const formData = new FormData()
    formData.set('fixture_id', FIXTURE_ID)
    formData.set('target_gameweek_number', '5')

    const { moveFixture } = await import('@/actions/admin/fixtures')
    const result = await moveFixture(formData)

    expect(result).toEqual({ success: true })
    expect(updateMock).toHaveBeenCalledWith({ gameweek_id: TARGET_GW_ID })
  })

  it('returns error if caller is not admin', async () => {
    mockNonAdminUser()

    const formData = new FormData()
    formData.set('fixture_id', FIXTURE_ID)
    formData.set('target_gameweek_number', '5')

    const { moveFixture } = await import('@/actions/admin/fixtures')
    const result = await moveFixture(formData)

    expect(result).toEqual({ error: expect.any(String) })
  })
})

// ─── triggerSync ──────────────────────────────────────────────────────────────

describe('triggerSync admin action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminUser()
  })

  it('calls syncFixtures and returns the sync result', async () => {
    const mockResult = {
      success: true,
      fixtures_updated: 38,
      rescheduled: [],
      errors: [],
    }
    mockSyncFixtures.mockResolvedValue(mockResult)

    const { triggerSync } = await import('@/actions/admin/fixtures')
    const result = await triggerSync()

    expect(mockSyncFixtures).toHaveBeenCalledTimes(1)
    expect(result).toEqual(mockResult)
  })

  it('returns error if caller is not admin', async () => {
    mockNonAdminUser()

    const { triggerSync } = await import('@/actions/admin/fixtures')
    const result = await triggerSync()

    expect(result).toEqual({ error: expect.any(String) })
    expect(mockSyncFixtures).not.toHaveBeenCalled()
  })

  it('returns sync failure result when syncFixtures fails', async () => {
    const failResult = {
      success: false,
      fixtures_updated: 0,
      rescheduled: [],
      errors: ['API key not set'],
    }
    mockSyncFixtures.mockResolvedValue(failResult)

    const { triggerSync } = await import('@/actions/admin/fixtures')
    const result = await triggerSync()

    expect(result).toEqual(failResult)
  })
})
