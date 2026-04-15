'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  signupSchema,
  loginSchema,
  passwordLoginSchema,
} from '@/lib/validators/auth'
import { sendAdminSignupNotification } from '@/lib/email'

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[\s\-_.'’"]/g, '')
}

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

  const { display_name, email, email_opt_in, is_new_member, password } =
    result.data

  const supabase = await createServerSupabaseClient()

  // Check if email is blocked
  const { data: blockedRows } = await supabase
    .from('blocked_emails')
    .select('email')
    .eq('email', email)

  if (blockedRows && blockedRows.length > 0) {
    return { error: 'This email address cannot be used for registration' }
  }

  // Duplicate-name guard for "I'm new" signups: if the typed name matches
  // (after stripping spaces/punctuation, case-insensitive) any existing
  // member or placeholder, assume the user should have picked from the list
  // instead. Prevents the Stuart Lenton / Stu split we hit on day one.
  if (is_new_member) {
    const admin = createAdminClient()
    const { data: existingNames } = await admin
      .from('members')
      .select('display_name')
    const needle = normalizeName(display_name)
    const match = (existingNames ?? []).find(
      (m: { display_name: string }) =>
        normalizeName(m.display_name) === needle,
    ) as { display_name: string } | undefined
    if (match) {
      return {
        error: `"${match.display_name}" already exists in the league. If that's you, go back and pick your name from the list. Otherwise, pick a different name.`,
      }
    }
  }

  // Password path (optional): creates an auth user with a password. Email
  // confirmation is still required, but the user can log in with email+password
  // afterwards instead of waiting on magic links every time.
  if (password) {
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name, email_opt_in },
      },
    })
    if (signUpError) {
      console.error('[signUpMember] signUp error:', signUpError.message)
      return { error: 'Something went wrong. Please try again.' }
    }
  } else {
    // Magic-link OTP path — creates auth.users record + triggers members row creation
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        data: { display_name, email_opt_in },
      },
    })
    if (otpError) {
      console.error('[signUpMember] Supabase OTP error:', otpError.message)
      return { error: 'Something went wrong. Please try again.' }
    }
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

// ─── Login With Password ──────────────────────────────────────────────────────

/**
 * Logs a member in with email + password. Alternative to the magic-link flow
 * for members who set a password during signup (or later via /profile).
 */
export async function loginWithPassword(
  formData: FormData,
): Promise<{ success?: boolean; error?: string }> {
  const raw = {
    email: formData.get('email'),
    password: formData.get('password'),
  }

  const result = passwordLoginSchema.safeParse(raw)
  if (!result.success) {
    const firstError = result.error.issues[0]?.message ?? 'Invalid input'
    return { error: firstError }
  }

  const { email, password } = result.data
  const supabase = await createServerSupabaseClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    console.error('[loginWithPassword] error:', error.message)
    return { error: 'Email or password is incorrect.' }
  }

  return { success: true }
}
