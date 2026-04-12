/**
 * /members/[slug] page tests — Phase 11 Plan 02 Task 2.
 *
 * Three render paths covered:
 *   1. Unauth → redirects to /login (defense-in-depth; (member) layout
 *      handles this first in real routing, but the page also calls
 *      redirect('/login') for completeness).
 *   2. Valid auth + known slug → renders profile-header + stats panel.
 *   3. Valid auth + unknown slug → renders "Member not found" empty state.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

// Hoisted mocks — vi.mock factories must not reference module-scope vars
// that exist only after hoisting.
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createServerSupabaseClient: vi.fn(),
  findMemberBySlug: vi.fn(),
  createAdminClient: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`)
  }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: mocks.createServerSupabaseClient,
}))

vi.mock('@/lib/members/slug', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/members/slug')>(
      '@/lib/members/slug',
    )
  return {
    ...actual,
    findMemberBySlug: mocks.findMemberBySlug,
  }
})

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: mocks.createAdminClient,
}))

// Import the page AFTER mocks.
import MemberProfilePage from '@/app/(member)/members/[slug]/page'

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildFetchResolver(table: string) {
  // Fallback empty query builder per table — single() / maybeSingle() return
  // { data: null, error: null }. order/eq/... chain to self.
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    filter: vi.fn().mockReturnThis(),
    // Thenable: a lot of Supabase chains await the builder directly.
    then: (resolve: (v: { data: unknown[]; error: null }) => void) =>
      resolve({ data: [], error: null }),
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _tag = table // reserved for future per-table behaviour
  return chain
}

function setupClients(opts: { user: { id: string; app_metadata?: Record<string, unknown> } | null }) {
  mocks.getUser.mockResolvedValue({
    data: { user: opts.user },
    error: null,
  })
  const serverClient = {
    auth: {
      getUser: mocks.getUser,
    },
    from: vi.fn((table: string) => buildFetchResolver(table)),
  }
  const adminClient = {
    from: vi.fn((table: string) => buildFetchResolver(table)),
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
  }
  mocks.createServerSupabaseClient.mockResolvedValue(serverClient)
  mocks.createAdminClient.mockReturnValue(adminClient)
  return { serverClient, adminClient }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('/members/[slug] page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('unauth session redirects to /login (defense-in-depth)', async () => {
    setupClients({ user: null })
    let err: Error | null = null
    try {
      await MemberProfilePage({
        params: Promise.resolve({ slug: 'john-smith' }),
      })
    } catch (e) {
      err = e as Error
    }
    expect(err?.message).toBe('REDIRECT:/login')
  })

  it('unknown slug renders a "Member not found" empty state (no throw)', async () => {
    setupClients({ user: { id: 'viewer-user-id' } })
    mocks.findMemberBySlug.mockResolvedValue(null)

    const el = await MemberProfilePage({
      params: Promise.resolve({ slug: 'nobody' }),
    })
    const { container } = render(el as React.ReactElement)
    expect(container.textContent).toContain('Member not found')
  })

  it('valid slug renders profile header + stats panel', async () => {
    setupClients({ user: { id: 'viewer-user-id' } })
    mocks.findMemberBySlug.mockResolvedValue({
      id: 'member-1',
      display_name: 'John Smith',
      email: 'john@example.com',
      favourite_team_id: null,
      created_at: '2025-08-01T00:00:00Z',
      approval_status: 'approved',
    })

    const el = await MemberProfilePage({
      params: Promise.resolve({ slug: 'john-smith' }),
    })
    const { container } = render(el as React.ReactElement)
    // Display name is in the header.
    expect(container.textContent).toContain('John Smith')
    // Season stats panel renders labelled cards.
    expect(container.textContent?.toLowerCase()).toContain('total points')
  })
})
