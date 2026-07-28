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
 * Sends the branded King Predictor login code to a member via Resend.
 *
 * Replaces Supabase's built-in auth email for the login-code flow so the
 * branding ("King Predictor"), sender name, and digit count are all under our
 * control — the Supabase hosted template can't be edited without dashboard
 * access. The code itself is produced by `supabase.auth.admin.generateLink`
 * in the requestMagicLink action and passed in here verbatim.
 */
export async function sendLoginCodeEmail({
  to,
  code,
  actionLink,
}: {
  to: string
  code: string
  /** Optional one-tap login link (from generateLink's action_link). */
  actionLink?: string
}): Promise<{ error?: string }> {
  const subject = 'Your King Predictor login code'
  const linkBlock = actionLink
    ? `
      <hr style="border:none;border-top:1px solid #2a2a3a;margin:28px 0" />
      <p style="color:#9aa0b4;font-size:14px;margin:0 0 6px">
        Or if you prefer, you can tap this link to log in:
      </p>
      <p style="margin:0">
        <a href="${actionLink}" style="color:#a855f7;font-size:16px;font-weight:600">Log me in</a>
      </p>`
    : ''

  const html = `
  <div style="background:#0b0b14;padding:32px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
    <div style="max-width:480px;margin:0 auto">
      <h1 style="color:#ffffff;font-size:22px;font-weight:800;margin:0 0 16px">
        Your King Predictor login code 👑
      </h1>
      <p style="color:#c7cbd8;font-size:16px;margin:0 0 20px">
        Hi — your 8-digit login code is:
      </p>
      <div style="background:#16161f;border:1px solid #2a2a3a;border-radius:12px;padding:20px;text-align:center;margin:0 0 20px">
        <span style="color:#ffffff;font-size:38px;font-weight:800;letter-spacing:10px;font-family:'Courier New',monospace">${code}</span>
      </div>
      <p style="color:#c7cbd8;font-size:15px;margin:0">
        Type this into the login screen on King Predictor. The code expires in 1 hour.
      </p>
      ${linkBlock}
      <p style="color:#6b7086;font-size:12px;margin:28px 0 0">
        Didn't request this? You can safely ignore this email.
      </p>
    </div>
  </div>`

  return sendEmail({ to, subject, html })
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
