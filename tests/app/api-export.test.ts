/**
 * Tests for /api/reports/full-export route handler (Phase 10 Plan 04 Task 3).
 *
 * Contract:
 *   - Admin-only (session check; app_metadata.role === 'admin')
 *   - Returns XLSX buffer with Content-Type + Content-Disposition headers
 *   - Buffer round-trips through XLSX.read (DATA-04 smoke)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as XLSX from 'xlsx'
import { createMockSupabaseClient } from '../setup'

// ─── Module mocks ─────────────────────────────────────────────────────────────

const mockServerClient = createMockSupabaseClient()
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(() => mockServerClient),
}))

// Build a tiny valid FullExportData fixture so buildFullExportXlsx returns a
// real XLSX buffer we can round-trip.
vi.mock('@/lib/reports/full-export-xlsx', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/lib/reports/full-export-xlsx')
  >()
  return {
    ...actual,
    gatherFullExportData: vi.fn(async () => ({
      season: '2025-26',
      gameweeks: [],
      preSeasonAwards: [],
      membersMasterList: [
        {
          id: 'm-1',
          displayName: 'Alice',
          email: 'alice@example.com',
          totalPoints: 100,
        },
      ],
      fixturesMasterList: [],
      h2hHistory: [],
      losHistory: [],
      generatedAtIso: '2026-04-12T12:00:00Z',
    })),
  }
})

import { GET } from '@/app/api/reports/full-export/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setAdmin() {
  ;(
    mockServerClient.auth.getUser as ReturnType<typeof vi.fn>
  ).mockResolvedValue({
    data: {
      user: {
        id: 'u-admin',
        app_metadata: { role: 'admin' },
      },
    },
    error: null,
  })
}

function setMember() {
  ;(
    mockServerClient.auth.getUser as ReturnType<typeof vi.fn>
  ).mockResolvedValue({
    data: {
      user: {
        id: 'u-member',
        app_metadata: { role: 'member' },
      },
    },
    error: null,
  })
}

function setUnauth() {
  ;(
    mockServerClient.auth.getUser as ReturnType<typeof vi.fn>
  ).mockResolvedValue({
    data: { user: null },
    error: null,
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/reports/full-export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Test 1: unauthenticated request returns 401 JSON', async () => {
    setUnauth()
    const res = await GET()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toEqual({ error: 'Unauthorized' })
  })

  it('Test 2: non-admin session returns 401 JSON', async () => {
    setMember()
    const res = await GET()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toEqual({ error: 'Unauthorized' })
  })

  it('Test 3: admin returns XLSX with correct headers + filename', async () => {
    setAdmin()
    const res = await GET()
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    const disposition = res.headers.get('Content-Disposition')
    expect(disposition).toMatch(/^attachment; filename=/)
    expect(disposition).toMatch(
      /georges-predictor-full-export-\d{4}-\d{2}-\d{2}\.xlsx/,
    )
  })

  it('Test 4: response body is a valid XLSX parseable by XLSX.read', async () => {
    setAdmin()
    const res = await GET()
    const buf = Buffer.from(await res.arrayBuffer())
    expect(buf.length).toBeGreaterThan(0)
    const wb = XLSX.read(buf, { type: 'buffer' })
    // At minimum the README sheet should be present from buildFullExportXlsx
    expect(wb.SheetNames.length).toBeGreaterThan(0)
    expect(wb.SheetNames).toContain('README')
  })

  it('Test 5: response body is NOT empty and NOT a JSON error shape', async () => {
    setAdmin()
    const res = await GET()
    const buf = Buffer.from(await res.arrayBuffer())
    expect(buf.length).toBeGreaterThan(100)
    // XLSX magic bytes start with 'PK' (zip container)
    expect(buf.subarray(0, 2).toString()).toBe('PK')
    // Not an error JSON
    expect(buf.toString('utf-8', 0, Math.min(64, buf.length))).not.toMatch(
      /"error"/,
    )
  })
})
