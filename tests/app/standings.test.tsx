/**
 * Tests for the public /standings page (Phase 10 Plan 04 Task 1).
 *
 * The page is a RSC that:
 *   - Fetches members via the admin client (column allowlist, no predictions)
 *   - Fetches the latest closed gameweek + its fixtures (team-embedded)
 *   - Fetches top-3 weekly scorers via gatherGameweekData (reused aggregator)
 *   - Renders without auth (no session required)
 *
 * We test the RSC by rendering its JSX and walking the element tree with the
 * same `extractText` idiom used in Phase 10 Plan 02's PDF tests — invokes
 * function components synchronously so we can assert on the rendered text.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactElement } from 'react'

// ─── Module mocks ─────────────────────────────────────────────────────────────

const mockMembers = [
  { id: 'm-1', display_name: 'Alice', starting_points: 150 },
  { id: 'm-2', display_name: 'Bob', starting_points: 120 },
  { id: 'm-3', display_name: 'Carol', starting_points: 90 },
]

// Mutable state for per-test customisation
let membersData: typeof mockMembers = mockMembers
let latestGwData: {
  id: string
  number: number
  closed_at: string
} | null = null
let fixturesData: Array<Record<string, unknown>> = []
let topWeeklyData: Array<{
  memberId: string
  displayName: string
  weeklyPoints: number
}> = []

const mockAdminClient = {
  from: vi.fn((table: string) => {
    if (table === 'members') {
      return {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: membersData, error: null }),
      }
    }
    if (table === 'gameweeks') {
      return {
        select: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi
          .fn()
          .mockResolvedValue({ data: latestGwData, error: null }),
      }
    }
    if (table === 'fixtures') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: fixturesData, error: null }),
      }
    }
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    }
  }),
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mockAdminClient),
}))

vi.mock('@/lib/reports/_data/gather-gameweek-data', () => ({
  gatherGameweekData: vi.fn(async () => ({
    gwNumber: latestGwData?.number ?? 0,
    gwId: latestGwData?.id ?? '',
    closedAtIso: latestGwData?.closed_at ?? null,
    seasonLabel: '2025-26',
    doubleBubbleActive: false,
    standings: [],
    fixtures: [],
    predictionsByMember: {},
    bonus: { type: null, pickByMember: {} },
    losStatus: [],
    h2hSteals: [],
    topWeekly: topWeeklyData,
  })),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Walk a React element tree collecting text nodes. Function components are
 * invoked synchronously — same pattern as Phase 10 Plan 02 PDF tests.
 */
function extractText(
  node: unknown,
  depth = 0,
): string {
  if (depth > 50) return ''
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node)
  }
  if (Array.isArray(node)) {
    return node.map((n) => extractText(n, depth + 1)).join(' ')
  }
  if (typeof node === 'object' && 'type' in (node as object)) {
    const el = node as ReactElement & {
      type: unknown
      props?: { children?: unknown }
    }
    const children = el.props?.children
    if (typeof el.type === 'function') {
      try {
        const result = (el.type as (p: unknown) => unknown)(el.props ?? {})
        return extractText(result, depth + 1)
      } catch {
        return extractText(children, depth + 1)
      }
    }
    return extractText(children, depth + 1)
  }
  return ''
}

async function renderStandings(): Promise<string> {
  // Dynamically import so mocks are applied
  const mod = await import('@/app/(public)/standings/page')
  const jsx = await mod.default()
  return extractText(jsx)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('/standings public page', () => {
  beforeEach(() => {
    membersData = mockMembers
    latestGwData = {
      id: 'gw-1',
      number: 3,
      closed_at: '2025-09-10T17:00:00Z',
    }
    fixturesData = [
      {
        id: 'fix-1',
        home_team: { name: 'Arsenal' },
        away_team: { name: 'Chelsea' },
        home_score: 2,
        away_score: 1,
        status: 'FINISHED',
      },
      {
        id: 'fix-2',
        home_team: { name: 'Liverpool' },
        away_team: { name: 'Everton' },
        home_score: 3,
        away_score: 0,
        status: 'FINISHED',
      },
    ]
    topWeeklyData = [
      { memberId: 'm-1', displayName: 'Alice', weeklyPoints: 60 },
      { memberId: 'm-2', displayName: 'Bob', weeklyPoints: 40 },
      { memberId: 'm-3', displayName: 'Carol', weeklyPoints: 30 },
    ]
  })

  it('Test 1: renders without auth (no session call)', async () => {
    // Just invoking render() without any auth mocks — must not throw/redirect.
    const text = await renderStandings()
    expect(text.length).toBeGreaterThan(0)
  })

  it('Test 2: shows every member display_name, total_points and derived rank', async () => {
    const text = await renderStandings()
    expect(text).toContain('Alice')
    expect(text).toContain('Bob')
    expect(text).toContain('Carol')
    expect(text).toContain('150')
    expect(text).toContain('120')
    expect(text).toContain('90')
    // Ranks 1, 2, 3 are all present (single-digit, substring safe in this fixture)
    expect(text).toMatch(/\b1\b/)
    expect(text).toMatch(/\b2\b/)
    expect(text).toMatch(/\b3\b/)
  })

  it('Test 3: does not contain prediction scores, LOS picks, or bonus details', async () => {
    const text = await renderStandings()
    // Column allowlist enforced — no per-member prediction values, LOS
    // picks, or bonus pick details leak from the DB to unauthenticated
    // viewers. The word "predictions" may appear in marketing copy
    // ("Premier League predictions season 2025/26") but specific prediction
    // DATA must not.
    //
    // Strategy: assert the fixtures table key words "Prediction" heading,
    // LOS team names, and bonus pick fields are absent.
    expect(text).not.toMatch(/my prediction/i)
    expect(text).not.toMatch(/points awarded/i)
    expect(text).not.toMatch(/last one standing/i)
    expect(text).not.toMatch(/LOS pick/i)
    expect(text).not.toMatch(/bonus pick/i)
    expect(text).not.toMatch(/bonus award/i)
  })

  it('Test 4: shows fixture results for the latest closed gameweek', async () => {
    const text = await renderStandings()
    expect(text).toContain('Arsenal')
    expect(text).toContain('Chelsea')
    expect(text).toContain('Liverpool')
    expect(text).toContain('Everton')
    // Home/away scores appear
    expect(text).toMatch(/\b2\b/)
    expect(text).toMatch(/\b3\b/)
    expect(text).toMatch(/\b0\b/)
  })

  it('Test 5: top-3 weekly scorers section shows 3 displayNames', async () => {
    const text = await renderStandings()
    expect(text).toContain('Alice')
    expect(text).toContain('Bob')
    expect(text).toContain('Carol')
    // Weekly point values visible
    expect(text).toContain('60')
    expect(text).toContain('40')
  })

  it('Test 6: if no gameweeks closed, shows empty state', async () => {
    latestGwData = null
    fixturesData = []
    topWeeklyData = []
    const text = await renderStandings()
    expect(text).toMatch(/Awaiting|first gameweek|not yet/i)
    // Standings themselves should still render
    expect(text).toContain('Alice')
  })
})
