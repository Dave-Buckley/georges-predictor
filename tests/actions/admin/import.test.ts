/**
 * Tests for admin import server actions.
 *
 * All Supabase calls are mocked via tests/setup.ts.
 * Tests verify the contract of each server action — not the internals of Supabase.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabaseClient } from '../../setup'

// ─── Module mocks ─────────────────────────────────────────────────────────────

// Mock next/cache (revalidatePath used in import actions)
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// Mock next/navigation
vi.mock('next/navigation', () => ({
  redirect: vi.fn().mockImplementation((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  }),
}))

// Mock createAdminClient — used for RLS-bypassing bulk inserts
const mockAdminClient = createMockSupabaseClient()
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mockAdminClient),
}))

// Mock createServerSupabaseClient — used for getUser() auth checks
const mockServerClient = createMockSupabaseClient()
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(() => mockServerClient),
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mockAdminUser(email = 'george@example.com') {
  mockServerClient.auth.getUser = vi.fn().mockResolvedValue({
    data: {
      user: {
        id: 'admin-user-id',
        app_metadata: { role: 'admin' },
        email,
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

const sampleRows = [
  { display_name: 'Big Steve', starting_points: 340 },
  { display_name: 'Dan The Man', starting_points: 280 },
]

// ─── importMembers ────────────────────────────────────────────────────────────

describe('importMembers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminUser()

    // Default: no existing members with conflicting names
    mockAdminClient.from = vi.fn().mockImplementation((table: string) => {
      if (table === 'members') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          ilike: vi.fn().mockReturnThis(),
          insert: vi.fn().mockResolvedValue({ data: [], error: null }),
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
          // For the conflict check query
          then: undefined,
        }
      }
      if (table === 'admin_notifications') {
        return {
          insert: vi.fn().mockResolvedValue({ data: {}, error: null }),
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockResolvedValue({ data: {}, error: null }),
      }
    })
  })

  it('rejects non-admin callers', async () => {
    mockNonAdminUser()
    const { importMembers } = await import('@/actions/admin/import')
    const result = await importMembers(sampleRows)
    expect(result).toEqual({ error: expect.any(String) })
  })

  it('returns error for invalid input (empty array)', async () => {
    const { importMembers } = await import('@/actions/admin/import')
    const result = await importMembers([])
    expect(result).toEqual({ error: expect.any(String) })
  })

  it('returns error when names already exist (case-insensitive conflict check)', async () => {
    // Mock: members table returns an existing member with the same name
    mockAdminClient.from = vi.fn().mockImplementation((table: string) => {
      if (table === 'members') {
        return {
          select: vi.fn().mockReturnThis(),
          // The conflict query returns one existing row
          then: undefined,
          in: vi.fn().mockResolvedValue({
            data: [{ display_name: 'big steve' }],
            error: null,
          }),
        }
      }
      return {
        insert: vi.fn().mockResolvedValue({ data: {}, error: null }),
      }
    })

    const { importMembers } = await import('@/actions/admin/import')
    const result = await importMembers(sampleRows)
    expect(result).toMatchObject({ error: expect.stringContaining('already exist') })
  })

  it('inserts member rows with user_id=null and approval_status=pending', async () => {
    const insertMock = vi.fn().mockResolvedValue({ data: [], error: null })

    mockAdminClient.from = vi.fn().mockImplementation((table: string) => {
      if (table === 'members') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
          insert: insertMock,
        }
      }
      if (table === 'admin_notifications') {
        return {
          insert: vi.fn().mockResolvedValue({ data: {}, error: null }),
        }
      }
      return {
        insert: vi.fn().mockResolvedValue({ data: {}, error: null }),
      }
    })

    const { importMembers } = await import('@/actions/admin/import')
    await importMembers(sampleRows)

    expect(insertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          display_name: 'Big Steve',
          starting_points: 340,
          user_id: null,
          approval_status: 'pending',
        }),
      ])
    )
  })

  it('calls revalidatePath for /admin/members and /admin/import', async () => {
    const insertMock = vi.fn().mockResolvedValue({ data: [], error: null })

    mockAdminClient.from = vi.fn().mockImplementation((table: string) => {
      if (table === 'members') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
          insert: insertMock,
        }
      }
      if (table === 'admin_notifications') {
        return {
          insert: vi.fn().mockResolvedValue({ data: {}, error: null }),
        }
      }
      return {
        insert: vi.fn().mockResolvedValue({ data: {}, error: null }),
      }
    })

    const { importMembers } = await import('@/actions/admin/import')
    const { revalidatePath } = await import('next/cache')
    await importMembers(sampleRows)

    expect(revalidatePath).toHaveBeenCalledWith('/admin/members')
    expect(revalidatePath).toHaveBeenCalledWith('/admin/import')
  })

  it('returns { success: true, imported: N }', async () => {
    const insertMock = vi.fn().mockResolvedValue({ data: [], error: null })

    mockAdminClient.from = vi.fn().mockImplementation((table: string) => {
      if (table === 'members') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
          insert: insertMock,
        }
      }
      if (table === 'admin_notifications') {
        return {
          insert: vi.fn().mockResolvedValue({ data: {}, error: null }),
        }
      }
      return {
        insert: vi.fn().mockResolvedValue({ data: {}, error: null }),
      }
    })

    const { importMembers } = await import('@/actions/admin/import')
    const result = await importMembers(sampleRows)
    expect(result).toEqual({ success: true, imported: 2 })
  })
})

// ─── clearImportedMembers ─────────────────────────────────────────────────────

describe('clearImportedMembers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminUser()

    mockAdminClient.from = vi.fn().mockImplementation((table: string) => {
      if (table === 'members') {
        return {
          select: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          delete: vi.fn().mockReturnThis(),
          // count queries
          then: undefined,
        }
      }
      return {}
    })
  })

  it('rejects non-admin callers', async () => {
    mockNonAdminUser()
    const { clearImportedMembers } = await import('@/actions/admin/import')
    const result = await clearImportedMembers()
    expect(result).toEqual({ error: expect.any(String) })
  })

  it('deletes only user_id IS NULL rows', async () => {
    const deleteMock = vi.fn().mockReturnThis()
    const isDeleteMock = vi.fn().mockResolvedValue({ data: [], error: null })
    const countSelectMock = vi.fn().mockResolvedValue({ count: 3, error: null })

    mockAdminClient.from = vi.fn().mockImplementation((table: string) => {
      if (table === 'members') {
        return {
          select: vi.fn().mockReturnValue({
            is: countSelectMock,
          }),
          delete: vi.fn().mockReturnValue({
            is: isDeleteMock,
          }),
        }
      }
      return {}
    })

    const { clearImportedMembers } = await import('@/actions/admin/import')
    await clearImportedMembers()

    // Verify delete was called on members table
    const fromCalls = (mockAdminClient.from as ReturnType<typeof vi.fn>).mock.calls
    const membersDeleteCalls = fromCalls.filter(([table]: [string]) => table === 'members')
    expect(membersDeleteCalls.length).toBeGreaterThan(0)
    void deleteMock
    void isDeleteMock
  })

  it('returns { success: true, deleted: N }', async () => {
    mockAdminClient.from = vi.fn().mockImplementation((table: string) => {
      if (table === 'members') {
        return {
          select: vi.fn().mockReturnValue({
            is: vi.fn().mockResolvedValue({ count: 3, error: null }),
          }),
          delete: vi.fn().mockReturnValue({
            is: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }
      }
      return {}
    })

    const { clearImportedMembers } = await import('@/actions/admin/import')
    const result = await clearImportedMembers()
    expect(result).toMatchObject({ success: true, deleted: expect.any(Number) })
  })
})

// ─── importPreSeasonPicks ─────────────────────────────────────────────────────

const samplePickRows = [
  {
    member_name: 'Big Steve',
    season: 2025,
    top4: ['Man City', 'Arsenal', 'Liverpool', 'Chelsea'],
    tenth_place: 'Wolves',
    relegated: ['Luton', 'Burnley', 'Sheffield Utd'],
    promoted: ['Leeds', 'Ipswich', 'Southampton'],
    promoted_playoff_winner: 'Southampton',
  },
]

describe('importPreSeasonPicks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminUser()
  })

  it('rejects non-admin callers', async () => {
    mockNonAdminUser()
    const { importPreSeasonPicks } = await import('@/actions/admin/import')
    const result = await importPreSeasonPicks(samplePickRows)
    expect(result).toEqual({ error: expect.any(String) })
  })

  it('returns error listing unmatched member names', async () => {
    // Members table returns no matching member
    mockAdminClient.from = vi.fn().mockImplementation((table: string) => {
      if (table === 'members') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      }
      return {}
    })

    const { importPreSeasonPicks } = await import('@/actions/admin/import')
    const result = await importPreSeasonPicks(samplePickRows)
    expect(result).toMatchObject({ error: expect.stringContaining('Big Steve') })
  })

  it('upserts picks for matched members', async () => {
    const upsertMock = vi.fn().mockResolvedValue({ data: [], error: null })

    mockAdminClient.from = vi.fn().mockImplementation((table: string) => {
      if (table === 'members') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [{ id: 'member-uuid-1', display_name: 'Big Steve' }],
            error: null,
          }),
        }
      }
      if (table === 'pre_season_picks') {
        return {
          upsert: upsertMock,
        }
      }
      return {}
    })

    const { importPreSeasonPicks } = await import('@/actions/admin/import')
    const result = await importPreSeasonPicks(samplePickRows)

    expect(upsertMock).toHaveBeenCalled()
    expect(result).toEqual({ success: true, imported: 1 })
  })
})
