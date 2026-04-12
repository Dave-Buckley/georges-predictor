/**
 * Tests for member pre-season server action (Phase 9 Plan 02).
 *
 * Covers submitPreSeasonPicks:
 * - Unauthenticated rejection
 * - Lockout enforcement (gw1_kickoff <= now())
 * - Member profile resolution from auth.uid()
 * - Source-list validation (PL vs Championship)
 * - Duplicate detection (within & across categories)
 * - Happy-path upsert with submitted_by_admin=false
 * - Idempotent resubmit
 *
 * Mock shape mirrors tests/actions/admin/los.test.ts (vi.mock + createMockSupabaseClient).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabaseClient } from '../setup'

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

// Mock seasons helpers — control upcoming window per test
const mockGetUpcomingSeason = vi.fn()
vi.mock('@/lib/pre-season/seasons', () => ({
  getUpcomingSeason: (...args: unknown[]) => mockGetUpcomingSeason(...args),
  getCurrentSeason: vi.fn(),
}))

import { createAdminClient } from '@/lib/supabase/admin'
import { submitPreSeasonPicks } from '@/actions/pre-season'

// ─── Constants ────────────────────────────────────────────────────────────────

const USER_ID = '11111111-1111-4111-8111-111111111111'
const MEMBER_ID = '22222222-2222-4222-8222-222222222222'

// PL teams list used by mock
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
  'Leeds United', // also in Championship list — but for PL tests assume in teams table
]

// Championship list used by DB-backed isChampionshipTeam helper mock
const CHAMPIONSHIP_TEAMS = [
  'Birmingham City',
  'Blackburn Rovers',
  'Bristol City',
  'Charlton Athletic',
  'Coventry City',
  'Derby County',
  'Hull City',
  'Ipswich Town',
  'Leeds United',
  'Leicester City',
  'Middlesbrough',
  'Millwall',
  'Norwich City',
  'Oxford United',
  'Portsmouth',
  'Preston North End',
  'Queens Park Rangers',
  'Sheffield United',
  'Sheffield Wednesday',
  'Southampton',
  'Stoke City',
  'Swansea City',
  'Watford',
  'West Bromwich Albion',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockAuthenticated() {
  mockServerClient.auth.getUser = vi.fn().mockResolvedValue({
    data: { user: { id: USER_ID, app_metadata: {} } },
    error: null,
  })
}

function mockUnauthenticated() {
  mockServerClient.auth.getUser = vi.fn().mockResolvedValue({
    data: { user: null },
    error: null,
  })
}

function mockUpcomingSeason(gw1KickoffIso: string, season = 2026) {
  mockGetUpcomingSeason.mockResolvedValue({
    id: 1,
    season,
    label: '2026-27',
    gw1_kickoff: gw1KickoffIso,
    final_top4: [],
    final_tenth: null,
    final_relegated: [],
    final_promoted: [],
    final_playoff_winner: null,
  })
}

function mockAdminFor({
  member = { id: MEMBER_ID } as { id: string } | null,
  plTeams = PL_TEAMS,
  championshipTeams = CHAMPIONSHIP_TEAMS,
  upsertError = null as null | { message: string },
  captureUpsert,
}: {
  member?: { id: string } | null
  plTeams?: string[]
  championshipTeams?: string[]
  upsertError?: null | { message: string }
  captureUpsert?: (payload: unknown) => void
}) {
  const mockClient = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'members') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: member, error: null }),
            }),
          }),
        }
      }
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
      if (table === 'championship_teams') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: championshipTeams.map((name) => ({ name })),
              error: null,
            }),
          }),
        }
      }
      if (table === 'pre_season_picks') {
        return {
          upsert: vi.fn().mockImplementation((payload: unknown) => {
            captureUpsert?.(payload)
            return Promise.resolve({ error: upsertError })
          }),
        }
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() }
    }),
  }
  vi.mocked(createAdminClient).mockReturnValue(
    mockClient as unknown as ReturnType<typeof createAdminClient>,
  )
}

function buildValidPayload(overrides: Record<string, unknown> = {}) {
  return {
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

const FUTURE_KICKOFF = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
const PAST_KICKOFF = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('submitPreSeasonPicks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthenticated call with Unauthorized', async () => {
    mockUnauthenticated()
    const result = await submitPreSeasonPicks(buildFormData(buildValidPayload()))
    expect(result).toEqual({ error: 'Unauthorized' })
  })

  it('rejects invalid payload (non-string)', async () => {
    mockAuthenticated()
    const fd = new FormData()
    const result = await submitPreSeasonPicks(fd)
    expect(result).toHaveProperty('error')
  })

  it('rejects invalid JSON', async () => {
    mockAuthenticated()
    const fd = new FormData()
    fd.set('payload', 'not-json{{{')
    const result = await submitPreSeasonPicks(fd)
    expect(result).toHaveProperty('error')
  })

  it('rejects when no upcoming season exists', async () => {
    mockAuthenticated()
    mockGetUpcomingSeason.mockResolvedValue(null)
    const result = await submitPreSeasonPicks(buildFormData(buildValidPayload()))
    expect(result).toMatchObject({ error: expect.stringMatching(/upcoming|window/i) })
  })

  it('rejects when gw1_kickoff <= now() (locked)', async () => {
    mockAuthenticated()
    mockUpcomingSeason(PAST_KICKOFF)
    const result = await submitPreSeasonPicks(buildFormData(buildValidPayload()))
    expect(result).toMatchObject({ error: expect.stringMatching(/locked/i) })
  })

  it('rejects when member row not found', async () => {
    mockAuthenticated()
    mockUpcomingSeason(FUTURE_KICKOFF)
    mockAdminFor({ member: null })
    const result = await submitPreSeasonPicks(buildFormData(buildValidPayload()))
    expect(result).toMatchObject({ error: expect.stringMatching(/member/i) })
  })

  it('rejects when promoted pick is a PL team (not Championship)', async () => {
    mockAuthenticated()
    mockUpcomingSeason(FUTURE_KICKOFF)
    mockAdminFor({})
    const payload = buildValidPayload({
      promoted: ['Arsenal', 'Ipswich Town', 'Southampton'], // Arsenal is PL
    })
    const result = await submitPreSeasonPicks(buildFormData(payload))
    expect(result).toMatchObject({ error: expect.stringMatching(/Championship/i) })
  })

  it('rejects when top4 pick is a Championship team (not PL)', async () => {
    mockAuthenticated()
    mockUpcomingSeason(FUTURE_KICKOFF)
    // Exclude Leeds from PL list for this test
    mockAdminFor({ plTeams: PL_TEAMS.filter((t) => t !== 'Leeds United') })
    const payload = buildValidPayload({
      top4: ['Leeds United', 'Liverpool', 'Manchester City', 'Chelsea'],
    })
    const result = await submitPreSeasonPicks(buildFormData(payload))
    expect(result).toMatchObject({ error: expect.stringMatching(/Premier League/i) })
  })

  it('rejects when playoff_winner is not in Championship list', async () => {
    mockAuthenticated()
    mockUpcomingSeason(FUTURE_KICKOFF)
    mockAdminFor({})
    const payload = buildValidPayload({
      promoted_playoff_winner: 'Arsenal', // PL team
    })
    const result = await submitPreSeasonPicks(buildFormData(payload))
    expect(result).toMatchObject({ error: expect.stringMatching(/Championship/i) })
  })

  it('rejects when top4 contains duplicates', async () => {
    mockAuthenticated()
    mockUpcomingSeason(FUTURE_KICKOFF)
    mockAdminFor({})
    const payload = buildValidPayload({
      top4: ['Arsenal', 'Arsenal', 'Manchester City', 'Chelsea'],
    })
    const result = await submitPreSeasonPicks(buildFormData(payload))
    expect(result).toMatchObject({ error: expect.stringMatching(/[Dd]uplicate/i) })
  })

  it('rejects when relegated contains duplicates', async () => {
    mockAuthenticated()
    mockUpcomingSeason(FUTURE_KICKOFF)
    mockAdminFor({})
    const payload = buildValidPayload({
      relegated: ['Burnley', 'Burnley', 'Bournemouth'],
    })
    const result = await submitPreSeasonPicks(buildFormData(payload))
    expect(result).toMatchObject({ error: expect.stringMatching(/[Dd]uplicate/i) })
  })

  it('rejects when promoted contains duplicates', async () => {
    mockAuthenticated()
    mockUpcomingSeason(FUTURE_KICKOFF)
    mockAdminFor({})
    const payload = buildValidPayload({
      promoted: ['Leicester City', 'Leicester City', 'Southampton'],
    })
    const result = await submitPreSeasonPicks(buildFormData(payload))
    expect(result).toMatchObject({ error: expect.stringMatching(/[Dd]uplicate/i) })
  })

  it('rejects a team appearing in both top4 AND relegated', async () => {
    mockAuthenticated()
    mockUpcomingSeason(FUTURE_KICKOFF)
    mockAdminFor({})
    const payload = buildValidPayload({
      top4: ['Arsenal', 'Liverpool', 'Manchester City', 'Chelsea'],
      relegated: ['Arsenal', 'Sunderland', 'Bournemouth'],
    })
    const result = await submitPreSeasonPicks(buildFormData(payload))
    expect(result).toMatchObject({ error: expect.stringMatching(/top 4|relegated/i) })
  })

  it('happy path: upserts picks with member_id from auth.uid(), submitted_by_admin=false', async () => {
    mockAuthenticated()
    mockUpcomingSeason(FUTURE_KICKOFF)
    let captured: unknown = null
    mockAdminFor({ captureUpsert: (p) => (captured = p) })

    const result = await submitPreSeasonPicks(buildFormData(buildValidPayload()))
    expect(result).toEqual({ success: true })
    expect(captured).toMatchObject({
      member_id: MEMBER_ID,
      season: 2026,
      top4: ['Arsenal', 'Liverpool', 'Manchester City', 'Chelsea'],
      tenth_place: 'Fulham',
      relegated: ['Burnley', 'Sunderland', 'Bournemouth'],
      promoted: ['Leicester City', 'Ipswich Town', 'Southampton'],
      promoted_playoff_winner: 'Norwich City',
      submitted_by_admin: false,
    })
    expect((captured as { submitted_at?: string }).submitted_at).toBeTruthy()
  })

  it('returns { error } shape when upsert fails', async () => {
    mockAuthenticated()
    mockUpcomingSeason(FUTURE_KICKOFF)
    mockAdminFor({ upsertError: { message: 'database bang' } })

    const result = await submitPreSeasonPicks(buildFormData(buildValidPayload()))
    expect(result).toMatchObject({ error: 'database bang' })
  })

  it('resubmit: upsert with onConflict member_id,season overwrites prior row', async () => {
    mockAuthenticated()
    mockUpcomingSeason(FUTURE_KICKOFF)
    let conflictOpt: unknown = null
    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: MEMBER_ID }, error: null }),
              }),
            }),
          }
        }
        if (table === 'teams') {
          return {
            select: vi
              .fn()
              .mockResolvedValue({ data: PL_TEAMS.map((name) => ({ name })), error: null }),
          }
        }
        if (table === 'championship_teams') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: CHAMPIONSHIP_TEAMS.map((name) => ({ name })),
                error: null,
              }),
            }),
          }
        }
        if (table === 'pre_season_picks') {
          return {
            upsert: vi.fn().mockImplementation((_p: unknown, opts: unknown) => {
              conflictOpt = opts
              return Promise.resolve({ error: null })
            }),
          }
        }
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() }
      }),
    }
    vi.mocked(createAdminClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof createAdminClient>,
    )

    const result = await submitPreSeasonPicks(buildFormData(buildValidPayload()))
    expect(result).toEqual({ success: true })
    expect(conflictOpt).toMatchObject({ onConflict: 'member_id,season' })
  })
})
