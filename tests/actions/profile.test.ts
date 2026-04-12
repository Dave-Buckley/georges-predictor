/**
 * Tests for updateEmailPreferences server action (Phase 10 Plan 04 Task 2).
 *
 * Contract:
 *   - Requires authenticated session; returns 'Unauthorized' otherwise
 *   - Accepts either/both flags: email_weekly_personal, email_weekly_group
 *   - Only updates the flags that are present in FormData
 *   - Coerces string 'true'/'false' -> boolean
 *   - Calls revalidatePath('/profile') after successful update
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabaseClient } from '../setup'

// ─── Module mocks ─────────────────────────────────────────────────────────────

const revalidatePathMock = vi.fn()
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}))

const mockServerClient = createMockSupabaseClient()
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(() => mockServerClient),
}))

import { updateEmailPreferences } from '@/actions/profile'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const USER_ID = '11111111-1111-4111-8111-111111111111'

function setAuthedUser() {
  ;(
    mockServerClient.auth.getUser as ReturnType<typeof vi.fn>
  ).mockResolvedValue({
    data: { user: { id: USER_ID } },
    error: null,
  })
}

function setUnauthenticated() {
  ;(
    mockServerClient.auth.getUser as ReturnType<typeof vi.fn>
  ).mockResolvedValue({
    data: { user: null },
    error: null,
  })
}

interface UpdateChain {
  update: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
}

function setupUpdateChain(error: { message: string } | null = null): UpdateChain {
  const chain = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ error, data: null }),
  }
  ;(mockServerClient.from as ReturnType<typeof vi.fn>).mockReturnValue(chain)
  return chain as unknown as UpdateChain
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('updateEmailPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("Test 1: updates email_weekly_personal when flag set to 'false'", async () => {
    setAuthedUser()
    const chain = setupUpdateChain()
    const fd = new FormData()
    fd.set('email_weekly_personal', 'false')

    const result = await updateEmailPreferences(fd)

    expect(result).toEqual({ success: true })
    expect(mockServerClient.from).toHaveBeenCalledWith('members')
    expect(chain.update).toHaveBeenCalledWith({ email_weekly_personal: false })
    expect(chain.eq).toHaveBeenCalledWith('user_id', USER_ID)
  })

  it('Test 2: unauthenticated caller returns Unauthorized error', async () => {
    setUnauthenticated()
    const chain = setupUpdateChain()
    const fd = new FormData()
    fd.set('email_weekly_personal', 'false')

    const result = await updateEmailPreferences(fd)

    expect(result).toEqual({ success: false, error: 'Unauthorized' })
    expect(chain.update).not.toHaveBeenCalled()
  })

  it('Test 3: FormData with only one flag updates only that flag', async () => {
    setAuthedUser()
    const chain = setupUpdateChain()
    const fd = new FormData()
    fd.set('email_weekly_group', 'true')

    const result = await updateEmailPreferences(fd)

    expect(result).toEqual({ success: true })
    // Only the one flag is in the update payload
    expect(chain.update).toHaveBeenCalledWith({ email_weekly_group: true })
    const call = chain.update.mock.calls[0][0] as Record<string, unknown>
    expect('email_weekly_personal' in call).toBe(false)
  })

  it("Test 4: string 'true'/'false' is coerced to boolean", async () => {
    setAuthedUser()
    const chain = setupUpdateChain()
    const fd = new FormData()
    fd.set('email_weekly_personal', 'true')
    fd.set('email_weekly_group', 'false')

    await updateEmailPreferences(fd)

    expect(chain.update).toHaveBeenCalledWith({
      email_weekly_personal: true,
      email_weekly_group: false,
    })
    // Specifically verify booleans, not strings
    const payload = chain.update.mock.calls[0][0] as Record<string, unknown>
    expect(typeof payload.email_weekly_personal).toBe('boolean')
    expect(typeof payload.email_weekly_group).toBe('boolean')
  })

  it('Test 5: successful update triggers revalidatePath(/profile)', async () => {
    setAuthedUser()
    setupUpdateChain()
    const fd = new FormData()
    fd.set('email_weekly_personal', 'false')

    await updateEmailPreferences(fd)

    expect(revalidatePathMock).toHaveBeenCalledWith('/profile')
  })
})
