/**
 * Tests for the pre-season export row helper.
 *
 * Shape:
 *   - PreSeasonExportRow: 12 pick fields + calculated_points + awarded_points + confirmed
 *   - getPreSeasonExportRows returns a flat PreSeasonExportRow[] keyed by (member_id, season)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the admin client before importing the module under test.
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

import { createAdminClient } from '@/lib/supabase/admin'
import {
  getPreSeasonExportRows,
  type PreSeasonExportRow,
} from '@/lib/pre-season/export'

const MEMBER_ID = '11111111-1111-1111-1111-111111111111'

const PICK_ROW = {
  id: 'p1',
  member_id: MEMBER_ID,
  season: 2025,
  top4: ['Manchester City', 'Arsenal', 'Liverpool', 'Chelsea'],
  tenth_place: 'Brighton',
  relegated: ['Burnley', 'Sheffield United', 'Luton Town'],
  promoted: ['Leeds United', 'Ipswich Town', 'Southampton'],
  promoted_playoff_winner: 'Southampton',
  submitted_by_admin: false,
  submitted_at: '2025-08-01T10:00:00Z',
  members: {
    id: MEMBER_ID,
    display_name: 'Dave',
  },
}

const AWARD_ROW = {
  member_id: MEMBER_ID,
  season: 2025,
  calculated_points: 180,
  awarded_points: 200,
  confirmed: true,
}

function buildMockClient(picks: unknown[], awards: unknown[]) {
  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'pre_season_picks') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: picks, error: null }),
          }),
        }
      }
      if (table === 'pre_season_awards') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: awards, error: null }),
          }),
        }
      }
      return {}
    }),
  }
}

describe('PreSeasonExportRow shape', () => {
  it('has all 12 pick fields + points + confirmed + audit fields', () => {
    const row: PreSeasonExportRow = {
      member_id: MEMBER_ID,
      member_name: 'Dave',
      season: 2025,
      top4: ['A', 'B', 'C', 'D'],
      tenth_place: 'E',
      relegated: ['F', 'G', 'H'],
      promoted: ['I', 'J', 'K'],
      promoted_playoff_winner: 'L',
      calculated_points: 100,
      awarded_points: 100,
      confirmed: false,
      submitted_by_admin: false,
      submitted_at: null,
    }
    // Shape-compile check — ensures the interface stays stable for Plan 03 consumers.
    expect(row.top4).toHaveLength(4)
    expect(row.relegated).toHaveLength(3)
    expect(row.promoted).toHaveLength(3)
  })
})

describe('getPreSeasonExportRows', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns a flat array joining picks + members + awards for the given season', async () => {
    const mockClient = buildMockClient([PICK_ROW], [AWARD_ROW])
    vi.mocked(createAdminClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof createAdminClient>,
    )

    const rows = await getPreSeasonExportRows(2025)

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      member_id: MEMBER_ID,
      member_name: 'Dave',
      season: 2025,
      tenth_place: 'Brighton',
      promoted_playoff_winner: 'Southampton',
      calculated_points: 180,
      awarded_points: 200,
      confirmed: true,
      submitted_by_admin: false,
    })
    expect(rows[0].top4).toEqual([
      'Manchester City',
      'Arsenal',
      'Liverpool',
      'Chelsea',
    ])
  })

  it('returns an empty array when no picks exist for the season', async () => {
    const mockClient = buildMockClient([], [])
    vi.mocked(createAdminClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof createAdminClient>,
    )

    const rows = await getPreSeasonExportRows(2030)
    expect(rows).toEqual([])
  })

  it('returns rows with null points when picks exist but no award row yet', async () => {
    const mockClient = buildMockClient([PICK_ROW], [])
    vi.mocked(createAdminClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof createAdminClient>,
    )

    const rows = await getPreSeasonExportRows(2025)
    expect(rows).toHaveLength(1)
    expect(rows[0].calculated_points).toBeNull()
    expect(rows[0].awarded_points).toBeNull()
    expect(rows[0].confirmed).toBe(false)
  })
})
