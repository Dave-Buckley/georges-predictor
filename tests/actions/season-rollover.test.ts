/**
 * Tests for Phase 11 Plan 04 season-rollover server actions.
 *
 * Covers 6 idempotent actions:
 *   - getArchiveReadiness: aggregation-only, no mutation
 *   - archiveSeason: UPDATE seasons SET ended_at (idempotent via IS NULL guard)
 *   - defineNewSeason: UPSERT seasons by season
 *   - carryForwardChampionshipTeams: clone rows with ON CONFLICT DO NOTHING
 *   - carryForwardMembers: UPDATE starting_points=0 WHERE approval_status='approved' AND user_id IS NOT NULL
 *   - launchNewSeason: flip admin_settings flag + emit admin_notification
 *
 * Mock shape mirrors tests/actions/admin/championship.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabaseClient } from '../setup'

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
import { revalidatePath } from 'next/cache'
import {
  getArchiveReadiness,
  archiveSeason,
  defineNewSeason,
  carryForwardChampionshipTeams,
  carryForwardMembers,
  launchNewSeason,
} from '@/actions/admin/season-rollover'

const ADMIN_USER_ID = '33333333-3333-4333-8333-333333333333'

function mockAdminAuth() {
  mockServerClient.auth.getUser = vi.fn().mockResolvedValue({
    data: { user: { id: ADMIN_USER_ID, app_metadata: { role: 'admin' } } },
    error: null,
  })
}

function mockNonAdminAuth() {
  mockServerClient.auth.getUser = vi.fn().mockResolvedValue({
    data: { user: { id: 'm', app_metadata: { role: 'member' } } },
    error: null,
  })
}

function fd(entries: Record<string, string | number>): FormData {
  const form = new FormData()
  for (const [k, v] of Object.entries(entries)) form.set(k, String(v))
  return form
}

// ─── getArchiveReadiness ──────────────────────────────────────────────────────

describe('getArchiveReadiness', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects non-admin', async () => {
    mockNonAdminAuth()
    const result = await getArchiveReadiness(2025)
    expect(result).toMatchObject({ error: expect.stringMatching(/unauthori[sz]ed/i) })
  })

  it('returns readyToArchive=true when all preconditions pass', async () => {
    mockAdminAuth()
    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'gameweeks') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                neq: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }
        }
        if (table === 'pre_season_awards') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }
        }
        if (table === 'los_competitions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }
        }
        return { select: vi.fn().mockReturnThis() }
      }),
    }
    vi.mocked(createAdminClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof createAdminClient>,
    )

    const result = await getArchiveReadiness(2025)
    expect(result).toMatchObject({
      allGwsClosed: true,
      preSeasonConfirmed: true,
      losResolved: true,
      readyToArchive: true,
    })
  })

  it('returns readyToArchive=false when a gameweek still open', async () => {
    mockAdminAuth()
    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'gameweeks') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                neq: vi
                  .fn()
                  .mockResolvedValue({ data: [{ id: 'gw1' }], error: null }),
              }),
            }),
          }
        }
        if (table === 'pre_season_awards') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }
        }
        if (table === 'los_competitions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }
        }
        return { select: vi.fn().mockReturnThis() }
      }),
    }
    vi.mocked(createAdminClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof createAdminClient>,
    )

    const result = await getArchiveReadiness(2025)
    expect(result).toMatchObject({
      allGwsClosed: false,
      readyToArchive: false,
    })
  })
})

// ─── archiveSeason ────────────────────────────────────────────────────────────

describe('archiveSeason', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects non-admin', async () => {
    mockNonAdminAuth()
    const result = await archiveSeason(fd({ season: 2025 }))
    expect(result).toMatchObject({ error: expect.stringMatching(/unauthori[sz]ed/i) })
  })

  it('rejects invalid season input', async () => {
    mockAdminAuth()
    const result = await archiveSeason(fd({ season: 'not-a-number' }))
    expect(result).toMatchObject({ error: expect.stringMatching(/invalid/i) })
  })

  it('updates seasons.ended_at with IS NULL guard (idempotent)', async () => {
    mockAdminAuth()
    let capturedUpdate: Record<string, unknown> | null = null
    let capturedIsCheck: [string, unknown] | null = null

    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'seasons') {
          return {
            update: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
              capturedUpdate = payload
              return {
                eq: vi.fn().mockReturnValue({
                  is: vi.fn().mockImplementation((col: string, val: unknown) => {
                    capturedIsCheck = [col, val]
                    return Promise.resolve({ error: null })
                  }),
                }),
              }
            }),
          }
        }
        if (table === 'admin_notifications') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) }
        }
        return { select: vi.fn().mockReturnThis() }
      }),
    }
    vi.mocked(createAdminClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof createAdminClient>,
    )

    const result = await archiveSeason(fd({ season: 2025 }))
    expect(result).toMatchObject({ ok: true })
    expect(capturedUpdate).toHaveProperty('ended_at')
    // Idempotency guard: only update when ended_at IS NULL
    expect(capturedIsCheck).toEqual(['ended_at', null])
  })

  it('calls revalidatePath for /, /standings, /admin, /admin/season-rollover', async () => {
    mockAdminAuth()
    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'seasons') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({ error: null }),
              }),
            }),
          }
        }
        if (table === 'admin_notifications') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) }
        }
        return { select: vi.fn().mockReturnThis() }
      }),
    }
    vi.mocked(createAdminClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof createAdminClient>,
    )

    await archiveSeason(fd({ season: 2025 }))
    const calls = (revalidatePath as unknown as { mock: { calls: unknown[][] } }).mock.calls.map(
      (c) => c[0] as string,
    )
    expect(calls).toEqual(
      expect.arrayContaining(['/admin', '/admin/season-rollover', '/', '/standings']),
    )
  })

  it('emits admin_notifications row with type=season_archived', async () => {
    mockAdminAuth()
    let capturedNotif: Record<string, unknown> | null = null
    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'seasons') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({ error: null }),
              }),
            }),
          }
        }
        if (table === 'admin_notifications') {
          return {
            insert: vi.fn().mockImplementation((row: Record<string, unknown>) => {
              capturedNotif = row
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

    await archiveSeason(fd({ season: 2025 }))
    expect(capturedNotif).toMatchObject({ type: 'season_archived' })
  })
})

// ─── defineNewSeason ──────────────────────────────────────────────────────────

describe('defineNewSeason', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects non-admin', async () => {
    mockNonAdminAuth()
    const result = await defineNewSeason(
      fd({ season: 2026, gw1_kickoff: '2026-08-15T15:00:00Z' }),
    )
    expect(result).toMatchObject({ error: expect.stringMatching(/unauthori[sz]ed/i) })
  })

  it('rejects invalid inputs', async () => {
    mockAdminAuth()
    const result = await defineNewSeason(fd({ season: 'nope', gw1_kickoff: '' }))
    expect(result).toMatchObject({ error: expect.stringMatching(/invalid/i) })
  })

  it('upserts seasons row on (season) conflict (idempotent)', async () => {
    mockAdminAuth()
    let capturedUpsert: Record<string, unknown> | null = null
    let capturedOpts: Record<string, unknown> | null = null
    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'seasons') {
          return {
            upsert: vi
              .fn()
              .mockImplementation((row: Record<string, unknown>, opts: Record<string, unknown>) => {
                capturedUpsert = row
                capturedOpts = opts
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

    const result = await defineNewSeason(
      fd({ season: 2026, gw1_kickoff: '2026-08-15T15:00:00Z' }),
    )
    expect(result).toMatchObject({ ok: true })
    expect(capturedUpsert).toMatchObject({ season: 2026, gw1_kickoff: '2026-08-15T15:00:00Z' })
    expect((capturedOpts as Record<string, unknown>)?.onConflict).toBe('season')
  })
})

// ─── carryForwardChampionshipTeams ────────────────────────────────────────────

describe('carryForwardChampionshipTeams', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects non-admin', async () => {
    mockNonAdminAuth()
    const result = await carryForwardChampionshipTeams(
      fd({ from_season: 2025, to_season: 2026 }),
    )
    expect(result).toMatchObject({ error: expect.stringMatching(/unauthori[sz]ed/i) })
  })

  it('clones rows from fromSeason to toSeason', async () => {
    mockAdminAuth()
    const source = [
      { id: 'a', name: 'Leeds United', season: 2025 },
      { id: 'b', name: 'Watford', season: 2025 },
    ]
    let capturedInsert: unknown = null
    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'championship_teams') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: source, error: null }),
            }),
            upsert: vi.fn().mockImplementation((rows: unknown) => {
              capturedInsert = rows
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

    const result = await carryForwardChampionshipTeams(
      fd({ from_season: 2025, to_season: 2026 }),
    )
    expect(result).toMatchObject({ ok: true })
    expect(capturedInsert).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Leeds United', season: 2026 }),
        expect.objectContaining({ name: 'Watford', season: 2026 }),
      ]),
    )
  })
})

// ─── carryForwardMembers ──────────────────────────────────────────────────────

describe('carryForwardMembers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects non-admin', async () => {
    mockNonAdminAuth()
    const result = await carryForwardMembers(new FormData())
    expect(result).toMatchObject({ error: expect.stringMatching(/unauthori[sz]ed/i) })
  })

  it('UPDATEs starting_points=0 WHERE approval_status=approved AND user_id IS NOT NULL (Pitfall 6 guard)', async () => {
    mockAdminAuth()
    let capturedUpdate: Record<string, unknown> | null = null
    const eqCalls: Array<[string, unknown]> = []
    let notCall: [string, string, unknown] | null = null

    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'members') {
          // Final chain terminator returns success — our mock captures each eq call.
          const chain = {
            update: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
              capturedUpdate = payload
              return chainAfterUpdate
            }),
          }
          // eslint-disable-next-line prefer-const
          let chainAfterUpdate: {
            eq: (col: string, val: unknown) => typeof chainAfterUpdate
            not: (col: string, op: string, val: unknown) => Promise<{ error: null }> & {
              select?: unknown
            }
          }
          chainAfterUpdate = {
            eq(col, val) {
              eqCalls.push([col, val])
              return chainAfterUpdate
            },
            not(col, op, val) {
              notCall = [col, op, val]
              // Return a thenable resolving to success — also mock select() if upstream uses it
              return Promise.resolve({ error: null }) as unknown as Promise<{ error: null }> & {
                select?: unknown
              }
            },
          }
          return chain
        }
        return { select: vi.fn().mockReturnThis() }
      }),
    }
    vi.mocked(createAdminClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof createAdminClient>,
    )

    const result = await carryForwardMembers(new FormData())
    expect(result).toMatchObject({ ok: true })
    expect(capturedUpdate).toEqual({ starting_points: 0 })
    // Must filter on approval_status='approved'
    expect(eqCalls).toContainEqual(['approval_status', 'approved'])
    // Must guard via NOT NULL on user_id (does not touch unclaimed imports)
    expect(notCall).toEqual(['user_id', 'is', null])
  })
})

// ─── launchNewSeason ──────────────────────────────────────────────────────────

describe('launchNewSeason', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects non-admin', async () => {
    mockNonAdminAuth()
    const result = await launchNewSeason(fd({ season: 2026 }))
    expect(result).toMatchObject({ error: expect.stringMatching(/unauthori[sz]ed/i) })
  })

  it('writes admin_notifications row type=season_launched + revalidates paths', async () => {
    mockAdminAuth()
    let capturedNotif: Record<string, unknown> | null = null
    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'admin_notifications') {
          return {
            insert: vi.fn().mockImplementation((row: Record<string, unknown>) => {
              capturedNotif = row
              return Promise.resolve({ error: null })
            }),
          }
        }
        if (table === 'seasons') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }
        }
        return { select: vi.fn().mockReturnThis() }
      }),
    }
    vi.mocked(createAdminClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof createAdminClient>,
    )

    const result = await launchNewSeason(fd({ season: 2026 }))
    expect(result).toMatchObject({ ok: true })
    expect(capturedNotif).toMatchObject({ type: 'season_launched' })
    const calls = (revalidatePath as unknown as { mock: { calls: unknown[][] } }).mock.calls.map(
      (c) => c[0] as string,
    )
    expect(calls).toEqual(
      expect.arrayContaining(['/admin', '/', '/standings', '/dashboard']),
    )
  })
})

// ─── Idempotency smoke ────────────────────────────────────────────────────────

describe('idempotency', () => {
  beforeEach(() => vi.clearAllMocks())

  it('archiveSeason: running twice yields ok both times (DB no-op on 2nd via IS NULL guard)', async () => {
    mockAdminAuth()
    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'seasons') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({ error: null }),
              }),
            }),
          }
        }
        if (table === 'admin_notifications') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) }
        }
        return { select: vi.fn().mockReturnThis() }
      }),
    }
    vi.mocked(createAdminClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof createAdminClient>,
    )

    const r1 = await archiveSeason(fd({ season: 2025 }))
    const r2 = await archiveSeason(fd({ season: 2025 }))
    expect(r1).toMatchObject({ ok: true })
    expect(r2).toMatchObject({ ok: true })
  })
})
