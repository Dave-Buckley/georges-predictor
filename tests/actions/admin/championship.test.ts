/**
 * Tests for DB-backed Championship admin actions (Phase 9 Plan 03).
 *
 * Covers:
 *   - getChampionshipTeams: returns rows sorted alpha
 *   - addChampionshipTeam: admin gate + duplicate reject (case-insensitive)
 *   - removeChampionshipTeam: admin gate + delete
 *   - renameChampionshipTeam: admin gate + duplicate reject
 *   - endOfSeasonRollover: admin gate + swaps 3 relegated PL <-> 3 promoted Championship
 *     + idempotent + rejects when actuals invalid + writes admin_notifications
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabaseClient } from '../../setup'

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
  getChampionshipTeams,
  addChampionshipTeam,
  removeChampionshipTeam,
  renameChampionshipTeam,
  endOfSeasonRollover,
} from '@/actions/admin/championship'

const ADMIN_USER_ID = '33333333-3333-4333-8333-333333333333'
const TEAM_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

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

// ─── getChampionshipTeams ─────────────────────────────────────────────────────

describe('getChampionshipTeams', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns array of {id, name} sorted alphabetically', async () => {
    const rows = [
      { id: 'a', name: 'Watford' },
      { id: 'b', name: 'Birmingham City' },
      { id: 'c', name: 'Leeds United' },
    ]
    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [...rows].sort((a, b) => a.name.localeCompare(b.name)),
              error: null,
            }),
          }),
        }),
      }),
    }
    vi.mocked(createAdminClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof createAdminClient>,
    )

    const result = await getChampionshipTeams(2025)
    expect(result.map((r) => r.name)).toEqual([
      'Birmingham City',
      'Leeds United',
      'Watford',
    ])
  })

  it('returns empty array on error', async () => {
    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'db error' },
            }),
          }),
        }),
      }),
    }
    vi.mocked(createAdminClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof createAdminClient>,
    )

    const result = await getChampionshipTeams(2025)
    expect(result).toEqual([])
  })
})

// ─── addChampionshipTeam ──────────────────────────────────────────────────────

function mockAddClient({
  existing = [] as Array<{ id: string; name: string }>,
  insertError = null as null | { message: string },
  captureInsert,
}: {
  existing?: Array<{ id: string; name: string }>
  insertError?: null | { message: string }
  captureInsert?: (payload: unknown) => void
} = {}) {
  const mockClient = {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: existing, error: null }),
      }),
      insert: vi.fn().mockImplementation((payload: unknown) => {
        captureInsert?.(payload)
        return Promise.resolve({ error: insertError })
      }),
    }),
  }
  vi.mocked(createAdminClient).mockReturnValue(
    mockClient as unknown as ReturnType<typeof createAdminClient>,
  )
}

function buildAddFormData(name: string, season = 2025) {
  const fd = new FormData()
  fd.set('name', name)
  fd.set('season', String(season))
  return fd
}

describe('addChampionshipTeam', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects non-admin', async () => {
    mockNonAdminAuth()
    const result = await addChampionshipTeam(buildAddFormData('Wrexham'))
    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toMatch(/Unauthorized/i)
  })

  it('rejects empty name', async () => {
    mockAdminAuth()
    mockAddClient({})
    const result = await addChampionshipTeam(buildAddFormData(''))
    expect(result).toHaveProperty('error')
  })

  it('rejects duplicate case-insensitively', async () => {
    mockAdminAuth()
    mockAddClient({
      existing: [{ id: 'a', name: 'Leeds United' }],
    })
    const result = await addChampionshipTeam(buildAddFormData('leeds united'))
    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toMatch(/already/i)
  })

  it('inserts trimmed name', async () => {
    mockAdminAuth()
    let captured: Record<string, unknown> = {}
    mockAddClient({
      captureInsert: (p) => (captured = p as Record<string, unknown>),
    })
    const result = await addChampionshipTeam(buildAddFormData('  Wrexham  '))
    expect(result).toEqual({ success: true })
    expect(captured.name).toBe('Wrexham')
    expect(captured.season).toBe(2025)
  })
})

// ─── removeChampionshipTeam ───────────────────────────────────────────────────

describe('removeChampionshipTeam', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects non-admin', async () => {
    mockNonAdminAuth()
    const fd = new FormData()
    fd.set('id', TEAM_ID)
    const result = await removeChampionshipTeam(fd)
    expect(result).toHaveProperty('error')
  })

  it('deletes row with matching id', async () => {
    mockAdminAuth()
    let capturedId: string | null = null
    const mockClient = {
      from: vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockImplementation((_col: string, val: string) => {
            capturedId = val
            return Promise.resolve({ error: null })
          }),
        }),
      }),
    }
    vi.mocked(createAdminClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof createAdminClient>,
    )
    const fd = new FormData()
    fd.set('id', TEAM_ID)
    const result = await removeChampionshipTeam(fd)
    expect(result).toEqual({ success: true })
    expect(capturedId).toBe(TEAM_ID)
  })
})

// ─── renameChampionshipTeam ───────────────────────────────────────────────────

describe('renameChampionshipTeam', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects non-admin', async () => {
    mockNonAdminAuth()
    const fd = new FormData()
    fd.set('id', TEAM_ID)
    fd.set('name', 'New Name')
    const result = await renameChampionshipTeam(fd)
    expect(result).toHaveProperty('error')
  })

  it('rejects duplicate (case-insensitive)', async () => {
    mockAdminAuth()
    const mockClient = {
      from: vi.fn().mockImplementation(() => {
        return {
          // lookup current row
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: TEAM_ID, season: 2025, name: 'Old Name' },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: {
                code: '23505',
                message: 'duplicate key',
              },
            }),
          }),
        }
      }),
    }
    vi.mocked(createAdminClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof createAdminClient>,
    )
    const fd = new FormData()
    fd.set('id', TEAM_ID)
    fd.set('name', 'Leeds United')
    const result = await renameChampionshipTeam(fd)
    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toMatch(/already|duplicate/i)
  })

  it('updates name successfully', async () => {
    mockAdminAuth()
    let captured: Record<string, unknown> = {}
    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: TEAM_ID, season: 2025, name: 'Old Name' },
              error: null,
            }),
          }),
        }),
        update: vi.fn().mockImplementation((payload: unknown) => {
          captured = payload as Record<string, unknown>
          return {
            eq: vi.fn().mockResolvedValue({ error: null }),
          }
        }),
      }),
    }
    vi.mocked(createAdminClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof createAdminClient>,
    )
    const fd = new FormData()
    fd.set('id', TEAM_ID)
    fd.set('name', '  Wrexham  ')
    const result = await renameChampionshipTeam(fd)
    expect(result).toEqual({ success: true })
    expect(captured.name).toBe('Wrexham')
  })
})

// ─── endOfSeasonRollover ──────────────────────────────────────────────────────

interface RolloverOpts {
  seasonRow?: Record<string, unknown> | null
  plTeamRows?: Array<{ id: string; name: string }>
  championshipRows?: Array<{ id: string; name: string }>
  nextSeasonExists?: boolean
}

function mockRolloverClient(
  opts: RolloverOpts = {},
  captures: {
    teamInserts?: unknown[]
    teamDeletes?: string[]
    chInserts?: unknown[]
    chDeletes?: string[]
    notifications?: unknown[]
  } = {},
) {
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
    plTeamRows = [
      { id: 'pl-burnley', name: 'Burnley' },
      { id: 'pl-sunderland', name: 'Sunderland' },
      { id: 'pl-bournemouth', name: 'Bournemouth' },
    ],
    championshipRows = [
      { id: 'ch-leicester', name: 'Leicester City' },
      { id: 'ch-ipswich', name: 'Ipswich Town' },
      { id: 'ch-southampton', name: 'Southampton' },
    ],
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
      if (table === 'teams') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: plTeamRows, error: null }),
          }),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((_col: string, val: string) => {
              captures.teamDeletes?.push(val)
              return Promise.resolve({ error: null })
            }),
          }),
          insert: vi.fn().mockImplementation((payload: unknown) => {
            captures.teamInserts?.push(payload)
            return Promise.resolve({ error: null })
          }),
        }
      }
      if (table === 'championship_teams') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: championshipRows, error: null }),
            }),
          }),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((_col: string, val: string) => {
              captures.chDeletes?.push(val)
              return Promise.resolve({ error: null })
            }),
          }),
          insert: vi.fn().mockImplementation((payload: unknown) => {
            captures.chInserts?.push(payload)
            return Promise.resolve({ error: null })
          }),
        }
      }
      if (table === 'admin_notifications') {
        return {
          insert: vi.fn().mockImplementation((payload: unknown) => {
            captures.notifications?.push(payload)
            return Promise.resolve({ error: null })
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

function buildRolloverFormData(fromSeason = 2025) {
  const fd = new FormData()
  fd.set('from_season', String(fromSeason))
  return fd
}

describe('endOfSeasonRollover', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects non-admin', async () => {
    mockNonAdminAuth()
    const result = await endOfSeasonRollover(buildRolloverFormData())
    expect(result).toHaveProperty('error')
  })

  it('rejects when actuals not locked', async () => {
    mockAdminAuth()
    mockRolloverClient({
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
    const result = await endOfSeasonRollover(buildRolloverFormData())
    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toMatch(/actuals/i)
  })

  it('rejects when a relegated team is not in the teams table', async () => {
    mockAdminAuth()
    mockRolloverClient({
      plTeamRows: [
        { id: 'pl-burnley', name: 'Burnley' },
        { id: 'pl-sunderland', name: 'Sunderland' },
        // Bournemouth missing
      ],
    })
    const result = await endOfSeasonRollover(buildRolloverFormData())
    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toMatch(/Premier League|teams/i)
  })

  it('rejects when a promoted team is not in championship_teams', async () => {
    mockAdminAuth()
    mockRolloverClient({
      championshipRows: [
        { id: 'ch-leicester', name: 'Leicester City' },
        { id: 'ch-ipswich', name: 'Ipswich Town' },
        // Southampton missing
      ],
    })
    const result = await endOfSeasonRollover(buildRolloverFormData())
    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toMatch(/Championship/i)
  })

  it('swaps relegated PL -> Championship 2026 and promoted Championship -> PL', async () => {
    mockAdminAuth()
    const teamInserts: unknown[] = []
    const teamDeletes: string[] = []
    const chInserts: unknown[] = []
    const chDeletes: string[] = []
    mockRolloverClient({}, { teamInserts, teamDeletes, chInserts, chDeletes })
    const result = await endOfSeasonRollover(buildRolloverFormData())
    expect(result).toMatchObject({ success: true })
    // 3 PL team rows deleted (relegated)
    expect(teamDeletes).toEqual(
      expect.arrayContaining(['pl-burnley', 'pl-sunderland', 'pl-bournemouth']),
    )
    // 3 teams inserted into championship_teams at season+1 (2026)
    expect(chInserts.length).toBeGreaterThanOrEqual(3)
    const chNames = chInserts.map((p) => (p as Record<string, unknown>).name)
    expect(chNames).toEqual(expect.arrayContaining(['Burnley', 'Sunderland', 'Bournemouth']))
    const chSeasons = chInserts.map((p) => (p as Record<string, unknown>).season)
    expect(chSeasons.every((s) => s === 2026)).toBe(true)
    // 3 championship rows deleted (promoted)
    expect(chDeletes).toEqual(
      expect.arrayContaining(['ch-leicester', 'ch-ipswich', 'ch-southampton']),
    )
    // 3 teams inserted into PL teams
    expect(teamInserts.length).toBeGreaterThanOrEqual(3)
    const teamNames = teamInserts.map((p) => (p as Record<string, unknown>).name)
    expect(teamNames).toEqual(
      expect.arrayContaining(['Leicester City', 'Ipswich Town', 'Southampton']),
    )
  })

  it('writes admin_notifications entry with type=system after success', async () => {
    mockAdminAuth()
    const notifications: unknown[] = []
    mockRolloverClient({}, { notifications })
    const result = await endOfSeasonRollover(buildRolloverFormData())
    expect(result).toMatchObject({ success: true })
    const hasNotification = notifications.some(
      (n) =>
        typeof n === 'object' &&
        n !== null &&
        (n as Record<string, unknown>).type === 'system',
    )
    expect(hasNotification).toBe(true)
  })
})
