import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

interface SendEmailOptions {
  to: string
  subject: string
  html: string
}

/**
 * Sends a transactional email via Resend.
 * Returns { error } if sending failed, or empty object on success.
 */
export async function sendEmail({
  to,
  subject,
  html,
}: SendEmailOptions): Promise<{ error?: string }> {
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "George's Predictor <noreply@georges-predictor.com>",
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
