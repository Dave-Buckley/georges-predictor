/**
 * Tests for the /profile server actions.
 *
 * updateEmailPreferences contract:
 *   - Requires authenticated session; returns 'Unauthorized' otherwise
 *   - Accepts either/both flags: email_weekly_personal, email_weekly_group
 *   - Only updates the flags that are present in FormData
 *   - Coerces string 'true'/'false' -> boolean
 *   - Calls revalidatePath('/profile') after successful update
 *   - Writes through the ADMIN client, scoped to the session user_id
 *   - Reports failure when the update matches no rows
 *
 * updateFavouriteClub contract:
 *   - Requires authenticated session
 *   - Empty string clears the pick (stores null)
 *   - Rejects a non-UUID value
 *   - Rejects a UUID that is not a real club
 *   - Scopes the write to the session user_id
 *
 * ─── Why the admin client ──────────────────────────────────────────────────
 * public.members has no self-UPDATE RLS policy — migration 001 grants UPDATE
 * to admins only. A session-client update therefore matches zero rows, which
 * PostgREST reports as success rather than an error. These actions use the
 * service role from trusted server code and scope every write with
 * .eq('user_id', user.id) instead. Test 6 is the regression guard for the
 * silent-no-op behaviour that caused.
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

const mockAdminClient = { from: vi.fn() }
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mockAdminClient),
}))

import { updateEmailPreferences, updateFavouriteClub } from '@/actions/profile'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const USER_ID = '11111111-1111-4111-8111-111111111111'
const MEMBER_ID = '22222222-2222-4222-8222-222222222222'
const CLUB_ID = '33333333-3333-4333-8333-333333333333'

function setAuthedUser() {
  ;(mockServerClient.auth.getUser as ReturnType<typeof vi.fn>).mockResolvedValue({
    data: { user: { id: USER_ID } },
    error: null,
  })
}

function setUnauthenticated() {
  ;(mockServerClient.auth.getUser as ReturnType<typeof vi.fn>).mockResolvedValue({
    data: { user: null },
    error: null,
  })
}

interface MemberChain {
  update: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  select: ReturnType<typeof vi.fn>
}

/**
 * Routes admin.from(table) to the right stub.
 *
 * @param opts.rowsUpdated - rows the members UPDATE reports back
 * @param opts.updateError - error the members UPDATE reports back
 * @param opts.clubExists  - whether the clubs lookup resolves
 */
function setupAdmin(opts: {
  rowsUpdated?: Array<{ id: string }>
  updateError?: { message: string } | null
  clubExists?: boolean
} = {}): MemberChain {
  const {
    rowsUpdated = [{ id: MEMBER_ID }],
    updateError = null,
    clubExists = true,
  } = opts

  const memberChain = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockResolvedValue({ data: rowsUpdated, error: updateError }),
  }

  const clubChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi
      .fn()
      .mockResolvedValue({ data: clubExists ? { id: CLUB_ID } : null, error: null }),
  }

  mockAdminClient.from.mockImplementation((table: string) =>
    table === 'clubs' ? clubChain : memberChain,
  )

  return memberChain as unknown as MemberChain
}

// ─── updateEmailPreferences ───────────────────────────────────────────────────

describe('updateEmailPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("Test 1: updates email_weekly_personal when flag set to 'false'", async () => {
    setAuthedUser()
    const chain = setupAdmin()
    const fd = new FormData()
    fd.set('email_weekly_personal', 'false')

    const result = await updateEmailPreferences(fd)

    expect(result).toEqual({ success: true })
    expect(mockAdminClient.from).toHaveBeenCalledWith('members')
    expect(chain.update).toHaveBeenCalledWith({ email_weekly_personal: false })
    expect(chain.eq).toHaveBeenCalledWith('user_id', USER_ID)
  })

  it('Test 2: unauthenticated caller returns Unauthorized error', async () => {
    setUnauthenticated()
    const chain = setupAdmin()
    const fd = new FormData()
    fd.set('email_weekly_personal', 'false')

    const result = await updateEmailPreferences(fd)

    expect(result).toEqual({ success: false, error: 'Unauthorized' })
    expect(chain.update).not.toHaveBeenCalled()
  })

  it('Test 3: FormData with only one flag updates only that flag', async () => {
    setAuthedUser()
    const chain = setupAdmin()
    const fd = new FormData()
    fd.set('email_weekly_group', 'true')

    const result = await updateEmailPreferences(fd)

    expect(result).toEqual({ success: true })
    expect(chain.update).toHaveBeenCalledWith({ email_weekly_group: true })
    const call = chain.update.mock.calls[0][0] as Record<string, unknown>
    expect('email_weekly_personal' in call).toBe(false)
  })

  it("Test 4: string 'true'/'false' is coerced to boolean", async () => {
    setAuthedUser()
    const chain = setupAdmin()
    const fd = new FormData()
    fd.set('email_weekly_personal', 'true')
    fd.set('email_weekly_group', 'false')

    await updateEmailPreferences(fd)

    expect(chain.update).toHaveBeenCalledWith({
      email_weekly_personal: true,
      email_weekly_group: false,
    })
    const payload = chain.update.mock.calls[0][0] as Record<string, unknown>
    expect(typeof payload.email_weekly_personal).toBe('boolean')
    expect(typeof payload.email_weekly_group).toBe('boolean')
  })

  it('Test 5: successful update triggers revalidatePath(/profile)', async () => {
    setAuthedUser()
    setupAdmin()
    const fd = new FormData()
    fd.set('email_weekly_personal', 'false')

    await updateEmailPreferences(fd)

    expect(revalidatePathMock).toHaveBeenCalledWith('/profile')
  })

  it('Test 6: an update matching zero rows reports failure, not success', async () => {
    // Regression guard. The old implementation used the session client, which
    // RLS silently reduced to a zero-row update — and then reported "Saved".
    setAuthedUser()
    setupAdmin({ rowsUpdated: [] })
    const fd = new FormData()
    fd.set('email_weekly_personal', 'false')

    const result = await updateEmailPreferences(fd)

    expect(result.success).toBe(false)
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })
})

// ─── updateFavouriteClub ──────────────────────────────────────────────────────

describe('updateFavouriteClub', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Test 7: stores a valid club id against the session user', async () => {
    setAuthedUser()
    const chain = setupAdmin()
    const fd = new FormData()
    fd.set('favourite_club_id', CLUB_ID)

    const result = await updateFavouriteClub(fd)

    expect(result).toEqual({ success: true })
    expect(chain.update).toHaveBeenCalledWith({ favourite_club_id: CLUB_ID })
    expect(chain.eq).toHaveBeenCalledWith('user_id', USER_ID)
  })

  it('Test 8: empty string clears the pick', async () => {
    setAuthedUser()
    const chain = setupAdmin()
    const fd = new FormData()
    fd.set('favourite_club_id', '')

    const result = await updateFavouriteClub(fd)

    expect(result).toEqual({ success: true })
    expect(chain.update).toHaveBeenCalledWith({ favourite_club_id: null })
  })

  it('Test 9: a non-UUID value is rejected without writing', async () => {
    setAuthedUser()
    const chain = setupAdmin()
    const fd = new FormData()
    fd.set('favourite_club_id', 'arsenal')

    const result = await updateFavouriteClub(fd)

    expect(result.success).toBe(false)
    expect(chain.update).not.toHaveBeenCalled()
  })

  it('Test 10: a UUID that is not a real club is rejected without writing', async () => {
    setAuthedUser()
    const chain = setupAdmin({ clubExists: false })
    const fd = new FormData()
    fd.set('favourite_club_id', CLUB_ID)

    const result = await updateFavouriteClub(fd)

    expect(result.success).toBe(false)
    expect(chain.update).not.toHaveBeenCalled()
  })

  it('Test 11: unauthenticated caller returns Unauthorized', async () => {
    setUnauthenticated()
    const chain = setupAdmin()
    const fd = new FormData()
    fd.set('favourite_club_id', CLUB_ID)

    const result = await updateFavouriteClub(fd)

    expect(result).toEqual({ success: false, error: 'Unauthorized' })
    expect(chain.update).not.toHaveBeenCalled()
  })
})
