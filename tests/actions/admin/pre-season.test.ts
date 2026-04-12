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
import { setPreSeasonPicksForMember } from '@/actions/admin/pre-season'

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
