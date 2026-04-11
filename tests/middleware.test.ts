/**
 * Middleware route protection tests.
 *
 * Tests that:
 * - Unauthenticated requests to /dashboard are redirected to /login
 * - Non-admin requests to /admin are redirected to /admin/login
 * - Admin requests to /admin pass through
 * - /admin/login passes through (no redirect loop)
 * - Public routes (/, /signup, /login) are accessible without auth
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { NextRequest } from 'next/server'
import { createMockSupabaseClient } from './setup'

// ─── Mock @supabase/ssr ───────────────────────────────────────────────────────
// Middleware creates its own Supabase client via createServerClient
// We need to control what getUser() returns for each test case

let mockGetUser: ReturnType<typeof vi.fn>

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn().mockImplementation(() => {
    const client = createMockSupabaseClient()
    client.auth.getUser = mockGetUser
    return client
  }),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(pathname: string, cookies: Record<string, string> = {}): NextRequest {
  const url = `http://localhost:3000${pathname}`
  const req = new Request(url, {
    headers: {
      cookie: Object.entries(cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join('; '),
    },
  })
  // Simulate NextRequest - add the cookies.getAll() method
  const nextReq = req as unknown as NextRequest
  Object.defineProperty(nextReq, 'nextUrl', {
    get: () => new URL(url),
  })
  Object.defineProperty(nextReq, 'cookies', {
    get: () => ({
      getAll: () =>
        Object.entries(cookies).map(([name, value]) => ({ name, value })),
      get: (name: string) =>
        cookies[name] ? { name, value: cookies[name] } : undefined,
      set: vi.fn(),
    }),
  })
  Object.defineProperty(nextReq, 'url', {
    get: () => url,
  })
  return nextReq
}

function noUser() {
  return vi.fn().mockResolvedValue({ data: { user: null }, error: null })
}

function regularUser() {
  return vi.fn().mockResolvedValue({
    data: {
      user: {
        id: 'user-123',
        email: 'member@example.com',
        app_metadata: { role: 'member' },
      },
    },
    error: null,
  })
}

function adminUser() {
  return vi.fn().mockResolvedValue({
    data: {
      user: {
        id: 'admin-123',
        email: 'george@example.com',
        app_metadata: { role: 'admin' },
      },
    },
    error: null,
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('middleware route protection', () => {
  let middleware: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    // Import fresh each time
    const mod = await import('../src/middleware')
    middleware = mod.middleware
  })

  // ─── /dashboard protection ─────────────────────────────────────────────────

  describe('/dashboard routes', () => {
    it('redirects unauthenticated user from /dashboard to /login', async () => {
      mockGetUser = noUser()
      const req = makeRequest('/dashboard')
      const response = await middleware(req)
      expect(response.status).toBe(307)
      const location = response.headers.get('location')
      expect(location).toContain('/login')
    })

    it('allows authenticated member to access /dashboard', async () => {
      mockGetUser = regularUser()
      const req = makeRequest('/dashboard')
      const response = await middleware(req)
      // Should not redirect (200 or no redirect)
      expect(response.status).not.toBe(307)
      const location = response.headers.get('location')
      expect(location).toBeNull()
    })

    it('allows authenticated admin to access /dashboard', async () => {
      mockGetUser = adminUser()
      const req = makeRequest('/dashboard')
      const response = await middleware(req)
      expect(response.status).not.toBe(307)
    })
  })

  // ─── /admin protection ──────────────────────────────────────────────────────

  describe('/admin routes', () => {
    it('redirects unauthenticated user from /admin to /admin/login', async () => {
      mockGetUser = noUser()
      const req = makeRequest('/admin')
      const response = await middleware(req)
      expect(response.status).toBe(307)
      const location = response.headers.get('location')
      expect(location).toContain('/admin/login')
    })

    it('redirects non-admin authenticated user from /admin to /admin/login', async () => {
      mockGetUser = regularUser()
      const req = makeRequest('/admin')
      const response = await middleware(req)
      expect(response.status).toBe(307)
      const location = response.headers.get('location')
      expect(location).toContain('/admin/login')
    })

    it('redirects non-admin from /admin/members to /admin/login', async () => {
      mockGetUser = regularUser()
      const req = makeRequest('/admin/members')
      const response = await middleware(req)
      expect(response.status).toBe(307)
      const location = response.headers.get('location')
      expect(location).toContain('/admin/login')
    })

    it('allows admin to access /admin', async () => {
      mockGetUser = adminUser()
      const req = makeRequest('/admin')
      const response = await middleware(req)
      expect(response.status).not.toBe(307)
      const location = response.headers.get('location')
      expect(location).toBeNull()
    })

    it('allows admin to access /admin/members', async () => {
      mockGetUser = adminUser()
      const req = makeRequest('/admin/members')
      const response = await middleware(req)
      expect(response.status).not.toBe(307)
    })
  })

  // ─── /admin/login pass-through ──────────────────────────────────────────────

  describe('/admin/login', () => {
    it('allows unauthenticated access to /admin/login (no redirect loop)', async () => {
      mockGetUser = noUser()
      const req = makeRequest('/admin/login')
      const response = await middleware(req)
      expect(response.status).not.toBe(307)
      const location = response.headers.get('location')
      expect(location).toBeNull()
    })

    it('allows admin to visit /admin/login without redirect', async () => {
      mockGetUser = adminUser()
      const req = makeRequest('/admin/login')
      const response = await middleware(req)
      // Should not redirect even if already logged in (let the page handle it)
      const location = response.headers.get('location')
      if (location) {
        // If it redirects, it should NOT redirect to /admin/login (no loop)
        expect(location).not.toContain('/admin/login')
      }
    })
  })

  // ─── Public routes ──────────────────────────────────────────────────────────

  describe('public routes', () => {
    it('allows unauthenticated access to /', async () => {
      mockGetUser = noUser()
      const req = makeRequest('/')
      const response = await middleware(req)
      expect(response.status).not.toBe(307)
      const location = response.headers.get('location')
      expect(location).toBeNull()
    })

    it('allows unauthenticated access to /login', async () => {
      mockGetUser = noUser()
      const req = makeRequest('/login')
      const response = await middleware(req)
      expect(response.status).not.toBe(307)
    })

    it('allows unauthenticated access to /signup', async () => {
      mockGetUser = noUser()
      const req = makeRequest('/signup')
      const response = await middleware(req)
      expect(response.status).not.toBe(307)
    })
  })
})
