import { getResend, DEFAULT_FROM } from './email/client'

interface SendEmailOptions {
  to: string
  subject: string
  html: string
}

/**
 * Sends a transactional email via Resend.
 * Returns { error } if sending failed, or empty object on success.
 *
 * Refactored in Phase 10 to route through the shared getResend() singleton
 * so the client instance is reused across callers (sendEmail, sendWithAttachments,
 * future report orchestrators).
 */
export async function sendEmail({
  to,
  subject,
  html,
}: SendEmailOptions): Promise<{ error?: string }> {
  const resend = getResend()
  if (!resend) {
    console.warn('[sendEmail] RESEND_API_KEY not configured — skipping send')
    return { error: 'RESEND_API_KEY not configured' }
  }

  const { error } = await resend.emails.send({
    from: DEFAULT_FROM,
    to,
    subject,
    html,
  })

  if (error) {
    console.error('[sendEmail] Resend error:', error)
    return { error: typeof error === 'string' ? error : 'Failed to send email' }
  }

  return {}
}

/**
 * Notifies George when a new member signs up.
 * Called by the signup server action.
 */
export async function sendAdminSignupNotification({
  displayName,
  email,
}: {
  displayName: string
  email: string
}): Promise<{ error?: string }> {
  const adminEmail = process.env.ADMIN_EMAIL_GEORGE
  if (!adminEmail) {
    console.warn('[sendAdminSignupNotification] ADMIN_EMAIL_GEORGE not set — skipping')
    return {}
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  return sendEmail({
    to: adminEmail,
    subject: `New signup waiting for approval: ${displayName}`,
    html: `
      <p>Hi George,</p>
      <p><strong>${displayName}</strong> (${email}) has just signed up and is waiting for your approval.</p>
      <p><a href="${appUrl}/admin/members?filter=pending">Review pending approvals</a></p>
    `,
  })
}
