/**
 * Tests for admin Last One Standing server actions (Phase 8 Plan 03).
 *
 * Covers:
 * - requireAdmin gating (non-admin → error, no DB writes)
 * - overrideEliminate: validation, already-eliminated no-op, happy path
 * - reinstateMember: not-eliminated error, happy path
 * - resetCompetitionManually: with winner_id, without winner_id (explicit override)
 * - setLosPickForMember: clear (team_id null → delete), set (upsert), team-already-used rejection
 * - closeGameweek: calls detectH2HForGameweek + resolveStealsForGameweek (non-blocking)
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

// Mock the H2H sync hooks so we can assert they were invoked from closeGameweek
const mockDetectH2H = vi.fn().mockResolvedValue({ stealsCreated: 0 })
const mockResolveSteals = vi.fn().mockResolvedValue({ resolvedCount: 0 })
vi.mock('@/lib/h2h/sync-hook', () => ({
  detectH2HForGameweek: (...args: unknown[]) => mockDetectH2H(...args),
  resolveStealsForGameweek: (...args: unknown[]) => mockResolveSteals(...args),
}))

// Mock resetCompetitionIfNeeded (used by resetCompetitionManually)
const mockResetCompetitionIfNeeded = vi.fn().mockResolvedValue({ newCompetitionId: 'new-comp-id' })
vi.mock('@/lib/los/round', () => ({
  resetCompetitionIfNeeded: (...args: unknown[]) => mockResetCompetitionIfNeeded(...args),
}))

import { createAdminClient } from '@/lib/supabase/admin'
import {
  overrideEliminate,
  reinstateMember,
  resetCompetitionManually,
  setLosPickForMember,
} from '@/actions/admin/los'
import { closeGameweek } from '@/actions/admin/gameweeks'

// ─── Constants ────────────────────────────────────────────────────────────────

const MEMBER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const COMPETITION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ADMIN_USER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const GAMEWEEK_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const TEAM_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const FIXTURE_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff'

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

// ─── overrideEliminate ────────────────────────────────────────────────────────

describe('overrideEliminate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns { error } when caller is not admin', async () => {
    mockNonAdminAuth()

    const formData = new FormData()
    formData.set('member_id', MEMBER_ID)
    formData.set('competition_id', COMPETITION_ID)
    formData.set('reason', 'admin_override')

    const result = await overrideEliminate(formData)

    expect(result).toHaveProperty('error')
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('returns { error } when validation fails (missing reason)', async () => {
    mockAdminAuth()

    const formData = new FormData()
    formData.set('member_id', MEMBER_ID)
    formData.set('competition_id', COMPETITION_ID)
    // missing reason

    const result = await overrideEliminate(formData)

    expect(result).toHaveProperty('error')
  })

  it('updates los_competition_members to eliminated on happy path', async () => {
    mockAdminAuth()

    let capturedUpdate: Record<string, unknown> | null = null

    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'gameweeks') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { id: GAMEWEEK_ID, number: 7 },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }
        }
        if (table === 'los_competition_members') {
          return {
            update: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
              capturedUpdate = payload
              return {
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({ error: null }),
                }),
              }
            }),
          }
        }
        if (table === 'admin_notifications') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          }
        }
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() }
      }),
    }

    vi.mocked(createAdminClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof createAdminClient>
    )

    const formData = new FormData()
    formData.set('member_id', MEMBER_ID)
    formData.set('competition_id', COMPETITION_ID)
    formData.set('reason', 'admin_override')

    const result = await overrideEliminate(formData)

    expect(result).toMatchObject({ success: true })
    expect(capturedUpdate).toMatchObject({
      status: 'eliminated',
      eliminated_reason: 'admin_override',
      eliminated_at_gw: 7,
    })
  })
})

// ─── reinstateMember ──────────────────────────────────────────────────────────

describe('reinstateMember', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns { error } when caller is not admin', async () => {
    mockNonAdminAuth()

    const formData = new FormData()
    formData.set('member_id', MEMBER_ID)
    formData.set('competition_id', COMPETITION_ID)

    const result = await reinstateMember(formData)

    expect(result).toHaveProperty('error')
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('returns { error } when member is not currently eliminated', async () => {
    mockAdminAuth()

    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'los_competition_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { status: 'active' },
                    error: null,
                  }),
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
    formData.set('member_id', MEMBER_ID)
    formData.set('competition_id', COMPETITION_ID)

    const result = await reinstateMember(formData)

    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toMatch(/not eliminated/i)
  })

  it('flips member back to active on happy path', async () => {
    mockAdminAuth()

    let capturedUpdate: Record<string, unknown> | null = null

    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'los_competition_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { status: 'eliminated' },
                    error: null,
                  }),
                }),
              }),
            }),
            update: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
              capturedUpdate = payload
              return {
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({ error: null }),
                }),
              }
            }),
          }
        }
        if (table === 'admin_notifications') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) }
        }
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() }
      }),
    }

    vi.mocked(createAdminClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof createAdminClient>
    )

    const formData = new FormData()
    formData.set('member_id', MEMBER_ID)
    formData.set('competition_id', COMPETITION_ID)

    const result = await reinstateMember(formData)

    expect(result).toMatchObject({ success: true })
    expect(capturedUpdate).toMatchObject({
      status: 'active',
      eliminated_at_gw: null,
      eliminated_reason: null,
    })
  })
})

// ─── resetCompetitionManually ─────────────────────────────────────────────────

describe('resetCompetitionManually', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns { error } when caller is not admin', async () => {
    mockNonAdminAuth()

    const formData = new FormData()
    formData.set('competition_id', COMPETITION_ID)
    formData.set('season', '2025')
    formData.set('ended_at_gw', '10')

    const result = await resetCompetitionManually(formData)

    expect(result).toHaveProperty('error')
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('calls resetCompetitionIfNeeded with supplied winner_id when provided', async () => {
    mockAdminAuth()

    const formData = new FormData()
    formData.set('competition_id', COMPETITION_ID)
    formData.set('season', '2025')
    formData.set('ended_at_gw', '10')
    formData.set('winner_id', MEMBER_ID)

    const result = await resetCompetitionManually(formData)

    expect(result).toMatchObject({ success: true })
    expect(mockResetCompetitionIfNeeded).toHaveBeenCalled()
    const call = mockResetCompetitionIfNeeded.mock.calls[0]
    // (adminClient, competitionId, endedAtGw, winnerId, season)
    expect(call[1]).toBe(COMPETITION_ID)
    expect(call[2]).toBe(10)
    expect(call[3]).toBe(MEMBER_ID)
    expect(call[4]).toBe(2025)
  })

  it('calls resetCompetitionIfNeeded with null winner_id when not provided', async () => {
    mockAdminAuth()

    const formData = new FormData()
    formData.set('competition_id', COMPETITION_ID)
    formData.set('season', '2025')
    formData.set('ended_at_gw', '10')
    // no winner_id

    const result = await resetCompetitionManually(formData)

    expect(result).toMatchObject({ success: true })
    expect(mockResetCompetitionIfNeeded).toHaveBeenCalled()
    const call = mockResetCompetitionIfNeeded.mock.calls[0]
    expect(call[3]).toBeNull()
  })
})

// ─── setLosPickForMember ──────────────────────────────────────────────────────

describe('setLosPickForMember', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns { error } when caller is not admin', async () => {
    mockNonAdminAuth()

    const formData = new FormData()
    formData.set('member_id', MEMBER_ID)
    formData.set('competition_id', COMPETITION_ID)
    formData.set('gameweek_id', GAMEWEEK_ID)
    formData.set('team_id', TEAM_ID)

    const result = await setLosPickForMember(formData)

    expect(result).toHaveProperty('error')
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('deletes the pick row when team_id is blank', async () => {
    mockAdminAuth()

    let deleteCalled = false

    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'los_picks') {
          return {
            delete: vi.fn().mockImplementation(() => {
              deleteCalled = true
              return {
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({ error: null }),
                  }),
                }),
              }
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
    formData.set('member_id', MEMBER_ID)
    formData.set('competition_id', COMPETITION_ID)
    formData.set('gameweek_id', GAMEWEEK_ID)
    // no team_id — signals clear

    const result = await setLosPickForMember(formData)

    expect(result).toMatchObject({ success: true })
    expect(deleteCalled).toBe(true)
  })

  it('rejects when team already used in a prior gameweek of the same cycle', async () => {
    mockAdminAuth()

    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'los_picks') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    neq: vi.fn().mockResolvedValue({
                      data: [{ id: 'prior-pick' }],
                      error: null,
                    }),
                  }),
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
    formData.set('member_id', MEMBER_ID)
    formData.set('competition_id', COMPETITION_ID)
    formData.set('gameweek_id', GAMEWEEK_ID)
    formData.set('team_id', TEAM_ID)

    const result = await setLosPickForMember(formData)

    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toMatch(/already used/i)
  })

  it('upserts pick with resolved fixture on happy path', async () => {
    mockAdminAuth()

    let capturedUpsert: Record<string, unknown> | null = null

    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'los_picks') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    neq: vi.fn().mockResolvedValue({
                      data: [],
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
            upsert: vi.fn().mockImplementation((row: Record<string, unknown>) => {
              capturedUpsert = row
              return Promise.resolve({ error: null })
            }),
          }
        }
        if (table === 'fixtures') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                or: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { id: FIXTURE_ID },
                      error: null,
                    }),
                  }),
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
    formData.set('member_id', MEMBER_ID)
    formData.set('competition_id', COMPETITION_ID)
    formData.set('gameweek_id', GAMEWEEK_ID)
    formData.set('team_id', TEAM_ID)

    const result = await setLosPickForMember(formData)

    expect(result).toMatchObject({ success: true })
    expect(capturedUpsert).toMatchObject({
      competition_id: COMPETITION_ID,
      member_id: MEMBER_ID,
      gameweek_id: GAMEWEEK_ID,
      team_id: TEAM_ID,
      fixture_id: FIXTURE_ID,
    })
  })
})

// ─── closeGameweek H2H integration ────────────────────────────────────────────

describe('closeGameweek → H2H integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls detectH2HForGameweek + resolveStealsForGameweek after successful close', async () => {
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
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }
        }
        if (table === 'admin_notifications') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
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
    expect(mockDetectH2H).toHaveBeenCalledWith(expect.anything(), GAMEWEEK_ID)
    expect(mockResolveSteals).toHaveBeenCalledWith(expect.anything(), GAMEWEEK_ID)
  })

  it('still returns success when H2H detection throws (non-blocking)', async () => {
    mockAdminAuth()
    mockDetectH2H.mockRejectedValueOnce(new Error('boom'))

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
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }
        }
        if (table === 'admin_notifications') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
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

    // Close still succeeds; H2H error is logged non-blocking
    expect(result).toEqual({ success: true })
  })
})
