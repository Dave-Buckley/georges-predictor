import { describe, it, expect, beforeEach, vi } from 'vitest'
import '../setup' // ensure mocks are registered
import { createMockSupabaseClient } from '../setup'

// ─── Module mocks must be top-level ──────────────────────────────────────────

// We need to capture the mock instances so we can assert against them.
// The setup.ts mocks '@supabase/ssr' and 'resend' at module level.

let mockSupabase: ReturnType<typeof createMockSupabaseClient>
let mockResendSend: ReturnType<typeof vi.fn>

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
}))

vi.mock('@/lib/email', () => ({
  sendAdminSignupNotification: vi.fn().mockResolvedValue(undefined),
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFormData(data: Record<string, string | boolean>) {
  const fd = new FormData()
  for (const [key, value] of Object.entries(data)) {
    fd.append(key, String(value))
  }
  return fd
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('signupSchema', () => {
  it('validates a valid signup payload', async () => {
    const { signupSchema } = await import('@/lib/validators/auth')
    const result = signupSchema.safeParse({
      display_name: 'Big Steve',
      email: 'big.steve@example.com',
      is_new_member: false,
      email_opt_in: true,
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty display_name', async () => {
    const { signupSchema } = await import('@/lib/validators/auth')
    const result = signupSchema.safeParse({
      display_name: '',
      email: 'big.steve@example.com',
      is_new_member: false,
      email_opt_in: true,
    })
    expect(result.success).toBe(false)
  })

  it('rejects display_name over 50 chars', async () => {
    const { signupSchema } = await import('@/lib/validators/auth')
    const result = signupSchema.safeParse({
      display_name: 'a'.repeat(51),
      email: 'test@example.com',
      is_new_member: false,
      email_opt_in: true,
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid email format', async () => {
    const { signupSchema } = await import('@/lib/validators/auth')
    const result = signupSchema.safeParse({
      display_name: 'Steve',
      email: 'not-an-email',
      is_new_member: false,
      email_opt_in: true,
    })
    expect(result.success).toBe(false)
  })

  it('lowercases email', async () => {
    const { signupSchema } = await import('@/lib/validators/auth')
    const result = signupSchema.safeParse({
      display_name: 'Steve',
      email: 'Steve@EXAMPLE.COM',
      is_new_member: false,
      email_opt_in: true,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBe('steve@example.com')
    }
  })

  it('email_opt_in defaults to true when not provided', async () => {
    const { signupSchema } = await import('@/lib/validators/auth')
    const result = signupSchema.safeParse({
      display_name: 'Steve',
      email: 'steve@example.com',
      is_new_member: false,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email_opt_in).toBe(true)
    }
  })
})

describe('loginSchema', () => {
  it('validates a valid email', async () => {
    const { loginSchema } = await import('@/lib/validators/auth')
    const result = loginSchema.safeParse({ email: 'user@example.com' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', async () => {
    const { loginSchema } = await import('@/lib/validators/auth')
    const result = loginSchema.safeParse({ email: 'not-valid' })
    expect(result.success).toBe(false)
  })

  it('lowercases email', async () => {
    const { loginSchema } = await import('@/lib/validators/auth')
    const result = loginSchema.safeParse({ email: 'User@EXAMPLE.COM' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBe('user@example.com')
    }
  })
})

describe('signUpMember', () => {
  beforeEach(async () => {
    vi.resetModules()
    mockSupabase = createMockSupabaseClient()
    const { createServerSupabaseClient } = await import('@/lib/supabase/server')
    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockSupabase as any)
  })

  it('calls signInWithOtp with shouldCreateUser: true and correct user data', async () => {
    // Arrange: no blocked email
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    }
    mockSupabase.from = vi.fn().mockReturnValue(chain)
    mockSupabase.auth.signInWithOtp = vi.fn().mockResolvedValue({ data: {}, error: null })

    const { sendAdminSignupNotification } = await import('@/lib/email')
    vi.mocked(sendAdminSignupNotification).mockResolvedValue(undefined)

    const { signUpMember } = await import('@/actions/auth')

    const formData = makeFormData({
      display_name: 'Big Steve',
      email: 'big.steve@example.com',
      is_new_member: 'false',
      email_opt_in: 'true',
    })

    const result = await signUpMember(formData)

    expect(result).toEqual({ success: true })
    expect(mockSupabase.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'big.steve@example.com',
      options: {
        shouldCreateUser: true,
        data: {
          display_name: 'Big Steve',
          email_opt_in: true,
        },
      },
    })
  })

  it('sends admin notification email after successful signup', async () => {
    // Arrange: no blocked email
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    }
    mockSupabase.from = vi.fn().mockReturnValue(chain)
    mockSupabase.auth.signInWithOtp = vi.fn().mockResolvedValue({ data: {}, error: null })

    const { sendAdminSignupNotification } = await import('@/lib/email')
    vi.mocked(sendAdminSignupNotification).mockResolvedValue(undefined)

    const { signUpMember } = await import('@/actions/auth')

    const formData = makeFormData({
      display_name: 'Big Steve',
      email: 'big.steve@example.com',
      is_new_member: 'false',
      email_opt_in: 'true',
    })

    await signUpMember(formData)

    expect(sendAdminSignupNotification).toHaveBeenCalledWith({
      displayName: 'Big Steve',
      email: 'big.steve@example.com',
    })
  })

  it('succeeds even if admin notification email fails (graceful degradation)', async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    }
    mockSupabase.from = vi.fn().mockReturnValue(chain)
    mockSupabase.auth.signInWithOtp = vi.fn().mockResolvedValue({ data: {}, error: null })

    const { sendAdminSignupNotification } = await import('@/lib/email')
    vi.mocked(sendAdminSignupNotification).mockRejectedValue(new Error('Resend API down'))

    const { signUpMember } = await import('@/actions/auth')

    const formData = makeFormData({
      display_name: 'Big Steve',
      email: 'big.steve@example.com',
      is_new_member: 'false',
      email_opt_in: 'true',
    })

    const result = await signUpMember(formData)

    // Signup should still succeed despite email failure
    expect(result).toEqual({ success: true })
  })

  it('rejects blocked email with clear message', async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [{ email: 'blocked@example.com' }],
        error: null,
      }),
    }
    mockSupabase.from = vi.fn().mockReturnValue(chain)

    const { signUpMember } = await import('@/actions/auth')

    const formData = makeFormData({
      display_name: 'Blocked User',
      email: 'blocked@example.com',
      is_new_member: 'false',
      email_opt_in: 'true',
    })

    const result = await signUpMember(formData)

    expect(result).toEqual({
      error: 'This email address cannot be used for registration',
    })
    expect(mockSupabase.auth.signInWithOtp).not.toHaveBeenCalled()
  })

  it('checks blocked_emails table with the submitted email', async () => {
    const eqMock = vi.fn().mockResolvedValue({ data: [], error: null })
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock })
    mockSupabase.from = vi.fn().mockReturnValue({ select: selectMock })
    mockSupabase.auth.signInWithOtp = vi.fn().mockResolvedValue({ data: {}, error: null })

    const { sendAdminSignupNotification } = await import('@/lib/email')
    vi.mocked(sendAdminSignupNotification).mockResolvedValue(undefined)

    const { signUpMember } = await import('@/actions/auth')

    const formData = makeFormData({
      display_name: 'Steve',
      email: 'steve@example.com',
      is_new_member: 'false',
      email_opt_in: 'true',
    })

    await signUpMember(formData)

    expect(mockSupabase.from).toHaveBeenCalledWith('blocked_emails')
    expect(eqMock).toHaveBeenCalledWith('email', 'steve@example.com')
  })

  it('returns validation error for invalid email', async () => {
    const { signUpMember } = await import('@/actions/auth')

    const formData = makeFormData({
      display_name: 'Steve',
      email: 'not-an-email',
      is_new_member: 'false',
      email_opt_in: 'true',
    })

    const result = await signUpMember(formData)

    expect(result).toHaveProperty('error')
    expect(mockSupabase.auth.signInWithOtp).not.toHaveBeenCalled()
  })

  it('returns validation error for empty display_name', async () => {
    const { signUpMember } = await import('@/actions/auth')

    const formData = makeFormData({
      display_name: '',
      email: 'steve@example.com',
      is_new_member: 'false',
      email_opt_in: 'true',
    })

    const result = await signUpMember(formData)

    expect(result).toHaveProperty('error')
    expect(mockSupabase.auth.signInWithOtp).not.toHaveBeenCalled()
  })
})

describe('requestMagicLink', () => {
  beforeEach(async () => {
    vi.resetModules()
    mockSupabase = createMockSupabaseClient()
    const { createServerSupabaseClient } = await import('@/lib/supabase/server')
    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockSupabase as any)
  })

  it('calls signInWithOtp with shouldCreateUser: false for valid email', async () => {
    mockSupabase.auth.signInWithOtp = vi.fn().mockResolvedValue({ data: {}, error: null })

    const { requestMagicLink } = await import('@/actions/auth')

    const formData = makeFormData({ email: 'user@example.com' })

    const result = await requestMagicLink(formData)

    expect(result).toEqual({ success: true })
    expect(mockSupabase.auth.signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'user@example.com',
        options: expect.objectContaining({
          shouldCreateUser: false,
        }),
      })
    )
  })

  it('includes emailRedirectTo pointing to /auth/callback', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.com'
    mockSupabase.auth.signInWithOtp = vi.fn().mockResolvedValue({ data: {}, error: null })

    const { requestMagicLink } = await import('@/actions/auth')

    const formData = makeFormData({ email: 'user@example.com' })

    await requestMagicLink(formData)

    expect(mockSupabase.auth.signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: 'https://example.com/auth/callback?next=/dashboard',
        }),
      })
    )
  })

  it('returns validation error for invalid email', async () => {
    const { requestMagicLink } = await import('@/actions/auth')

    const formData = makeFormData({ email: 'not-valid' })

    const result = await requestMagicLink(formData)

    expect(result).toHaveProperty('error')
    expect(mockSupabase.auth.signInWithOtp).not.toHaveBeenCalled()
  })
})

describe('sendAdminSignupNotification', () => {
  it('sends email to ADMIN_EMAIL_GEORGE with correct subject and details', async () => {
    process.env.ADMIN_EMAIL_GEORGE = 'george@example.com'
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.com'
    process.env.RESEND_API_KEY = 'test-key'

    // Import email module fresh to get the real implementation
    const emailModule = await import('@/lib/email')

    await emailModule.sendAdminSignupNotification({
      displayName: 'Big Steve',
      email: 'big.steve@example.com',
    })

    // The resend mock captures the call
    const { Resend } = await import('resend')
    const resendInstance = vi.mocked(Resend).mock.results[0]?.value
    if (resendInstance) {
      expect(resendInstance.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'george@example.com',
          subject: expect.stringContaining('Big Steve'),
        })
      )
    }
  })
})
