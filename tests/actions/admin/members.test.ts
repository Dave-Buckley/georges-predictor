/**
 * Tests for admin member management actions, recovery actions, and auth action.
 *
 * All Supabase calls are mocked via tests/setup.ts.
 * Tests verify the contract of each server action — not the internals of Supabase.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabaseClient } from '../../setup'

// ─── Module mocks ─────────────────────────────────────────────────────────────

// Mock next/navigation (redirect throws in tests)
vi.mock('next/navigation', () => ({
  redirect: vi.fn().mockImplementation((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  }),
}))

// Mock createAdminClient — this is used by members.ts and recovery.ts for Supabase admin ops
const mockAdminClient = createMockSupabaseClient()
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mockAdminClient),
}))

// Mock createServerSupabaseClient — used for getUser() auth checks
const mockServerClient = createMockSupabaseClient()
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(() => mockServerClient),
}))

// Mock email utility
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn().mockResolvedValue({}),
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mockAdminUser(email = 'george@example.com') {
  mockServerClient.auth.getUser = vi.fn().mockResolvedValue({
    data: {
      user: {
        id: 'admin-user-id',
        app_metadata: { role: 'admin' },
        email,
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

// ─── approveMember ────────────────────────────────────────────────────────────

describe('approveMember', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminUser()

    // Mock from('members').select().eq().single() to return a member
    const memberChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'member-id',
          user_id: 'user-id-123',
          email: 'newmember@example.com',
          display_name: 'Test Member',
          approval_status: 'pending',
        },
        error: null,
      }),
      update: vi.fn().mockReturnThis(),
    }
    mockAdminClient.from = vi.fn().mockReturnValue(memberChain)
    mockAdminClient.auth.admin.inviteUserByEmail = vi.fn().mockResolvedValue({
      data: {},
      error: null,
    })
  })

  it('calls inviteUserByEmail with the member email', async () => {
    const { approveMember } = await import('@/actions/admin/members')
    await approveMember('member-id')
    expect(mockAdminClient.auth.admin.inviteUserByEmail).toHaveBeenCalledWith(
      'newmember@example.com',
      expect.objectContaining({ redirectTo: expect.stringContaining('/auth/callback') })
    )
  })

  it('returns { success: true } on success', async () => {
    const { approveMember } = await import('@/actions/admin/members')
    const result = await approveMember('member-id')
    expect(result).toEqual({ success: true })
  })

  it('returns error if caller is not admin', async () => {
    mockNonAdminUser()
    const { approveMember } = await import('@/actions/admin/members')
    const result = await approveMember('member-id')
    expect(result).toEqual({ error: expect.any(String) })
  })
})

// ─── rejectMember ─────────────────────────────────────────────────────────────

describe('rejectMember', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminUser()

    const memberChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'member-id',
          user_id: 'user-id-456',
          email: 'rejected@example.com',
          display_name: 'Rejected Member',
          approval_status: 'pending',
        },
        error: null,
      }),
      insert: vi.fn().mockResolvedValue({ data: {}, error: null }),
    }
    mockAdminClient.from = vi.fn().mockReturnValue(memberChain)
    mockAdminClient.auth.admin.deleteUser = vi.fn().mockResolvedValue({
      data: {},
      error: null,
    })
  })

  it('calls deleteUser with the correct user_id', async () => {
    const { rejectMember } = await import('@/actions/admin/members')
    await rejectMember('member-id', false)
    expect(mockAdminClient.auth.admin.deleteUser).toHaveBeenCalledWith('user-id-456')
  })

  it('sends a rejection email via Resend', async () => {
    const { rejectMember } = await import('@/actions/admin/members')
    const { sendEmail } = await import('@/lib/email')
    await rejectMember('member-id', false)
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'rejected@example.com',
        subject: expect.any(String),
        html: expect.any(String),
      })
    )
  })

  it('inserts into blocked_emails when blockEmail is true', async () => {
    const insertMock = vi.fn().mockResolvedValue({ data: {}, error: null })
    let blockedEmailsInsertCalled = false

    mockAdminClient.from = vi.fn().mockImplementation((table: string) => {
      if (table === 'members') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'member-id',
              user_id: 'user-id-456',
              email: 'rejected@example.com',
              display_name: 'Rejected Member',
              approval_status: 'pending',
            },
            error: null,
          }),
        }
      }
      if (table === 'blocked_emails') {
        blockedEmailsInsertCalled = true
        return { insert: insertMock }
      }
      return { insert: vi.fn().mockResolvedValue({ data: {}, error: null }) }
    })
    mockAdminClient.auth.admin.deleteUser = vi.fn().mockResolvedValue({ data: {}, error: null })

    const { rejectMember } = await import('@/actions/admin/members')
    await rejectMember('member-id', true)

    expect(blockedEmailsInsertCalled).toBe(true)
  })

  it('returns { success: true } on success', async () => {
    const { rejectMember } = await import('@/actions/admin/members')
    const result = await rejectMember('member-id', false)
    expect(result).toEqual({ success: true })
  })
})

// ─── addMember ────────────────────────────────────────────────────────────────

describe('addMember', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminUser()

    const memberChain = {
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: {}, error: null }),
    }
    mockAdminClient.from = vi.fn().mockReturnValue(memberChain)
    mockAdminClient.auth.admin.createUser = vi.fn().mockResolvedValue({
      data: { user: { id: 'new-user-id' } },
      error: null,
    })
    mockAdminClient.auth.admin.inviteUserByEmail = vi.fn().mockResolvedValue({
      data: {},
      error: null,
    })
  })

  it('creates auth user with email_confirm: true', async () => {
    const formData = new FormData()
    formData.set('display_name', 'New Member')
    formData.set('email', 'newmember@example.com')
    formData.set('starting_points', '10')

    const { addMember } = await import('@/actions/admin/members')
    await addMember(formData)

    expect(mockAdminClient.auth.admin.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'newmember@example.com',
        email_confirm: true,
      })
    )
  })

  it('returns { success: true } on success', async () => {
    const formData = new FormData()
    formData.set('display_name', 'New Member')
    formData.set('email', 'newmember@example.com')
    formData.set('starting_points', '0')

    const { addMember } = await import('@/actions/admin/members')
    const result = await addMember(formData)
    expect(result).toEqual({ success: true })
  })

  it('returns error for invalid form data', async () => {
    const formData = new FormData()
    formData.set('display_name', '')
    formData.set('email', 'not-an-email')
    formData.set('starting_points', '-5')

    const { addMember } = await import('@/actions/admin/members')
    const result = await addMember(formData)
    expect(result).toEqual({ error: expect.any(String) })
  })
})

// ─── addMember post-migration-007 (DATA-05 late joiner) ──────────────────────

describe('addMember post-migration-007 (DATA-05 late joiner)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminUser()

    const memberChain = {
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: {}, error: null }),
    }
    mockAdminClient.from = vi.fn().mockReturnValue(memberChain)
    mockAdminClient.auth.admin.createUser = vi.fn().mockResolvedValue({
      data: { user: { id: 'late-joiner-user-id' } },
      error: null,
    })
    mockAdminClient.auth.admin.inviteUserByEmail = vi.fn().mockResolvedValue({
      data: {},
      error: null,
    })
  })

  it('addMember with starting_points creates member with correct points', async () => {
    const updateMock = vi.fn().mockReturnThis()
    const eqMock = vi.fn().mockResolvedValue({ data: {}, error: null })

    mockAdminClient.from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      update: updateMock,
      eq: eqMock,
      single: vi.fn().mockResolvedValue({ data: {}, error: null }),
    })

    const formData = new FormData()
    formData.set('display_name', 'Late Joiner Steve')
    formData.set('email', 'latejoiner@example.com')
    formData.set('starting_points', '150')

    const { addMember } = await import('@/actions/admin/members')
    await addMember(formData)

    // Verify createUser was called (the member was created)
    expect(mockAdminClient.auth.admin.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'latejoiner@example.com',
        email_confirm: true,
      })
    )

    // Verify the members row was updated with the correct starting_points value
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        starting_points: 150,
        display_name: 'Late Joiner Steve',
      })
    )
  })

  it('addMember creates member that would appear in signup dropdown', async () => {
    const updateMock = vi.fn().mockReturnThis()
    const eqMock = vi.fn().mockResolvedValue({ data: {}, error: null })

    mockAdminClient.from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      update: updateMock,
      eq: eqMock,
      single: vi.fn().mockResolvedValue({ data: {}, error: null }),
    })

    const formData = new FormData()
    formData.set('display_name', 'Signup Visible Member')
    formData.set('email', 'visible@example.com')
    formData.set('starting_points', '200')

    const { addMember } = await import('@/actions/admin/members')
    await addMember(formData)

    // The members row update includes display_name — the same field the signup dropdown queries on.
    // This confirms late-joiner names are treated identically to imported placeholder names
    // for the purpose of the signup dropdown (both are in the members table with a display_name).
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        display_name: 'Signup Visible Member',
        approval_status: 'approved',
      })
    )
  })
})

// ─── removeMember ─────────────────────────────────────────────────────────────

describe('removeMember', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminUser()

    const memberChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'member-id', user_id: 'user-id-789' },
        error: null,
      }),
    }
    mockAdminClient.from = vi.fn().mockReturnValue(memberChain)
    mockAdminClient.auth.admin.deleteUser = vi.fn().mockResolvedValue({
      data: {},
      error: null,
    })
  })

  it('calls deleteUser with the correct user_id', async () => {
    const { removeMember } = await import('@/actions/admin/members')
    await removeMember('member-id')
    expect(mockAdminClient.auth.admin.deleteUser).toHaveBeenCalledWith('user-id-789')
  })

  it('returns { success: true } on success', async () => {
    const { removeMember } = await import('@/actions/admin/members')
    const result = await removeMember('member-id')
    expect(result).toEqual({ success: true })
  })

  it('returns error if caller is not admin', async () => {
    mockNonAdminUser()
    const { removeMember } = await import('@/actions/admin/members')
    const result = await removeMember('member-id')
    expect(result).toEqual({ error: expect.any(String) })
  })
})

// ─── Admin auth guard ─────────────────────────────────────────────────────────

describe('admin auth guard', () => {
  it('rejects non-admin callers on setMemberStartingPoints', async () => {
    vi.clearAllMocks()
    mockNonAdminUser()
    const { setMemberStartingPoints } = await import('@/actions/admin/members')
    const result = await setMemberStartingPoints('member-id', 50)
    expect(result).toEqual({ error: expect.any(String) })
  })

  it('rejects unauthenticated callers', async () => {
    vi.clearAllMocks()
    mockServerClient.auth.getUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: null,
    })
    const { removeMember } = await import('@/actions/admin/members')
    const result = await removeMember('member-id')
    expect(result).toEqual({ error: expect.any(String) })
  })
})

// ─── setSecurityQuestion ──────────────────────────────────────────────────────
// Note: recovery.ts uses createAdminClient() for DB operations

describe('setSecurityQuestion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminUser()
  })

  it('upserts into admin_security_questions', async () => {
    const upsertMock = vi.fn().mockResolvedValue({ data: {}, error: null })
    mockAdminClient.from = vi.fn().mockReturnValue({ upsert: upsertMock })

    const formData = new FormData()
    formData.set('question', 'What is the name of your first pet?')
    formData.set('answer', 'Fluffy')

    const { setSecurityQuestion } = await import('@/actions/admin/recovery')
    const result = await setSecurityQuestion(formData)
    expect(result).toEqual({ success: true })

    const fromCalls = (mockAdminClient.from as ReturnType<typeof vi.fn>).mock.calls
    const secQCall = fromCalls.some(([table]: [string]) => table === 'admin_security_questions')
    expect(secQCall).toBe(true)
  })

  it('stores a hashed answer (not plaintext)', async () => {
    const upsertMock = vi.fn().mockResolvedValue({ data: {}, error: null })
    mockAdminClient.from = vi.fn().mockReturnValue({ upsert: upsertMock })

    const formData = new FormData()
    formData.set('question', 'What is your mother\'s maiden name?')
    formData.set('answer', 'Smith')

    const { setSecurityQuestion } = await import('@/actions/admin/recovery')
    await setSecurityQuestion(formData)

    const upsertArg = upsertMock.mock.calls[0][0]
    // The stored answer should not be the plaintext answer
    expect(upsertArg.answer_hash).not.toBe('Smith')
    expect(upsertArg.answer_hash).not.toBe('smith')
    // Should be a hex string (SHA-256)
    expect(upsertArg.answer_hash).toMatch(/^[a-f0-9]{64}$/)
  })
})

// ─── verifySecurityAnswer ─────────────────────────────────────────────────────

describe('verifySecurityAnswer', () => {
  it('returns { verified: true } for correct answer', async () => {
    vi.clearAllMocks()
    mockAdminUser()

    // Compute the hash of "Fluffy" (normalised: "fluffy")
    const encoder = new TextEncoder()
    const data = encoder.encode('fluffy')
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const correctHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

    mockAdminClient.from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { answer_hash: correctHash },
        error: null,
      }),
    })

    const { verifySecurityAnswer } = await import('@/actions/admin/recovery')
    const result = await verifySecurityAnswer('admin-user-id', 'Fluffy')
    expect(result).toEqual({ verified: true })
  })

  it('returns { verified: false } for wrong answer', async () => {
    vi.clearAllMocks()
    mockAdminUser()

    // Compute hash of "correctanswer"
    const encoder = new TextEncoder()
    const data = encoder.encode('correctanswer')
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const correctHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

    mockAdminClient.from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { answer_hash: correctHash },
        error: null,
      }),
    })

    const { verifySecurityAnswer } = await import('@/actions/admin/recovery')
    const result = await verifySecurityAnswer('admin-user-id', 'wronganswer')
    expect(result).toEqual({ verified: false })
  })
})

// ─── resetOtherAdminEmail ─────────────────────────────────────────────────────

describe('resetOtherAdminEmail', () => {
  it('rejects if caller tries to reset their own email', async () => {
    vi.clearAllMocks()
    mockAdminUser('george@example.com')

    const formData = new FormData()
    formData.set('target_admin_email', 'george@example.com') // same as caller
    formData.set('security_answer', 'someAnswer')
    formData.set('new_email', 'newemail@example.com')

    const { resetOtherAdminEmail } = await import('@/actions/admin/recovery')
    const result = await resetOtherAdminEmail(formData)
    expect(result).toEqual({ error: expect.any(String) })
  })

  it('updates the other admin email when security answer is correct', async () => {
    vi.clearAllMocks()
    mockAdminUser('george@example.com')

    // Compute hash of "daveanswer"
    const encoder = new TextEncoder()
    const data = encoder.encode('daveanswer')
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const daveHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

    // listUsers returns Dave
    mockAdminClient.auth.admin.listUsers = vi.fn().mockResolvedValue({
      data: {
        users: [
          { id: 'dave-user-id', email: 'dave@example.com', app_metadata: { role: 'admin' } },
        ],
      },
      error: null,
    })
    mockAdminClient.auth.admin.updateUserById = vi.fn().mockResolvedValue({
      data: { user: {} },
      error: null,
    })

    // admin_security_questions returns Dave's hash
    mockAdminClient.from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { answer_hash: daveHash },
        error: null,
      }),
    })

    const formData = new FormData()
    formData.set('target_admin_email', 'dave@example.com')
    formData.set('security_answer', 'daveAnswer') // will be normalised to "daveanswer"
    formData.set('new_email', 'dave-new@example.com')

    const { resetOtherAdminEmail } = await import('@/actions/admin/recovery')
    const result = await resetOtherAdminEmail(formData)
    expect(result).toEqual({ success: true })
    expect(mockAdminClient.auth.admin.updateUserById).toHaveBeenCalledWith(
      'dave-user-id',
      { email: 'dave-new@example.com' }
    )
  })

  it('returns error when security answer is wrong', async () => {
    vi.clearAllMocks()
    mockAdminUser('george@example.com')

    // Compute hash of "correctanswer"
    const encoder = new TextEncoder()
    const data = encoder.encode('correctanswer')
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const correctHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

    mockAdminClient.auth.admin.listUsers = vi.fn().mockResolvedValue({
      data: {
        users: [
          { id: 'dave-user-id', email: 'dave@example.com', app_metadata: { role: 'admin' } },
        ],
      },
      error: null,
    })

    mockAdminClient.from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { answer_hash: correctHash },
        error: null,
      }),
    })

    const formData = new FormData()
    formData.set('target_admin_email', 'dave@example.com')
    formData.set('security_answer', 'wronganswer')
    formData.set('new_email', 'dave-new@example.com')

    const { resetOtherAdminEmail } = await import('@/actions/admin/recovery')
    const result = await resetOtherAdminEmail(formData)
    expect(result).toEqual({ error: 'Security answer incorrect' })
  })
})
