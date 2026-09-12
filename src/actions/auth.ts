'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  signupSchema,
  loginSchema,
  passwordLoginSchema,
  verifyLoginCodeSchema,
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

/** Escapes LIKE wildcards so an email containing `_` or `%` matches literally. */
function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, '\\$&')
}

/**
 * Is this email on the members list? Returns null when the lookup itself
 * fails, so the caller falls back to just trying to send the code rather than
 * wrongly telling a real member they don't exist.
 */
async function memberExistsForEmail(email: string): Promise<boolean | null> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('members')
      .select('id')
      .ilike('email', escapeLike(email))
      .limit(1)
      .maybeSingle()
    if (error) {
      console.error('[requestMagicLink] member lookup error:', error.message)
      return null
    }
    return !!data
  } catch (err) {
    console.error('[requestMagicLink] member lookup threw:', err)
    return null
  }
}

/**
 * Emails a login code to an existing member.
 *
 * "No account found" is ONLY shown when the email genuinely isn't on the
 * members list. It used to be shown for every Supabase send failure, so a real
 * member whose code email failed (Stu, 12 Sep 2026) was told he didn't exist.
 * A failed send now says so and returns `sendFailed`, so the form can offer the
 * other ways in (password, or a login link from George).
 */
export async function requestMagicLink(
  formData: FormData
): Promise<{ success?: boolean; error?: string; sendFailed?: boolean }> {
  const raw = {
    email: formData.get('email'),
  }

  const result = loginSchema.safeParse(raw)
  if (!result.success) {
    const firstError = result.error.issues[0]?.message ?? 'Invalid email'
    return { error: firstError }
  }

  const { email } = result.data

  if ((await memberExistsForEmail(email)) === false) {
    return {
      error:
        'No account found with this email. Check it is spelt correctly — or join the competition below.',
    }
  }

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

    // Supabase rate-limits code requests to one per 60 seconds per email.
    // Members who tap "send code" twice (very common — the first email takes a
    // few seconds to land) were being told "No account found", which reads as
    // "you don't exist" and sends them to George in a panic. Tell them the
    // truth instead: the code is already on its way.
    const msg = otpError.message.toLowerCase()
    if (
      otpError.status === 429 ||
      msg.includes('rate limit') ||
      msg.includes('after')
    ) {
      return {
        error:
          'A code is already on its way — check your inbox (and spam folder). If it still has not arrived, wait a minute and try again.',
      }
    }

    // The email is a real member (checked above) — the send itself failed.
    return {
      error:
        "We couldn't send your login code just now. Please wait a minute and try again.",
      sendFailed: true,
    }
  }

  return { success: true }
}

// ─── Verify Login Code ────────────────────────────────────────────────────────

/**
 * Verifies the emailed OTP code and establishes a session.
 * The companion to requestMagicLink: members type the code from their email
 * instead of clicking the link, which sidesteps email prefetchers (Outlook,
 * AOL, Yahoo) that consume magic links before the user taps them.
 *
 * Requires the Supabase email template to include `{{ .Token }}` — see
 * the PICKUP note written when this action shipped.
 */
export async function verifyLoginCode(
  formData: FormData,
): Promise<{ success?: boolean; error?: string }> {
  const raw = {
    email: formData.get('email'),
    token: formData.get('token'),
  }

  const result = verifyLoginCodeSchema.safeParse(raw)
  if (!result.success) {
    const firstError = result.error.issues[0]?.message ?? 'Invalid code'
    return { error: firstError }
  }

  const { email, token } = result.data
  const supabase = await createServerSupabaseClient()

  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  })

  if (error) {
    console.error('[verifyLoginCode] verify error:', error.message)
    return { error: 'That code is wrong or has expired. Request a new one.' }
  }

  return { success: true }
}

// ─── Log In With Link From George ─────────────────────────────────────────────

/**
 * Logs a member in from a one-time login link George created in the admin
 * panel (createMemberLoginLink) and sent them on WhatsApp. The fallback for
 * when login-code emails don't arrive.
 *
 * Called from a button on /login-link rather than on page load: WhatsApp
 * fetches links to build a preview, and verifying on GET would use the link up
 * before the member ever tapped it.
 */
export async function loginWithLinkToken(
  formData: FormData,
): Promise<{ success?: boolean; error?: string }> {
  const tokenHash = formData.get('token_hash')
  if (typeof tokenHash !== 'string' || !tokenHash.trim()) {
    return { error: 'This login link is incomplete. Ask George to send you a new one.' }
  }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash.trim(),
    type: 'magiclink',
  })

  if (error) {
    console.error('[loginWithLinkToken] verify error:', error.message)
    return {
      error:
        'This login link has already been used or has run out. Ask George to send you a new one.',
    }
  }

  return { success: true }
}

// ─── Request Password Reset ───────────────────────────────────────────────────

/**
 * Sends a password-recovery email to a member's address. The link in the email
 * lands on /auth/reset-password where the member sets a new password.
 *
 * Used by:
 *  - Members who originally signed in with the email code (OTP) and now want
 *    to register a password they can use directly.
 *  - Members who set a password but forgot it.
 *
 * Returns success even if the email is not registered — Supabase doesn't
 * reveal whether an account exists, and we don't want to leak it either.
 */
export async function requestPasswordReset(
  formData: FormData,
): Promise<{ success?: boolean; error?: string }> {
  const raw = { email: formData.get('email') }
  const result = loginSchema.safeParse(raw)
  if (!result.success) {
    const firstError = result.error.issues[0]?.message ?? 'Invalid email'
    return { error: firstError }
  }

  const { email } = result.data
  const supabase = await createServerSupabaseClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/auth/reset-password`,
  })

  if (error) {
    console.error('[requestPasswordReset] Error:', error.message)
    // Don't surface — return generic success so we don't reveal account state.
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
    // Most members never set a password — they signed up with the email code.
    // Supabase returns the same "invalid credentials" for a wrong password and
    // for an account that has no password at all, so point at both ways out
    // rather than just insisting the password is wrong.
    return {
      error:
        'Email or password is incorrect. If you have never set a password, use the "Email code" tab instead.',
    }
  }

  return { success: true }
}
