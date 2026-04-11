/**
 * Tests for admin gameweek lifecycle server actions.
 *
 * Covers:
 * - getCloseGameweekSummary: auth rejection, blocking fixtures, pending awards, canClose logic
 * - closeGameweek: auth rejection, blocked by fixtures, blocked by awards, success path
 * - reopenGameweek: auth rejection, success path (clears closed_at / closed_by)
 * - updateAdminSettings: auth rejection, upserts settings correctly
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

import { createAdminClient } from '@/lib/supabase/admin'
import {
  getCloseGameweekSummary,
  closeGameweek,
  reopenGameweek,
  updateAdminSettings,
} from '@/actions/admin/gameweeks'

// ─── Constants ────────────────────────────────────────────────────────────────

const GAMEWEEK_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
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

// ─── getCloseGameweekSummary ──────────────────────────────────────────────────

describe('getCloseGameweekSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns { error } when caller is not admin', async () => {
    mockNonAdminAuth()

    const result = await getCloseGameweekSummary(GAMEWEEK_ID)

    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toContain('Unauthorized')
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('returns blocking fixtures when non-FINISHED/CANCELLED/POSTPONED fixtures exist', async () => {
    mockAdminAuth()

    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'fixtures') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { id: 'fix-1', home_team: { name: 'Arsenal' }, away_team: { name: 'Chelsea' }, status: 'FINISHED' },
                  { id: 'fix-2', home_team: { name: 'Man City' }, away_team: { name: 'Liverpool' }, status: 'IN_PLAY' },
                ],
                error: null,
              }),
            }),
          }
        }
        if (table === 'bonus_awards') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }
        }
        if (table === 'bonus_schedule') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { confirmed: false }, error: null }),
              }),
            }),
          }
        }
        if (table === 'prediction_scores') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }
        }
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() }
      }),
    }

    vi.mocked(createAdminClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof createAdminClient>
    )

    const result = await getCloseGameweekSummary(GAMEWEEK_ID)

    expect(result).not.toHaveProperty('error')
    const summary = result as Awaited<ReturnType<typeof getCloseGameweekSummary>>
    if ('error' in summary) throw new Error('Expected no error')
    expect(summary.canClose).toBe(false)
    expect(summary.blockingFixtures).toHaveLength(1)
    expect(summary.blockingFixtures[0].status).toBe('IN_PLAY')
  })

  it('returns pendingBonusAwards count when awards are unconfirmed', async () => {
    mockAdminAuth()

    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'fixtures') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { id: 'fix-1', home_team: { name: 'Arsenal' }, away_team: { name: 'Chelsea' }, status: 'FINISHED' },
                ],
                error: null,
              }),
            }),
          }
        }
        if (table === 'bonus_awards') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({
                  data: [{ id: 'award-1' }, { id: 'award-2' }],
                  error: null,
                }),
              }),
            }),
          }
        }
        if (table === 'bonus_schedule') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { confirmed: true }, error: null }),
              }),
            }),
          }
        }
        if (table === 'prediction_scores') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [{ points_awarded: 10 }], error: null }),
            }),
          }
        }
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() }
      }),
    }

    vi.mocked(createAdminClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof createAdminClient>
    )

    const result = await getCloseGameweekSummary(GAMEWEEK_ID)

    expect(result).not.toHaveProperty('error')
    const summary = result as Awaited<ReturnType<typeof getCloseGameweekSummary>>
    if ('error' in summary) throw new Error('Expected no error')
    expect(summary.pendingBonusAwards).toBe(2)
    expect(summary.canClose).toBe(false)
  })

  it('returns canClose=true when all fixtures are finished and no pending awards', async () => {
    mockAdminAuth()

    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'fixtures') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { id: 'fix-1', home_team: { name: 'Arsenal' }, away_team: { name: 'Chelsea' }, status: 'FINISHED' },
                  { id: 'fix-2', home_team: { name: 'Man City' }, away_team: { name: 'Spurs' }, status: 'CANCELLED' },
                ],
                error: null,
              }),
            }),
          }
        }
        if (table === 'bonus_awards') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }
        }
        if (table === 'bonus_schedule') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { confirmed: true }, error: null }),
              }),
            }),
          }
        }
        if (table === 'prediction_scores') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [{ points_awarded: 30 }, { points_awarded: 10 }], error: null }),
            }),
          }
        }
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() }
      }),
    }

    vi.mocked(createAdminClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof createAdminClient>
    )

    const result = await getCloseGameweekSummary(GAMEWEEK_ID)

    expect(result).not.toHaveProperty('error')
    const summary = result as Awaited<ReturnType<typeof getCloseGameweekSummary>>
    if ('error' in summary) throw new Error('Expected no error')
    expect(summary.canClose).toBe(true)
    expect(summary.blockingFixtures).toHaveLength(0)
    expect(summary.pendingBonusAwards).toBe(0)
    expect(summary.totalPointsDistributed).toBe(40)
  })
})

// ─── closeGameweek ────────────────────────────────────────────────────────────

describe('closeGameweek', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns { error } when caller is not admin', async () => {
    mockNonAdminAuth()

    const formData = new FormData()
    formData.set('gameweek_id', GAMEWEEK_ID)

    const result = await closeGameweek(formData)

    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toContain('Unauthorized')
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('returns { error } when gameweek_id is missing (validation failure)', async () => {
    mockAdminAuth()

    const formData = new FormData()
    // Missing gameweek_id

    const result = await closeGameweek(formData)

    expect(result).toHaveProperty('error')
  })

  it('returns { error } when fixtures are not finished', async () => {
    mockAdminAuth()

    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'fixtures') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { id: 'fix-1', home_team: { name: 'Arsenal' }, away_team: { name: 'Chelsea' }, status: 'IN_PLAY' },
                ],
                error: null,
              }),
            }),
          }
        }
        if (table === 'bonus_awards') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }
        }
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() }
      }),
    }

    vi.mocked(createAdminClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof createAdminClient>
    )

    const formData = new FormData()
    formData.set('gameweek_id', GAMEWEEK_ID)

    const result = await closeGameweek(formData)

    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toContain('Cannot close')
  })

  it('returns { error } when there are pending bonus awards', async () => {
    mockAdminAuth()

    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'fixtures') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { id: 'fix-1', home_team: { name: 'Arsenal' }, away_team: { name: 'Chelsea' }, status: 'FINISHED' },
                ],
                error: null,
              }),
            }),
          }
        }
        if (table === 'bonus_awards') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({
                  data: [{ id: 'award-1' }],
                  error: null,
                }),
              }),
            }),
          }
        }
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() }
      }),
    }

    vi.mocked(createAdminClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof createAdminClient>
    )

    const formData = new FormData()
    formData.set('gameweek_id', GAMEWEEK_ID)

    const result = await closeGameweek(formData)

    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toContain('Cannot close')
  })

  it('closes gameweek and creates gw_complete notification on success', async () => {
    mockAdminAuth()

    let capturedUpdatePayload: Record<string, unknown> | null = null
    let capturedUpdateId: string | null = null
    let capturedNotification: Record<string, unknown> | null = null

    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'fixtures') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { id: 'fix-1', home_team: { name: 'Arsenal' }, away_team: { name: 'Chelsea' }, status: 'FINISHED' },
                ],
                error: null,
              }),
            }),
          }
        }
        if (table === 'bonus_awards') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }
        }
        if (table === 'gameweeks') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: GAMEWEEK_ID, number: 5 },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
              capturedUpdatePayload = payload
              return {
                eq: vi.fn().mockImplementation((_col: string, val: string) => {
                  capturedUpdateId = val
                  return Promise.resolve({ error: null })
                }),
              }
            }),
          }
        }
        if (table === 'admin_notifications') {
          return {
            insert: vi.fn().mockImplementation((row: Record<string, unknown>) => {
              capturedNotification = row
              return Promise.resolve({ error: null })
            }),
          }
        }
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() }
      }),
    }

    vi.mocked(createAdminClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof createAdminClient>
    )

    const formData = new FormData()
    formData.set('gameweek_id', GAMEWEEK_ID)

    const result = await closeGameweek(formData)

    expect(result).toEqual({ success: true })
    expect(capturedUpdatePayload).toMatchObject({
      closed_by: ADMIN_USER_ID,
    })
    expect(capturedUpdatePayload).toHaveProperty('closed_at')
    expect(capturedUpdateId).toBe(GAMEWEEK_ID)
    expect(capturedNotification).toMatchObject({
      type: 'gw_complete',
    })
  })
})

// ─── reopenGameweek ───────────────────────────────────────────────────────────

describe('reopenGameweek', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns { error } when caller is not admin', async () => {
    mockNonAdminAuth()

    const formData = new FormData()
    formData.set('gameweek_id', GAMEWEEK_ID)

    const result = await reopenGameweek(formData)

    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toContain('Unauthorized')
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('clears closed_at and closed_by on success', async () => {
    mockAdminAuth()

    let capturedUpdatePayload: Record<string, unknown> | null = null
    let capturedUpdateId: string | null = null

    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'gameweeks') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: GAMEWEEK_ID, number: 5 },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
              capturedUpdatePayload = payload
              return {
                eq: vi.fn().mockImplementation((_col: string, val: string) => {
                  capturedUpdateId = val
                  return Promise.resolve({ error: null })
                }),
              }
            }),
          }
        }
        if (table === 'admin_notifications') {
          return {
            insert: vi.fn().mockReturnValue(Promise.resolve({ error: null })),
          }
        }
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() }
      }),
    }

    vi.mocked(createAdminClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof createAdminClient>
    )

    const formData = new FormData()
    formData.set('gameweek_id', GAMEWEEK_ID)

    const result = await reopenGameweek(formData)

    expect(result).toEqual({ success: true })
    expect(capturedUpdatePayload).toMatchObject({
      closed_at: null,
      closed_by: null,
    })
    expect(capturedUpdateId).toBe(GAMEWEEK_ID)
  })
})

// ─── updateAdminSettings ──────────────────────────────────────────────────────

describe('updateAdminSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns { error } when caller is not admin', async () => {
    mockNonAdminAuth()

    const formData = new FormData()
    formData.set('email_bonus_reminders', 'true')
    formData.set('email_gw_complete', 'true')
    formData.set('email_prize_triggered', 'false')

    const result = await updateAdminSettings(formData)

    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toContain('Unauthorized')
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('upserts admin_settings with correct toggle values', async () => {
    mockAdminAuth()

    let capturedUpsertPayload: Record<string, unknown> | null = null

    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'admin_settings') {
          return {
            upsert: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
              capturedUpsertPayload = payload
              return Promise.resolve({ error: null })
            }),
          }
        }
        return {}
      }),
    }

    vi.mocked(createAdminClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof createAdminClient>
    )

    const formData = new FormData()
    formData.set('email_bonus_reminders', 'true')
    formData.set('email_gw_complete', 'false')
    formData.set('email_prize_triggered', 'true')

    const result = await updateAdminSettings(formData)

    expect(result).toEqual({ success: true })
    expect(capturedUpsertPayload).toMatchObject({
      admin_user_id: ADMIN_USER_ID,
      email_bonus_reminders: true,
      email_gw_complete: false,
      email_prize_triggered: true,
    })
    expect(capturedUpsertPayload).toHaveProperty('updated_at')
  })
})
