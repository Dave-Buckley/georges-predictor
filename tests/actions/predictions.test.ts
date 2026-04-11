/**
 * Tests for the submitPredictions server action.
 *
 * All Supabase calls, lockout checks, and cache invalidations are mocked.
 * Tests verify the contract of the server action — auth, approval, validation,
 * lockout filtering, upsert behavior, and revalidation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabaseClient } from '../setup'

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// Mock createServerSupabaseClient — used for member auth + member lookup + upsert
const mockServerClient = createMockSupabaseClient()
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(async () => mockServerClient),
}))

// Mock canSubmitPrediction lockout check
vi.mock('@/lib/fixtures/lockout', () => ({
  canSubmitPrediction: vi.fn(),
}))

// ─── Import after mocks ───────────────────────────────────────────────────────

import { submitPredictions } from '@/actions/predictions'
import { revalidatePath } from 'next/cache'
import { canSubmitPrediction } from '@/lib/fixtures/lockout'

// Typed reference to the mock for use in tests
const mockCanSubmitPrediction = canSubmitPrediction as ReturnType<typeof vi.fn>

// ─── Test UUIDs ───────────────────────────────────────────────────────────────
// Must be valid UUID v4 format — Zod v4 validates version bits

const MEMBER_ID    = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const USER_ID      = 'b5a3f1c2-8d4e-4f7a-9b2c-1e6d8f3a5c7b'
const FIXTURE_ID_1 = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
const FIXTURE_ID_2 = 'c9bf9e57-1685-4c89-bafb-ff5af830be8a'

// ─── Helper factories ─────────────────────────────────────────────────────────

function mockAuthenticatedUser() {
  mockServerClient.auth.getUser = vi.fn().mockResolvedValue({
    data: { user: { id: USER_ID } },
    error: null,
  })
}

function mockUnauthenticatedUser() {
  mockServerClient.auth.getUser = vi.fn().mockResolvedValue({
    data: { user: null },
    error: null,
  })
}

function mockApprovedMember() {
  // Members lookup chain: .from('members').select(...).eq(...).single()
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { id: MEMBER_ID, approval_status: 'approved' },
      error: null,
    }),
  }
  mockServerClient.from = vi.fn().mockImplementation((table: string) => {
    if (table === 'members') return chain
    return createUpsertChain()
  })
}

function mockPendingMember() {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { id: MEMBER_ID, approval_status: 'pending' },
      error: null,
    }),
  }
  mockServerClient.from = vi.fn().mockImplementation((table: string) => {
    if (table === 'members') return chain
    return createUpsertChain()
  })
}

function createUpsertChain(error: unknown = null) {
  return {
    upsert: vi.fn().mockResolvedValue({ error }),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  }
}

function mockApprovedMemberWithUpsert(upsertError: unknown = null) {
  const memberChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { id: MEMBER_ID, approval_status: 'approved' },
      error: null,
    }),
  }
  const predictionChain = createUpsertChain(upsertError)
  mockServerClient.from = vi.fn().mockImplementation((table: string) => {
    if (table === 'members') return memberChain
    return predictionChain
  })
}

// ─── submitPredictions tests ───────────────────────────────────────────────────

describe('submitPredictions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: fixture 1 open, fixture 2 open
    mockCanSubmitPrediction.mockResolvedValue({ canSubmit: true })
  })

  it('returns error when user is not authenticated', async () => {
    mockUnauthenticatedUser()

    const result = await submitPredictions(1, [
      { fixture_id: FIXTURE_ID_1, home_score: 1, away_score: 0 },
    ])

    expect(result.error).toBeDefined()
    expect(result.error).toMatch(/authenticated/i)
    expect(result.saved).toBe(0)
    expect(result.skipped).toBe(0)
  })

  it('returns error when member is not approved', async () => {
    mockAuthenticatedUser()
    mockPendingMember()

    const result = await submitPredictions(1, [
      { fixture_id: FIXTURE_ID_1, home_score: 1, away_score: 0 },
    ])

    expect(result.error).toBeDefined()
    expect(result.error).toMatch(/approved/i)
    expect(result.saved).toBe(0)
    expect(result.skipped).toBe(0)
  })

  it('saves predictions for fixtures that have not kicked off', async () => {
    mockAuthenticatedUser()
    mockApprovedMemberWithUpsert()
    mockCanSubmitPrediction.mockResolvedValue({ canSubmit: true })

    const result = await submitPredictions(5, [
      { fixture_id: FIXTURE_ID_1, home_score: 2, away_score: 1 },
    ])

    expect(result.error).toBeUndefined()
    expect(result.saved).toBe(1)
    expect(result.skipped).toBe(0)
    expect(result.success).toBe(true)
  })

  it('skips fixtures where canSubmitPrediction returns false without erroring', async () => {
    mockAuthenticatedUser()
    mockApprovedMemberWithUpsert()
    mockCanSubmitPrediction
      .mockResolvedValueOnce({ canSubmit: false, reason: 'Kicked off' })  // fixture 1 locked
      .mockResolvedValueOnce({ canSubmit: true })                          // fixture 2 open

    const result = await submitPredictions(5, [
      { fixture_id: FIXTURE_ID_1, home_score: 1, away_score: 0 },
      { fixture_id: FIXTURE_ID_2, home_score: 0, away_score: 2 },
    ])

    expect(result.error).toBeUndefined()
    expect(result.saved).toBe(1)
    expect(result.skipped).toBe(1)
    expect(result.success).toBe(true)
  })

  it('returns { success: true, saved: N, skipped: M } with correct counts', async () => {
    mockAuthenticatedUser()
    mockApprovedMemberWithUpsert()
    mockCanSubmitPrediction
      .mockResolvedValueOnce({ canSubmit: true })
      .mockResolvedValueOnce({ canSubmit: false, reason: 'Kicked off' })

    const result = await submitPredictions(10, [
      { fixture_id: FIXTURE_ID_1, home_score: 3, away_score: 1 },
      { fixture_id: FIXTURE_ID_2, home_score: 0, away_score: 0 },
    ])

    expect(result.success).toBe(true)
    expect(result.saved).toBe(1)
    expect(result.skipped).toBe(1)
    expect(result.error).toBeUndefined()
  })

  it('upserts existing prediction rather than creating duplicate', async () => {
    mockAuthenticatedUser()
    const memberChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: MEMBER_ID, approval_status: 'approved' },
        error: null,
      }),
    }
    const upsertFn = vi.fn().mockResolvedValue({ error: null })
    const predictionChain = { upsert: upsertFn }
    mockServerClient.from = vi.fn().mockImplementation((table: string) => {
      if (table === 'members') return memberChain
      return predictionChain
    })
    mockCanSubmitPrediction.mockResolvedValue({ canSubmit: true })

    await submitPredictions(3, [
      { fixture_id: FIXTURE_ID_1, home_score: 1, away_score: 1 },
    ])

    expect(upsertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        member_id: MEMBER_ID,
        fixture_id: FIXTURE_ID_1,
        home_score: 1,
        away_score: 1,
      }),
      expect.objectContaining({ onConflict: 'member_id,fixture_id' })
    )
  })

  it('validates entries with Zod and rejects invalid input', async () => {
    mockAuthenticatedUser()
    mockApprovedMember()

    // Pass invalid data: negative score
    const result = await submitPredictions(1, [
      { fixture_id: FIXTURE_ID_1, home_score: -1, away_score: 0 },
    ])

    expect(result.error).toBeDefined()
    expect(result.saved).toBe(0)
    expect(result.skipped).toBe(0)
  })

  it('calls revalidatePath with the gameweek URL after successful save', async () => {
    mockAuthenticatedUser()
    mockApprovedMemberWithUpsert()
    mockCanSubmitPrediction.mockResolvedValue({ canSubmit: true })

    await submitPredictions(7, [
      { fixture_id: FIXTURE_ID_1, home_score: 0, away_score: 0 },
    ])

    expect(revalidatePath).toHaveBeenCalledWith('/gameweeks/7')
  })
})
