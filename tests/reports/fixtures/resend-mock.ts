/**
 * Shared Resend mock for Phase 10 tests.
 *
 * Every orchestration test in Plans 02-04 needs to assert the shape of
 * payloads handed to `resend.emails.send`. This factory returns a stub
 * client whose `.emails.send` records the full payload for later assertion.
 */
import { vi } from 'vitest'

export interface RecordedSend {
  from?: string
  to: string | string[]
  subject: string
  html: string
  attachments?: Array<{ filename: string; content: string | Buffer }>
}

export interface ResendMock {
  client: {
    emails: {
      send: ReturnType<typeof vi.fn>
    }
  }
  calls: RecordedSend[]
}

/**
 * Build a mock Resend client with payload-recording `.emails.send()`.
 *
 * Default behaviour: returns `{ data: { id: 'mock-id' }, error: null }`.
 * Override by passing a `returnValue` or by re-mocking after construction.
 */
export function createResendMock(
  returnValue: { data?: { id: string } | null; error?: unknown } = {
    data: { id: 'mock-id' },
    error: null,
  },
): ResendMock {
  const calls: RecordedSend[] = []
  const send = vi.fn(async (payload: RecordedSend) => {
    calls.push(payload)
    return returnValue
  })
  return {
    client: { emails: { send } },
    calls,
  }
}
