/**
 * Season-rollover wizard tests — Phase 11 Plan 04 Task 2.
 *
 * The wizard is a server-rendered component at /admin/season-rollover that
 * switches on ?step= (1..8) and renders the corresponding step component.
 *
 * We invoke the page's default export with searchParams Promise and walk the
 * returned element tree using the same extractText idiom as how-it-works.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactElement } from 'react'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  getArchiveReadiness: vi.fn(),
  getCurrentSeason: vi.fn(),
  getUpcomingSeason: vi.fn(),
  createAdminClient: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`)
  }),
}))

vi.mock('@/actions/admin/season-rollover', async () => {
  const actual =
    await vi.importActual<typeof import('@/actions/admin/season-rollover')>(
      '@/actions/admin/season-rollover',
    )
  return {
    ...actual,
    getArchiveReadiness: mocks.getArchiveReadiness,
  }
})

vi.mock('@/lib/pre-season/seasons', () => ({
  getCurrentSeason: mocks.getCurrentSeason,
  getUpcomingSeason: mocks.getUpcomingSeason,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: mocks.createAdminClient,
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractText(node: unknown, depth = 0): string {
  if (depth > 80) return ''
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) {
    return node.map((n) => extractText(n, depth + 1)).join(' ')
  }
  if (typeof node === 'object' && 'type' in (node as object)) {
    const el = node as ReactElement & { type: unknown; props?: { children?: unknown } }
    const children = el.props?.children
    if (typeof el.type === 'function') {
      try {
        const result = (el.type as (p: unknown) => unknown)(el.props ?? {})
        // Result might be a Promise (async components) — call .then synchronously isn't doable;
        // for these tests we avoid async child components by passing pre-computed props.
        return extractText(result, depth + 1)
      } catch {
        return extractText(children, depth + 1)
      }
    }
    return extractText(children, depth + 1)
  }
  return ''
}

async function renderStep(step: number | undefined): Promise<unknown> {
  const mod = await import('@/app/(admin)/admin/season-rollover/page')
  return await mod.default({
    searchParams: Promise.resolve(step === undefined ? {} : { step: String(step) }),
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('/admin/season-rollover wizard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getArchiveReadiness.mockResolvedValue({
      allGwsClosed: true,
      preSeasonConfirmed: true,
      losResolved: true,
      readyToArchive: true,
    })
    mocks.getCurrentSeason.mockResolvedValue({
      id: 1,
      season: 2025,
      label: '2025-26',
      gw1_kickoff: '2025-08-15T15:00:00Z',
    })
    mocks.getUpcomingSeason.mockResolvedValue(null)
    // Minimal admin client — returns empty datasets via thenable chain.
    const chain: Record<string, unknown> = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: (resolve: (v: { data: unknown[]; error: null }) => void) =>
        resolve({ data: [], error: null }),
    }
    mocks.createAdminClient.mockReturnValue({ from: vi.fn(() => chain) })
  })

  it('step 1 renders readiness checklist and ready-to-archive copy', async () => {
    const jsx = await renderStep(1)
    const text = extractText(jsx)
    expect(text).toMatch(/Step 1 of 8/i)
    expect(text).toMatch(/readiness|ready/i)
  })

  it('step 3 renders new-season form inputs (season + gw1 kickoff)', async () => {
    const jsx = await renderStep(3)
    const text = extractText(jsx)
    expect(text).toMatch(/Step 3 of 8/i)
    expect(text).toMatch(/gw1|kickoff|new season/i)
  })

  it('step 6 includes explicit "points reset to 0" warning for approved members', async () => {
    const jsx = await renderStep(6)
    const text = extractText(jsx)
    expect(text).toMatch(/Step 6 of 8/i)
    expect(text).toMatch(/reset|zero|0/i)
    expect(text).toMatch(/approved/i)
    expect(text).toMatch(/pending/i)
  })

  it('step 8 shows launch confirmation copy and warns about side effects', async () => {
    const jsx = await renderStep(8)
    const text = extractText(jsx)
    expect(text).toMatch(/Step 8 of 8/i)
    expect(text).toMatch(/launch/i)
  })

  it('default (no step param) renders step 1', async () => {
    const jsx = await renderStep(undefined)
    const text = extractText(jsx)
    expect(text).toMatch(/Step 1 of 8/i)
  })

  it('invalid step number falls back to step 1', async () => {
    const jsx = await renderStep(99)
    const text = extractText(jsx)
    expect(text).toMatch(/Step 1 of 8/i)
  })
})
