/**
 * Attachment-aware Resend send helper.
 *
 * Resend expects attachment `content` as a base64 **string**; callers pass
 * Node Buffers for ergonomic reasons (PDFs, XLSX buffers are always Buffers
 * in Node). This helper does the conversion at the edge so every caller
 * doesn't have to remember.
 *
 * Graceful degradation: if RESEND_API_KEY isn't set, we log a warning and
 * return an error object instead of throwing — mirrors the contract that
 * Phase 1's sendEmail established for local dev without Resend creds.
 */
import { getResend, DEFAULT_FROM } from './client'

export interface EmailAttachment {
  filename: string
  /** Raw binary content. Helper handles base64 conversion. */
  content: Buffer
}

export interface SendWithAttachmentsInput {
  to: string | string[]
  subject: string
  html: string
  attachments?: EmailAttachment[]
  /** Optional override; defaults to DEFAULT_FROM. */
  from?: string
}

export interface SendWithAttachmentsResult {
  id?: string
  error?: string
}

export async function sendWithAttachments(
  input: SendWithAttachmentsInput,
): Promise<SendWithAttachmentsResult> {
  const resend = getResend()
  if (!resend) {
    console.warn(
      '[sendWithAttachments] RESEND_API_KEY not configured — skipping send',
    )
    return { error: 'RESEND_API_KEY not configured' }
  }

  const payloadAttachments = input.attachments?.map((a) => ({
    filename: a.filename,
    content: a.content.toString('base64'),
  }))

  const { data, error } = await resend.emails.send({
    from: input.from ?? DEFAULT_FROM,
    to: input.to,
    subject: input.subject,
    html: input.html,
    attachments: payloadAttachments,
  })

  if (error) {
    const msg =
      typeof error === 'string'
        ? error
        : ((error as { message?: string })?.message ?? 'Failed to send email')
    console.error('[sendWithAttachments] Resend error:', error)
    return { error: msg }
  }

  return { id: data?.id }
}
