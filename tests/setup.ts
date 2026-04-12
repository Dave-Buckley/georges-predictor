import '@testing-library/jest-dom'
import { vi } from 'vitest'

// ─── Mock: @supabase/ssr ──────────────────────────────────────────────────────

export function createMockSupabaseClient() {
  const chainable: Record<string, unknown> = {}

  const makeChain = (): Record<string, unknown> => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: undefined, // not a real promise — use single/maybeSingle
  })

  return {
    from: vi.fn().mockReturnValue(makeChain()),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: null, error: null }),
      signInWithOtp: vi.fn().mockResolvedValue({ data: null, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      exchangeCodeForSession: vi.fn().mockResolvedValue({ data: null, error: null }),
      admin: {
        createUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        updateUserById: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        deleteUser: vi.fn().mockResolvedValue({ data: null, error: null }),
        inviteUserByEmail: vi.fn().mockResolvedValue({ data: null, error: null }),
        listUsers: vi.fn().mockResolvedValue({ data: { users: [] }, error: null }),
      },
    },
    ...chainable,
  }
}

// Mock @supabase/ssr createServerClient
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn().mockImplementation(() => createMockSupabaseClient()),
  createBrowserClient: vi.fn().mockImplementation(() => createMockSupabaseClient()),
}))

// Mock @supabase/supabase-js createClient (used by admin client)
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockImplementation(() => createMockSupabaseClient()),
}))

// Mock next/headers cookies
const mockCookieStore = {
  get: vi.fn().mockReturnValue(undefined),
  getAll: vi.fn().mockReturnValue([]),
  set: vi.fn(),
  delete: vi.fn(),
}

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue(mockCookieStore),
}))

// `server-only` is aliased to tests/stubs/server-only.ts in vitest.config.ts
// (vi.mock runs too late — vite's import-analysis resolves modules first).

// Mock resend
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: 'mock-email-id' }, error: null }),
    },
  })),
}))
