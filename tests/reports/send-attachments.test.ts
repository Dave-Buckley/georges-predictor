/**
 * Tests for the Resend attachment-send helper.
 *
 * Focus: base64 conversion, missing-key graceful fallback, pass-through
 * of sender / subject / html / to.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Re-mock resend on a per-test basis so we can swap in the payload recorder.
vi.mock('resend', () => ({
  Resend: vi.fn(),
}))

import { Resend } from 'resend'
import { createResendMock } from './fixtures/resend-mock'

describe('sendWithAttachments', () => {
  const ORIGINAL_ENV = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env = { ...ORIGINAL_ENV }
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  it('converts Buffer content → base64 string before calling Resend', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    const mock = createResendMock()
    ;(Resend as unknown as ReturnType<typeof vi.fn>).mockImplementation(function (
      this: unknown,
    ) {
      Object.assign(this as object, mock.client)
    })

    const { sendWithAttachments } = await import('@/lib/email/send-attachments')

    const buf = Buffer.from('hello-world', 'utf8')
    const result = await sendWithAttachments({
      to: 'a@b.com',
      subject: 'Hi',
      html: '<p>x</p>',
      attachments: [{ filename: 'report.pdf', content: buf }],
    })

    expect(result.id).toBe('mock-id')
    expect(mock.calls).toHaveLength(1)
    const sent = mock.calls[0]
    expect(sent.attachments).toHaveLength(1)
    expect(sent.attachments![0].filename).toBe('report.pdf')
    // base64 of "hello-world" is "aGVsbG8td29ybGQ="
    expect(sent.attachments![0].content).toBe('aGVsbG8td29ybGQ=')
    // to/subject/html pass-through
    expect(sent.to).toBe('a@b.com')
    expect(sent.subject).toBe('Hi')
    expect(sent.html).toBe('<p>x</p>')
  })

  it('returns graceful error when RESEND_API_KEY is unset (no throw)', async () => {
    delete process.env.RESEND_API_KEY
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { sendWithAttachments } = await import('@/lib/email/send-attachments')
    const result = await sendWithAttachments({
      to: 'a@b.com',
      subject: 'Hi',
      html: '<p>x</p>',
    })

    expect(result.error).toBe('RESEND_API_KEY not configured')
    expect(result.id).toBeUndefined()
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('supports multiple attachments with mixed content types', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    const mock = createResendMock()
    ;(Resend as unknown as ReturnType<typeof vi.fn>).mockImplementation(function (
      this: unknown,
    ) {
      Object.assign(this as object, mock.client)
    })

    const { sendWithAttachments } = await import('@/lib/email/send-attachments')

    await sendWithAttachments({
      to: ['a@b.com', 'c@d.com'],
      subject: 'Multi',
      html: '<p>multi</p>',
      attachments: [
        { filename: 'a.pdf', content: Buffer.from('aaa') },
        { filename: 'b.xlsx', content: Buffer.from('bbbb') },
      ],
    })

    expect(mock.calls[0].attachments).toHaveLength(2)
    expect(mock.calls[0].to).toEqual(['a@b.com', 'c@d.com'])
  })

  it('returns error string when Resend returns an error', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    const mock = createResendMock({
      data: null,
      error: { message: 'rate limit exceeded' },
    })
    ;(Resend as unknown as ReturnType<typeof vi.fn>).mockImplementation(function (
      this: unknown,
    ) {
      Object.assign(this as object, mock.client)
    })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { sendWithAttachments } = await import('@/lib/email/send-attachments')

    const result = await sendWithAttachments({
      to: 'a@b.com',
      subject: 'X',
      html: '<p>x</p>',
    })
    expect(result.error).toBe('rate limit exceeded')
    expect(result.id).toBeUndefined()
    errorSpy.mockRestore()
  })
})

describe('getResend / DEFAULT_FROM', () => {
  const ORIGINAL_ENV = { ...process.env }
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env = { ...ORIGINAL_ENV }
  })
  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  it('getResend returns null when RESEND_API_KEY is unset', async () => {
    delete process.env.RESEND_API_KEY
    const { getResend } = await import('@/lib/email/client')
    expect(getResend()).toBeNull()
  })

  it('DEFAULT_FROM prefers EMAIL_FROM env when set', async () => {
    process.env.EMAIL_FROM = "Override <override@x.com>"
    const { DEFAULT_FROM } = await import('@/lib/email/client')
    expect(DEFAULT_FROM).toBe("Override <override@x.com>")
  })
})
