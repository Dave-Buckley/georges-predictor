/**
 * Keep-alive endpoint tests.
 *
 * Tests that:
 * - GET /api/keep-alive with valid CRON_SECRET returns 200 + { ok: true }
 * - GET /api/keep-alive without auth header returns 401
 * - GET /api/keep-alive with wrong secret returns 401
 * - The DB ping (from('members').select('id').limit(1)) is called on valid requests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { NextRequest } from 'next/server'
import { createMockSupabaseClient } from '../setup'

// ─── Mock admin client ────────────────────────────────────────────────────────

let mockAdminClient: ReturnType<typeof createMockSupabaseClient>

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockImplementation(() => mockAdminClient),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(authHeader?: string): NextRequest {
  const headers: Record<string, string> = {}
  if (authHeader !== undefined) {
    headers['Authorization'] = authHeader
  }
  const req = new Request('http://localhost:3000/api/keep-alive', { headers })
  return req as unknown as NextRequest
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/keep-alive', () => {
  const CRON_SECRET = 'test-cron-secret-xyz'

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CRON_SECRET', CRON_SECRET)

    // Set up fresh mock client
    mockAdminClient = createMockSupabaseClient()

    // Default: DB ping succeeds
    const chain = {
      select: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [{ id: 'test' }], error: null }),
    }
    mockAdminClient.from = vi.fn().mockReturnValue(chain)
  })

  it('returns 200 with { ok: true } when CRON_SECRET matches', async () => {
    const { GET } = await import('../../src/app/api/keep-alive/route')
    const req = makeRequest(`Bearer ${CRON_SECRET}`)
    const response = await GET(req)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
  })

  it('includes a timestamp in the response when valid', async () => {
    const { GET } = await import('../../src/app/api/keep-alive/route')
    const req = makeRequest(`Bearer ${CRON_SECRET}`)
    const response = await GET(req)
    const body = await response.json()
    expect(body.timestamp).toBeDefined()
    // Should be a valid ISO date string
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp)
  })

  it('calls the DB members table ping on valid request', async () => {
    const { GET } = await import('../../src/app/api/keep-alive/route')
    const req = makeRequest(`Bearer ${CRON_SECRET}`)
    await GET(req)

    expect(mockAdminClient.from).toHaveBeenCalledWith('members')
  })

  it('returns 401 when Authorization header is missing', async () => {
    const { GET } = await import('../../src/app/api/keep-alive/route')
    const req = makeRequest() // No header
    const response = await GET(req)

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBeDefined()
  })

  it('returns 401 when Authorization header has wrong secret', async () => {
    const { GET } = await import('../../src/app/api/keep-alive/route')
    const req = makeRequest('Bearer wrong-secret')
    const response = await GET(req)

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBeDefined()
  })

  it('returns 401 when Bearer prefix is missing', async () => {
    const { GET } = await import('../../src/app/api/keep-alive/route')
    const req = makeRequest(CRON_SECRET) // No "Bearer " prefix
    const response = await GET(req)

    expect(response.status).toBe(401)
  })

  it('returns 401 when CRON_SECRET env var is not set', async () => {
    vi.stubEnv('CRON_SECRET', '')
    const { GET } = await import('../../src/app/api/keep-alive/route')
    const req = makeRequest(`Bearer ${CRON_SECRET}`)
    const response = await GET(req)

    expect(response.status).toBe(401)
  })

  it('returns 500 when DB ping fails', async () => {
    // Override chain to return DB error
    const errorChain = {
      select: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB timeout' } }),
    }
    mockAdminClient.from = vi.fn().mockReturnValue(errorChain)

    const { GET } = await import('../../src/app/api/keep-alive/route')
    const req = makeRequest(`Bearer ${CRON_SECRET}`)
    const response = await GET(req)

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.ok).toBe(false)
  })
})
