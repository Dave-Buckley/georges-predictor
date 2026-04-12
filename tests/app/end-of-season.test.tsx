/**
 * /end-of-season page tests — Phase 11 Plan 04 Task 2.
 *
 * Covers two render paths:
 *   1. Archived season present → renders Final Standings hero + champion
 *      spotlight copy.
 *   2. No archived season → renders fallback message.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactElement } from 'react'

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: mocks.createAdminClient,
}))

function extractText(node: unknown, depth = 0): string {
  if (depth > 80) return ''
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map((n) => extractText(n, depth + 1)).join(' ')
  if (typeof node === 'object' && 'type' in (node as object)) {
    const el = node as ReactElement & { type: unknown; props?: { children?: unknown } }
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

// Factory for a chain mock resolving to a provided dataset keyed by table.
function buildAdmin(tables: Record<string, unknown[] | { single?: unknown; maybeSingle?: unknown }>) {
  return {
    from: vi.fn((table: string) => {
      const entry = tables[table]
      const chain: Record<string, unknown> = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi
          .fn()
          .mockResolvedValue(
            entry && !Array.isArray(entry) && 'single' in entry
              ? (entry as { single: unknown }).single
              : { data: null, error: null },
          ),
        maybeSingle: vi
          .fn()
          .mockResolvedValue(
            entry && !Array.isArray(entry) && 'maybeSingle' in entry
              ? (entry as { maybeSingle: unknown }).maybeSingle
              : { data: null, error: null },
          ),
        then: (resolve: (v: { data: unknown; error: null }) => void) =>
          resolve({ data: Array.isArray(entry) ? entry : [], error: null }),
      }
      return chain
    }),
  }
}

async function renderPage(): Promise<unknown> {
  const mod = await import('@/app/(public)/end-of-season/page')
  return await mod.default()
}

describe('/end-of-season public page', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders champion spotlight + final standings when archived season exists', async () => {
    mocks.createAdminClient.mockReturnValue(
      buildAdmin({
        seasons: {
          maybeSingle: {
            data: {
              season: 2025,
              label: '2025-26',
              ended_at: '2026-05-28T20:00:00Z',
            },
            error: null,
          },
        },
        members: [
          { id: 'm1', display_name: 'Dave', starting_points: 540 },
          { id: 'm2', display_name: 'George', starting_points: 430 },
          { id: 'm3', display_name: 'Mark', starting_points: 420 },
          { id: 'm4', display_name: 'Paul', starting_points: 300 },
        ],
        los_competitions: [],
        prize_awards: [],
        pre_season_awards: [],
      }),
    )
    const jsx = await renderPage()
    const text = extractText(jsx)
    expect(text).toMatch(/Final Standings|final standings/i)
    expect(text).toMatch(/Dave/)
    expect(text).toMatch(/2025/)
  })

  it('renders fallback when no archived season exists', async () => {
    mocks.createAdminClient.mockReturnValue(
      buildAdmin({
        seasons: {
          maybeSingle: { data: null, error: null },
        },
      }),
    )
    const jsx = await renderPage()
    const text = extractText(jsx)
    expect(text).toMatch(/no archived season|check back|first season/i)
  })
})
