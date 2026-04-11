/**
 * Tests for admin scoring server actions.
 *
 * Covers:
 * - applyResultOverride: auth rejection (no DB writes)
 * - applyResultOverride: validation failure (no DB writes)
 * - applyResultOverride: successful override with full audit trail
 * - getOverrideImpact: auth rejection
 * - getOverrideImpact: returns prediction count and current scores
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabaseClient } from '../../setup'

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// Admin client mock (used for DB operations)
const mockAdminClient = createMockSupabaseClient()
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mockAdminClient),
}))

// Server client mock (used for auth checks)
const mockServerClient = createMockSupabaseClient()
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(() => mockServerClient),
}))

// recalculateFixture mock
vi.mock('@/lib/scoring/recalculate', () => ({
  recalculateFixture: vi.fn(),
}))

import { createAdminClient } from '@/lib/supabase/admin'
import { recalculateFixture } from '@/lib/scoring/recalculate'
import { applyResultOverride, getOverrideImpact } from '@/actions/admin/scoring'

// ─── Constants ────────────────────────────────────────────────────────────────

const FIXTURE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ADMIN_USER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function mockAdminAuth() {
  mockServerClient.auth.getUser = vi.fn().mockResolvedValue({
    data: {
      user: {
        id: ADMIN_USER_ID,
        app_metadata: { role: 'admin' },
      },
    },
    error: null,
  })
}

function mockNonAdminAuth() {
  mockServerClient.auth.getUser = vi.fn().mockResolvedValue({
    data: {
      user: {
        id: 'member-id',
        app_metadata: { role: 'member' },
      },
    },
    error: null,
  })
}

function mockNoUserAuth() {
  mockServerClient.auth.getUser = vi.fn().mockResolvedValue({
    data: { user: null },
    error: { message: 'not authenticated' },
  })
}

// ─── applyResultOverride tests ────────────────────────────────────────────────

describe('applyResultOverride', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(recalculateFixture).mockResolvedValue({
      fixture_id: FIXTURE_ID,
      predictions_scored: 0,
      bonus_calculated: 0,
      errors: [],
    })
  })

  it('returns { error } without touching DB when caller is not admin', async () => {
    mockNonAdminAuth()

    const formData = new FormData()
    formData.set('fixture_id', FIXTURE_ID)
    formData.set('home_score', '2')
    formData.set('away_score', '1')

    const result = await applyResultOverride(formData)

    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toContain('Unauthorized')
    // Admin client should never be called
    expect(createAdminClient).not.toHaveBeenCalled()
    expect(vi.mocked(recalculateFixture)).not.toHaveBeenCalled()
  })

  it('returns { error } without DB writes when fixture_id is missing (validation failure)', async () => {
    mockAdminAuth()

    const formData = new FormData()
    // Missing fixture_id — Zod validation should fail
    formData.set('home_score', '2')
    formData.set('away_score', '1')

    const result = await applyResultOverride(formData)

    expect(result).toHaveProperty('error')
    // No DB writes should occur
    expect(createAdminClient).not.toHaveBeenCalled()
    expect(vi.mocked(recalculateFixture)).not.toHaveBeenCalled()
  })

  it('returns { error } without DB writes when scores are invalid (out of range)', async () => {
    mockAdminAuth()

    const formData = new FormData()
    formData.set('fixture_id', FIXTURE_ID)
    formData.set('home_score', '25') // exceeds max of 20
    formData.set('away_score', '1')

    const result = await applyResultOverride(formData)

    expect(result).toHaveProperty('error')
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('updates fixture, calls recalculate, inserts audit row with correct values on success', async () => {
    mockAdminAuth()

    // Track captured calls for assertions
    let capturedUpdatePayload: Record<string, unknown> | null = null
    let capturedUpdateFixtureId: string | null = null
    let capturedAuditRow: Record<string, unknown> | null = null

    const mockFixtureData = {
      home_score: 1,
      away_score: 0,
      home_team: { name: 'Arsenal' },
      away_team: { name: 'Chelsea' },
    }

    vi.mocked(recalculateFixture).mockResolvedValue({
      fixture_id: FIXTURE_ID,
      predictions_scored: 5,
      bonus_calculated: 0,
      errors: [],
    })

    // Build mock admin client with table-specific handlers
    const mockClientWithTracking = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'fixtures') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockFixtureData, error: null }),
              }),
            }),
            update: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
              capturedUpdatePayload = payload
              return {
                eq: vi.fn().mockImplementation((_col: string, val: string) => {
                  capturedUpdateFixtureId = val
                  return Promise.resolve({ error: null })
                }),
              }
            }),
          }
        }
        if (table === 'result_overrides') {
          return {
            insert: vi.fn().mockImplementation((row: Record<string, unknown>) => {
              capturedAuditRow = row
              return Promise.resolve({ error: null })
            }),
          }
        }
        if (table === 'admin_notifications') {
          return {
            insert: vi.fn().mockReturnValue(
              Promise.resolve({ error: null })
            ),
          }
        }
        return { insert: vi.fn().mockResolvedValue({ error: null }) }
      }),
    }

    // Replace the mock admin client for this test
    vi.mocked(createAdminClient).mockReturnValue(
      mockClientWithTracking as unknown as ReturnType<typeof createAdminClient>
    )

    const formData = new FormData()
    formData.set('fixture_id', FIXTURE_ID)
    formData.set('home_score', '2')
    formData.set('away_score', '1')

    const result = await applyResultOverride(formData)

    // Assert success
    expect(result).toEqual({ success: true, recalculated: 5 })

    // Assert fixture was updated with new scores and result_source='manual'
    expect(capturedUpdatePayload).toMatchObject({
      home_score: 2,
      away_score: 1,
      status: 'FINISHED',
      result_source: 'manual',
    })
    expect(capturedUpdateFixtureId).toBe(FIXTURE_ID)

    // Assert recalculateFixture was called with correct args
    expect(vi.mocked(recalculateFixture)).toHaveBeenCalledWith(FIXTURE_ID, 2, 1)

    // Assert audit row has correct values including old scores and admin userId
    expect(capturedAuditRow).toMatchObject({
      fixture_id: FIXTURE_ID,
      changed_by: ADMIN_USER_ID,
      old_home: 1,
      old_away: 0,
      new_home: 2,
      new_away: 1,
      predictions_recalculated: 5,
    })
  })
})

// ─── getOverrideImpact tests ──────────────────────────────────────────────────

describe('getOverrideImpact', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns { error } when caller is not admin', async () => {
    mockNoUserAuth()

    const result = await getOverrideImpact(FIXTURE_ID)

    expect(result).toHaveProperty('error')
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('returns prediction count and current scores when fixture exists', async () => {
    mockAdminAuth()

    // Build mock that returns count for predictions and fixture data
    const mockClientWithData = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'predictions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 7, error: null }),
            }),
          }
        }
        if (table === 'fixtures') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { home_score: 2, away_score: 1, result_source: 'api' },
                  error: null,
                }),
              }),
            }),
          }
        }
        return {}
      }),
    }

    vi.mocked(createAdminClient).mockReturnValue(
      mockClientWithData as unknown as ReturnType<typeof createAdminClient>
    )

    const result = await getOverrideImpact(FIXTURE_ID)

    expect(result).toEqual({
      prediction_count: 7,
      current_home: 2,
      current_away: 1,
      current_source: 'api',
    })
  })
})
