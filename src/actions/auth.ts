'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { signupSchema, loginSchema } from '@/lib/validators/auth'
import { sendAdminSignupNotification } from '@/lib/email'

// ─── Sign Up Member ───────────────────────────────────────────────────────────

/**
 * Registers a new member via Supabase magic link (OTP with shouldCreateUser: true).
 * The DB trigger handles creating the members row and admin notification.
 * This action also fires an email notification to George via Resend.
 */
export async function signUpMember(
  formData: FormData
): Promise<{ success?: boolean; error?: string }> {
  const raw = {
    display_name: formData.get('display_name'),
    email: formData.get('email'),
    is_new_member: formData.get('is_new_member') === 'true',
    email_opt_in: formData.get('email_opt_in') !== 'false',
  }

  const result = signupSchema.safeParse(raw)
  if (!result.success) {
    const firstError = result.error.issues[0]?.message ?? 'Invalid input'
    return { error: firstError }
  }

  const { display_name, email, email_opt_in } = result.data

  const supabase = await createServerSupabaseClient()

  // Check if email is blocked
  const { data: blockedRows } = await supabase
    .from('blocked_emails')
    .select('email')
    .eq('email', email)

  if (blockedRows && blockedRows.length > 0) {
    return { error: 'This email address cannot be used for registration' }
  }

  // Sign up via magic link OTP — creates auth.users record + triggers members row creation
  const { error: otpError } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      data: {
        display_name,
        email_opt_in,
      },
    },
  })

  if (otpError) {
    console.error('[signUpMember] Supabase OTP error:', otpError.message)
    return { error: 'Something went wrong. Please try again.' }
  }

  // Fire-and-forget: email George. If Resend fails, signup still succeeds.
  // The admin_notifications row (from DB trigger) is the backup notification.
  sendAdminSignupNotification({
    displayName: display_name,
    email,
  }).catch((err) => {
    console.error('[signUpMember] Failed to send admin notification:', err)
  })

  return { success: true }
}

// ─── Request Magic Link ───────────────────────────────────────────────────────

/**
 * Sends a magic link to an existing member's email address for login.
 * Uses shouldCreateUser: false — will fail silently if the email isn't registered
 * (Supabase doesn't expose whether the email exists for security).
 */
export async function requestMagicLink(
  formData: FormData
): Promise<{ success?: boolean; error?: string }> {
  const raw = {
    email: formData.get('email'),
  }

  const result = loginSchema.safeParse(raw)
  if (!result.success) {
    const firstError = result.error.issues[0]?.message ?? 'Invalid email'
    return { error: firstError }
  }

  const { email } = result.data

  const supabase = await createServerSupabaseClient()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const { error: otpError } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${appUrl}/auth/callback?next=/dashboard`,
    },
  })

  if (otpError) {
    console.error('[requestMagicLink] Supabase OTP error:', otpError.message)
    // Supabase returns a generic error if the email is not registered.
    // Surface a helpful message to the member.
    return { error: 'No account found with this email. Have you signed up?' }
  }

  return { success: true }
}
