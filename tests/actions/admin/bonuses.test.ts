/**
 * Tests for admin bonus management server actions.
 *
 * Covers:
 * - setBonusForGameweek: auth rejection, validation failure, successful upsert
 * - toggleDoubleBubble: auth rejection, successful toggle
 * - confirmBonusAward: auth rejection, successful confirmation
 * - bulkConfirmBonusAwards: auth rejection, approve_all success
 * - createBonusType: auth rejection, successful creation
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
  setBonusForGameweek,
  toggleDoubleBubble,
  confirmBonusAward,
  bulkConfirmBonusAwards,
  createBonusType,
} from '@/actions/admin/bonuses'

// ─── Constants ────────────────────────────────────────────────────────────────

const GAMEWEEK_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const BONUS_TYPE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const AWARD_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const ADMIN_USER_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

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

// ─── setBonusForGameweek tests ────────────────────────────────────────────────

describe('setBonusForGameweek', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns { error } without touching DB when caller is not admin', async () => {
    mockNonAdminAuth()

    const formData = new FormData()
    formData.set('gameweek_id', GAMEWEEK_ID)
    formData.set('bonus_type_id', BONUS_TYPE_ID)

    const result = await setBonusForGameweek(formData)

    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toContain('Unauthorized')
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('returns { error } when gameweek_id is missing (validation failure)', async () => {
    mockAdminAuth()

    const formData = new FormData()
    // Missing gameweek_id
    formData.set('bonus_type_id', BONUS_TYPE_ID)

    const result = await setBonusForGameweek(formData)

    expect(result).toHaveProperty('error')
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('returns { error } when bonus_type_id is not a UUID (validation failure)', async () => {
    mockAdminAuth()

    const formData = new FormData()
    formData.set('gameweek_id', GAMEWEEK_ID)
    formData.set('bonus_type_id', 'not-a-uuid')

    const result = await setBonusForGameweek(formData)

    expect(result).toHaveProperty('error')
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('upserts bonus_schedule and returns { success: true } on valid input', async () => {
    mockAdminAuth()

    let capturedUpsertRow: Record<string, unknown> | null = null

    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'bonus_awards') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
            }),
          }
        }
        if (table === 'bonus_schedule') {
          return {
            upsert: vi.fn().mockImplementation((row: Record<string, unknown>) => {
              capturedUpsertRow = row
              return Promise.resolve({ error: null })
            }),
          }
        }
        if (table === 'admin_notifications') {
          return {
            insert: vi.fn().mockReturnValue(Promise.resolve({ error: null })),
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
          insert: vi.fn().mockReturnValue(Promise.resolve({ error: null })),
        }
      }),
    }

    vi.mocked(createAdminClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof createAdminClient>
    )

    const formData = new FormData()
    formData.set('gameweek_id', GAMEWEEK_ID)
    formData.set('bonus_type_id', BONUS_TYPE_ID)

    const result = await setBonusForGameweek(formData)

    expect(result).toMatchObject({ success: true })
    expect(capturedUpsertRow).toMatchObject({
      gameweek_id: GAMEWEEK_ID,
      bonus_type_id: BONUS_TYPE_ID,
      confirmed: true,
    })
  })
})

// ─── toggleDoubleBubble tests ─────────────────────────────────────────────────

describe('toggleDoubleBubble', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns { error } when caller is not admin', async () => {
    mockNonAdminAuth()

    const formData = new FormData()
    formData.set('gameweek_id', GAMEWEEK_ID)
    formData.set('enabled', 'true')

    const result = await toggleDoubleBubble(formData)

    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toContain('Unauthorized')
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('updates gameweeks.double_bubble and returns { success: true }', async () => {
    mockAdminAuth()

    let capturedUpdatePayload: Record<string, unknown> | null = null
    let capturedUpdateId: string | null = null

    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'gameweeks') {
          return {
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
        return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ error: null }),
          insert: vi.fn().mockReturnValue(Promise.resolve({ error: null })),
        }
      }),
    }

    vi.mocked(createAdminClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof createAdminClient>
    )

    const formData = new FormData()
    formData.set('gameweek_id', GAMEWEEK_ID)
    formData.set('enabled', 'true')

    const result = await toggleDoubleBubble(formData)

    expect(result).toEqual({ success: true })
    expect(capturedUpdatePayload).toMatchObject({ double_bubble: true })
    expect(capturedUpdateId).toBe(GAMEWEEK_ID)
  })
})

// ─── confirmBonusAward tests ──────────────────────────────────────────────────

describe('confirmBonusAward', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns { error } when caller is not admin', async () => {
    mockNonAdminAuth()

    const formData = new FormData()
    formData.set('award_id', AWARD_ID)
    formData.set('awarded', 'true')

    const result = await confirmBonusAward(formData)

    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toContain('Unauthorized')
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('updates bonus_awards.awarded with confirmed_by and confirmed_at and returns { success: true }', async () => {
    mockAdminAuth()

    let capturedUpdatePayload: Record<string, unknown> | null = null

    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'bonus_awards') {
          return {
            update: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
              capturedUpdatePayload = payload
              return {
                eq: vi.fn().mockResolvedValue({ error: null }),
              }
            }),
          }
        }
        return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ error: null }),
        }
      }),
    }

    vi.mocked(createAdminClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof createAdminClient>
    )

    const formData = new FormData()
    formData.set('award_id', AWARD_ID)
    formData.set('awarded', 'true')

    const result = await confirmBonusAward(formData)

    expect(result).toEqual({ success: true })
    expect(capturedUpdatePayload).toMatchObject({
      awarded: true,
      confirmed_by: ADMIN_USER_ID,
    })
    expect(capturedUpdatePayload).toHaveProperty('confirmed_at')
  })
})

// ─── bulkConfirmBonusAwards tests ─────────────────────────────────────────────

describe('bulkConfirmBonusAwards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns { error } when caller is not admin', async () => {
    mockNonAdminAuth()

    const formData = new FormData()
    formData.set('gameweek_id', GAMEWEEK_ID)
    formData.set('action', 'approve_all')

    const result = await bulkConfirmBonusAwards(formData)

    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toContain('Unauthorized')
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('updates all pending bonus_awards to awarded=true for approve_all', async () => {
    mockAdminAuth()

    let capturedUpdatePayload: Record<string, unknown> | null = null
    let capturedIsNullField: string | null = null

    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'bonus_awards') {
          const chain = {
            update: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
              capturedUpdatePayload = payload
              return {
                eq: vi.fn().mockReturnValue({
                  is: vi.fn().mockImplementation((field: string) => {
                    capturedIsNullField = field
                    return Promise.resolve({ error: null })
                  }),
                }),
              }
            }),
          }
          return chain
        }
        return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockResolvedValue({ error: null }),
        }
      }),
    }

    vi.mocked(createAdminClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof createAdminClient>
    )

    const formData = new FormData()
    formData.set('gameweek_id', GAMEWEEK_ID)
    formData.set('action', 'approve_all')

    const result = await bulkConfirmBonusAwards(formData)

    expect(result).toEqual({ success: true })
    expect(capturedUpdatePayload).toMatchObject({
      awarded: true,
      confirmed_by: ADMIN_USER_ID,
    })
    expect(capturedIsNullField).toBe('awarded')
  })
})

// ─── createBonusType tests ────────────────────────────────────────────────────

describe('createBonusType', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns { error } when caller is not admin', async () => {
    mockNonAdminAuth()

    const formData = new FormData()
    formData.set('name', 'My Bonus')
    formData.set('description', 'Score a hat-trick')

    const result = await createBonusType(formData)

    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toContain('Unauthorized')
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('returns { error } when name is empty (validation failure)', async () => {
    mockAdminAuth()

    const formData = new FormData()
    formData.set('name', '')
    formData.set('description', 'Some description')

    const result = await createBonusType(formData)

    expect(result).toHaveProperty('error')
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('inserts bonus type with is_custom=true and returns { success: true, id }', async () => {
    mockAdminAuth()

    let capturedInsertRow: Record<string, unknown> | null = null
    const NEW_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'

    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'bonus_types') {
          return {
            insert: vi.fn().mockImplementation((row: Record<string, unknown>) => {
              capturedInsertRow = row
              return {
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: NEW_ID },
                    error: null,
                  }),
                }),
              }
            }),
          }
        }
        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: NEW_ID }, error: null }),
        }
      }),
    }

    vi.mocked(createAdminClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof createAdminClient>
    )

    const formData = new FormData()
    formData.set('name', 'My Custom Bonus')
    formData.set('description', 'Score a hat-trick in regulation time')

    const result = await createBonusType(formData)

    expect(result).toMatchObject({ success: true, id: NEW_ID })
    expect(capturedInsertRow).toMatchObject({
      name: 'My Custom Bonus',
      description: 'Score a hat-trick in regulation time',
      is_custom: true,
    })
  })
})
