/**
 * Shared test fixtures for Phase 10 reports.
 *
 * - `mockGameweekData()` — fully-populated GameweekReportData snapshot used by
 *   every renderer test (Plans 02-04 will import this).
 * - `mockSupabaseFrom(tables)` — thenable query-chain stub. Mirrors Phase 4/6
 *   test idioms: `.from(table).select(...).eq(...)` resolves against a
 *   predefined data map keyed by table name.
 */
import { vi } from 'vitest'

import type { GameweekReportData } from '@/lib/reports/_data/gather-gameweek-data'

// ─── Mock GameweekReportData ─────────────────────────────────────────────────

/**
 * Build a full GameweekReportData fixture. Override any field via `patch`.
 *
 * Shape: 10 members, 10 fixtures, one H2H steal, Double Bubble active,
 * top_weekly includes 3 members.
 */
export function mockGameweekData(
  patch: Partial<GameweekReportData> = {},
): GameweekReportData {
  const members = Array.from({ length: 10 }, (_, i) => ({
    memberId: `m-${i + 1}`,
    displayName: `Member ${String.fromCharCode(65 + i)}`, // A..J
    totalPoints: 100 - i * 5,
    rank: i + 1,
    weeklyPoints: 30 - i * 2,
  }))

  const fixtures = Array.from({ length: 10 }, (_, i) => ({
    id: `fix-${i + 1}`,
    home: `Home${i + 1}`,
    away: `Away${i + 1}`,
    homeScore: i % 2 === 0 ? 2 : null,
    awayScore: i % 2 === 0 ? 1 : null,
    status: i % 2 === 0 ? 'FINISHED' : 'SCHEDULED',
    kickoffIso: `2025-08-${String(16 + i).padStart(2, '0')}T14:00:00Z`,
  }))

  const predictionsByMember: GameweekReportData['predictionsByMember'] = {}
  for (const m of members) {
    predictionsByMember[m.memberId] = fixtures.slice(0, 5).map((f, idx) => ({
      fixtureId: f.id,
      homePrediction: idx,
      awayPrediction: idx + 1,
      pointsAwarded: idx === 0 ? 30 : idx === 1 ? 10 : 0,
      isBonusFixture: idx === 2,
      bonusPointsAwarded: idx === 2 ? 20 : 0,
    }))
  }

  return {
    gwNumber: 1,
    gwId: 'gw-1',
    closedAtIso: '2025-08-25T23:59:59Z',
    seasonLabel: '2025-26',
    doubleBubbleActive: true,
    standings: members,
    fixtures,
    predictionsByMember,
    bonus: {
      type: 'golden_glory',
      pickByMember: members.reduce(
        (acc, m) => {
          acc[m.memberId] = { fixtureId: 'fix-3', awarded: true }
          return acc
        },
        {} as Record<string, { fixtureId: string | null; awarded: boolean | null }>,
      ),
    },
    losStatus: members.map((m, i) => ({
      memberId: m.memberId,
      teamPicked: `Team${i + 1}`,
      survived: i < 8 ? true : false,
      eliminated: i >= 8,
    })),
    h2hSteals: [
      {
        detectedInGwId: 'gw-1',
        resolvesInGwId: 'gw-2',
        resolvedAt: null,
        position: 1,
        memberIds: ['m-1', 'm-2'],
        winnerId: null,
      },
    ],
    topWeekly: members.slice(0, 3).map((m) => ({
      memberId: m.memberId,
      displayName: m.displayName,
      weeklyPoints: m.weeklyPoints,
    })),
    ...patch,
  }
}

// ─── Supabase .from() chain stub ─────────────────────────────────────────────

/**
 * Raw DB rows keyed by table name for `mockSupabaseFrom`. Each entry is the
 * final resolved payload for that table's query chain.
 */
export interface TableDataMap {
  gameweeks?: unknown
  fixtures?: unknown[]
  predictions?: unknown[]
  prediction_scores?: unknown[]
  bonus_awards?: unknown[]
  los_picks?: unknown[]
  h2h_steals?: unknown[]
  members?: unknown[]
  bonus_schedule?: unknown[]
  los_competition_members?: unknown[]
}

/**
 * Returns an object with a `.from(table)` method mirroring the chained
 * Supabase query-builder. All intermediate methods return `this`, and the
 * terminal resolution happens when the chain is awaited (`.single()`,
 * `.maybeSingle()`, or top-level `then`/`await`).
 *
 * Usage pattern matches the existing pre-season-export test idiom.
 */
export function mockSupabaseFrom(tables: TableDataMap) {
  return {
    from: vi.fn().mockImplementation((tableName: keyof TableDataMap | string) => {
      const payload = tables[tableName as keyof TableDataMap]
      const resolved = {
        data: Array.isArray(payload) ? payload : payload ?? null,
        error: null,
      }

      const chain: Record<string, unknown> = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(resolved),
        maybeSingle: vi.fn().mockResolvedValue(resolved),
        // Awaitable directly (used by list fetches without .single())
        then: (resolve: (v: typeof resolved) => unknown) => resolve(resolved),
      }

      return chain
    }),
  }
}
