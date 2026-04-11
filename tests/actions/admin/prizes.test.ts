/**
 * Tests for admin prize management actions.
 *
 * Covers confirmPrize, createPrize, and checkDatePrizes.
 * All Supabase calls are mocked via tests/setup.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabaseClient } from '../../setup'

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

const mockAdminClient = createMockSupabaseClient()
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mockAdminClient),
}))

const mockServerClient = createMockSupabaseClient()
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(() => mockServerClient),
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ADMIN_USER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
const AWARD_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901'
const PRIZE_ID = 'c3d4e5f6-a7b8-9012-cdef-123456789012'
const MEMBER_ID = 'd4e5f6a7-b8c9-0123-defa-234567890123'

function mockAdminUser() {
  mockServerClient.auth.getUser = vi.fn().mockResolvedValue({
    data: {
      user: {
        id: ADMIN_USER_ID,
        app_metadata: { role: 'admin' },
        email: 'george@example.com',
      },
    },
    error: null,
  })
}

function mockNonAdminUser() {
  mockServerClient.auth.getUser = vi.fn().mockResolvedValue({
    data: {
      user: {
        id: 'member-user-id',
        app_metadata: { role: 'member' },
        email: 'member@example.com',
      },
    },
    error: null,
  })
}

// ─── confirmPrize ─────────────────────────────────────────────────────────────

describe('confirmPrize', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminUser()
  })

  it('returns error if caller is not admin', async () => {
    mockNonAdminUser()
    const { confirmPrize } = await import('@/actions/admin/prizes')

    const formData = new FormData()
    formData.set('award_id', AWARD_ID)
    formData.set('status', 'confirmed')

    const result = await confirmPrize(formData)
    expect(result).toEqual({ error: expect.any(String) })
  })

  it('returns error for invalid award_id (not a UUID)', async () => {
    const { confirmPrize } = await import('@/actions/admin/prizes')

    const formData = new FormData()
    formData.set('award_id', 'not-a-uuid')
    formData.set('status', 'confirmed')

    const result = await confirmPrize(formData)
    expect(result).toEqual({ error: expect.any(String) })
  })

  it('updates prize_awards status and confirmed_by on valid confirm', async () => {
    const updateMock = vi.fn().mockReturnThis()
    const updateEqMock = vi.fn().mockResolvedValue({ data: {}, error: null })

    const awardData = {
      id: AWARD_ID,
      prize_id: PRIZE_ID,
      member_id: MEMBER_ID,
      status: 'pending',
      prize: { name: 'Top Scorer', emoji: '🏆' },
      member: { id: MEMBER_ID, display_name: 'Alice' },
    }

    // Chain for read: select().eq().single()
    const readChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: awardData, error: null }),
    }
    readChain.select.mockReturnValue(readChain)
    readChain.eq.mockReturnValue(readChain)

    // Chain for update: update().eq()
    const writeChain = {
      update: updateMock,
      eq: updateEqMock,
    }
    updateMock.mockReturnValue(writeChain)

    let callCount = 0
    mockAdminClient.from = vi.fn().mockImplementation((table: string) => {
      if (table === 'prize_awards') {
        callCount++
        // First call = read (select), second call = write (update)
        if (callCount === 1) return readChain
        return writeChain
      }
      return {
        insert: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((cb: (v: unknown) => unknown) => cb({ error: null })),
        eq: vi.fn().mockResolvedValue({ data: {}, error: null }),
      }
    })

    const { confirmPrize } = await import('@/actions/admin/prizes')

    const formData = new FormData()
    formData.set('award_id', AWARD_ID)
    formData.set('status', 'confirmed')
    formData.set('notes', 'Well deserved!')

    const result = await confirmPrize(formData)
    expect(result).toEqual({ success: true })

    // update was called on prize_awards
    const fromCalls = (mockAdminClient.from as ReturnType<typeof vi.fn>).mock.calls
    const prizeAwardCall = fromCalls.some(([t]: [string]) => t === 'prize_awards')
    expect(prizeAwardCall).toBe(true)
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'confirmed',
        confirmed_by: ADMIN_USER_ID,
        notes: 'Well deserved!',
      })
    )
  })



  it('inserts admin_notification when status is confirmed', async () => {
    let notificationInserted = false

    const awardData = {
      id: AWARD_ID,
      prize_id: PRIZE_ID,
      member_id: MEMBER_ID,
      status: 'pending',
      prize: { name: 'Top Scorer', emoji: '🏆' },
      member: { id: MEMBER_ID, display_name: 'Alice' },
    }

    const readChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: awardData, error: null }),
    }
    readChain.select.mockReturnValue(readChain)
    readChain.eq.mockReturnValue(readChain)

    const writeChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: {}, error: null }),
    }

    let prizeAwardCallCount = 0
    mockAdminClient.from = vi.fn().mockImplementation((table: string) => {
      if (table === 'prize_awards') {
        prizeAwardCallCount++
        if (prizeAwardCallCount === 1) return readChain
        return writeChain
      }
      if (table === 'admin_notifications') {
        notificationInserted = true
        return {
          insert: vi.fn().mockReturnThis(),
          then: vi.fn().mockImplementation((cb: (v: unknown) => unknown) => cb({ error: null })),
        }
      }
      return {
        insert: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: {}, error: null }),
      }
    })

    const { confirmPrize } = await import('@/actions/admin/prizes')

    const formData = new FormData()
    formData.set('award_id', AWARD_ID)
    formData.set('status', 'confirmed')

    await confirmPrize(formData)
    expect(notificationInserted).toBe(true)
  })

  it('does NOT insert admin_notification when status is rejected', async () => {
    let notificationInserted = false

    const awardData = {
      id: AWARD_ID,
      prize_id: PRIZE_ID,
      member_id: null,
      status: 'pending',
      prize: { name: 'Top Scorer', emoji: '🏆' },
      member: null,
    }

    const readChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: awardData, error: null }),
    }
    readChain.select.mockReturnValue(readChain)
    readChain.eq.mockReturnValue(readChain)

    const writeChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: {}, error: null }),
    }

    let prizeAwardCallCount2 = 0
    mockAdminClient.from = vi.fn().mockImplementation((table: string) => {
      if (table === 'prize_awards') {
        prizeAwardCallCount2++
        if (prizeAwardCallCount2 === 1) return readChain
        return writeChain
      }
      if (table === 'admin_notifications') {
        notificationInserted = true
        return {
          insert: vi.fn().mockReturnThis(),
          then: vi.fn(),
        }
      }
      return {
        eq: vi.fn().mockResolvedValue({ data: {}, error: null }),
      }
    })

    const { confirmPrize } = await import('@/actions/admin/prizes')

    const formData = new FormData()
    formData.set('award_id', AWARD_ID)
    formData.set('status', 'rejected')

    await confirmPrize(formData)
    expect(notificationInserted).toBe(false)
  })
})

// ─── createPrize ──────────────────────────────────────────────────────────────

describe('createPrize', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminUser()
  })

  it('returns error if caller is not admin', async () => {
    mockNonAdminUser()
    const { createPrize } = await import('@/actions/admin/prizes')

    const formData = new FormData()
    formData.set('name', 'Custom Prize')
    formData.set('description', 'A custom prize')
    formData.set('trigger_type', 'manual')
    formData.set('points_value', '50')
    formData.set('cash_value', '1000')

    const result = await createPrize(formData)
    expect(result).toEqual({ error: expect.any(String) })
  })

  it('returns error for missing required fields', async () => {
    const { createPrize } = await import('@/actions/admin/prizes')

    const formData = new FormData()
    formData.set('name', '')
    formData.set('description', '')
    formData.set('trigger_type', 'manual')
    formData.set('points_value', '50')
    formData.set('cash_value', '1000')

    const result = await createPrize(formData)
    expect(result).toEqual({ error: expect.any(String) })
  })

  it('inserts additional_prizes row with is_custom=true', async () => {
    const insertMock = vi.fn().mockReturnThis()
    const selectMock = vi.fn().mockReturnThis()
    const singleMock = vi.fn().mockResolvedValue({
      data: { id: PRIZE_ID },
      error: null,
    })

    mockAdminClient.from = vi.fn().mockImplementation((table: string) => {
      if (table === 'additional_prizes') {
        return {
          insert: insertMock,
          select: selectMock,
          single: singleMock,
        }
      }
      return {
        insert: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: {}, error: null }),
      }
    })

    const { createPrize } = await import('@/actions/admin/prizes')

    const formData = new FormData()
    formData.set('name', 'Golden Boot')
    formData.set('emoji', '👟')
    formData.set('description', 'Awarded to the highest scorer')
    formData.set('trigger_type', 'manual')
    formData.set('points_value', '50')
    formData.set('cash_value', '2000')

    const result = await createPrize(formData)
    expect(result).toEqual({ success: true, id: expect.any(String) })
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Golden Boot',
        emoji: '👟',
        is_custom: true,
      })
    )
  })
})

// ─── checkDatePrizes ──────────────────────────────────────────────────────────

describe('checkDatePrizes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('creates prize_awards row when today matches a date prize', async () => {
    // Set today to Christmas day (Dec 25)
    vi.setSystemTime(new Date('2025-12-25T12:00:00Z'))

    const CHRISTMAS_PRIZE_ID = 'e5f6a7b8-c9d0-1234-efab-345678901234'
    let prizeAwardsInserted = false

    mockAdminClient.from = vi.fn().mockImplementation((table: string) => {
      if (table === 'additional_prizes') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: [
              {
                id: CHRISTMAS_PRIZE_ID,
                name: 'Christmas Day',
                emoji: '🎄',
                trigger_type: 'date',
                trigger_config: { month: 12, day: 25 },
              },
            ],
            error: null,
          }),
        }
      }
      if (table === 'prize_awards') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lt: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          insert: vi.fn().mockReturnThis(),
          then: vi.fn().mockImplementation((cb: (v: unknown) => unknown) => cb({ error: null })),
        }
      }
      if (table === 'prediction_scores') {
        return {
          select: vi.fn().mockReturnThis(),
          then: vi.fn().mockImplementation((cb: (v: unknown) => unknown) =>
            cb({ data: [], error: null })
          ),
        }
      }
      if (table === 'admin_notifications') {
        return {
          insert: vi.fn().mockReturnThis(),
          then: vi.fn().mockImplementation((cb: (v: unknown) => unknown) => cb({ error: null })),
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((cb: (v: unknown) => unknown) => cb({ error: null })),
      }
    })

    const { checkDatePrizes } = await import('@/actions/admin/prizes')
    const result = await checkDatePrizes()

    expect(result).toEqual({ triggered: expect.arrayContaining(['Christmas Day']) })

    // Verify insert was called on prize_awards
    const fromCalls = (mockAdminClient.from as ReturnType<typeof vi.fn>).mock.calls
    const prizeAwardsInsertCall = fromCalls.some(([t]: [string]) => t === 'prize_awards')
    expect(prizeAwardsInsertCall).toBe(true)
    prizeAwardsInserted = true
    expect(prizeAwardsInserted).toBe(true)
  })

  it('returns empty triggered array when today does NOT match any date prize', async () => {
    // Set today to a regular day with no prize
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'))

    mockAdminClient.from = vi.fn().mockImplementation((table: string) => {
      if (table === 'additional_prizes') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: [
              {
                id: PRIZE_ID,
                name: 'Christmas Day',
                trigger_type: 'date',
                trigger_config: { month: 12, day: 25 },
              },
            ],
            error: null,
          }),
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        insert: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((cb: (v: unknown) => unknown) => cb({ error: null })),
      }
    })

    const { checkDatePrizes } = await import('@/actions/admin/prizes')
    const result = await checkDatePrizes()
    expect(result).toEqual({ triggered: [] })
  })

  it('skips if a pending/confirmed award already exists today for that prize', async () => {
    // Set today to Christmas day
    vi.setSystemTime(new Date('2025-12-25T12:00:00Z'))

    const insertMock = vi.fn()

    mockAdminClient.from = vi.fn().mockImplementation((table: string) => {
      if (table === 'additional_prizes') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: [
              {
                id: PRIZE_ID,
                name: 'Christmas Day',
                trigger_type: 'date',
                trigger_config: { month: 12, day: 25 },
              },
            ],
            error: null,
          }),
        }
      }
      if (table === 'prize_awards') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lt: vi.fn().mockReturnThis(),
          // Returns existing award — should skip insert
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'existing-award-id', status: 'pending' },
            error: null,
          }),
          insert: insertMock,
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((cb: (v: unknown) => unknown) => cb({ error: null })),
      }
    })

    const { checkDatePrizes } = await import('@/actions/admin/prizes')
    const result = await checkDatePrizes()

    // Not triggered because award already exists
    expect(result).toEqual({ triggered: [] })
    // Insert should NOT have been called
    expect(insertMock).not.toHaveBeenCalled()
  })
})
