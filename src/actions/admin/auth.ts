'use server'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { adminLoginSchema } from '@/lib/validators/admin'

/**
 * Authenticates an admin user with email + password.
 * On success, redirects to /admin.
 * On failure, returns { error }.
 *
 * Secondary guard: verifies the email is a known admin email before login.
 * Primary protection is Supabase app_metadata.role === 'admin' enforced by middleware.
 */
export async function adminLogin(
  formData: FormData
): Promise<{ error?: string }> {
  const raw = {
    email: formData.get('email'),
    password: formData.get('password'),
  }

  const result = adminLoginSchema.safeParse(raw)
  if (!result.success) {
    const firstError = result.error.issues[0]?.message ?? 'Invalid input'
    return { error: firstError }
  }

  const { email, password } = result.data

  // Secondary guard: only known admin emails can attempt login
  const knownAdmins = [
    process.env.ADMIN_EMAIL_GEORGE,
    process.env.ADMIN_EMAIL_DAVE,
  ].filter(Boolean)

  if (knownAdmins.length > 0 && !knownAdmins.includes(email)) {
    return { error: `Email not recognised as admin (${knownAdmins.length} admins configured)` }
  }

  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error || !data.user) {
    return { error: `Login failed: ${error?.message ?? 'No user returned'}` }
  }

  // Verify the user actually has admin role (middleware also enforces this)
  const isAdmin = data.user.app_metadata?.role === 'admin'
  if (!isAdmin) {
    await supabase.auth.signOut()
    return { error: 'Account exists but is not an admin' }
  }

  redirect('/admin')
}

/**
 * Sends a password reset email to a known admin email.
 * Uses Supabase's built-in resetPasswordForEmail.
 */
export async function resetAdminPassword(
  formData: FormData
): Promise<{ success?: boolean; error?: string }> {
  const email = (formData.get('email') as string)?.trim()

  if (!email) {
    return { error: 'Email is required' }
  }

  const knownAdmins = [
    process.env.ADMIN_EMAIL_GEORGE,
    process.env.ADMIN_EMAIL_DAVE,
  ].filter(Boolean)

  if (knownAdmins.length > 0 && !knownAdmins.includes(email)) {
    return { error: 'Email not recognised as admin' }
  }

  const supabase = await createServerSupabaseClient()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/admin/reset-password`,
  })

  if (error) {
    console.error('[resetAdminPassword] Error:', error.message)
    return { error: 'Failed to send reset email. Try again.' }
  }

  return { success: true }
}
