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
 * Notifies both admins (George + Dave) when a new member signs up.
 * Called by the signup server action.
 */
export async function sendAdminSignupNotification({
  displayName,
  email,
}: {
  displayName: string
  email: string
}): Promise<{ error?: string }> {
  const admins = [
    process.env.ADMIN_EMAIL_GEORGE,
    process.env.ADMIN_EMAIL_DAVE,
  ].filter((x): x is string => Boolean(x))

  if (admins.length === 0) {
    console.warn('[sendAdminSignupNotification] No admin emails configured — skipping')
    return {}
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const subject = `New signup waiting for approval: ${displayName}`
  const html = `
      <p>Hi,</p>
      <p><strong>${displayName}</strong> (${email}) has just signed up and is waiting for approval.</p>
      <p><a href="${appUrl}/admin/members?filter=pending">Review pending approvals</a></p>
    `

  const results = await Promise.all(
    admins.map((to) => sendEmail({ to, subject, html })),
  )
  const firstError = results.find((r) => r.error)
  return firstError ?? {}
}
