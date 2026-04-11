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
    return { error: 'Invalid admin credentials' }
  }

  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error || !data.user) {
    return { error: 'Invalid admin credentials' }
  }

  // Verify the user actually has admin role (middleware also enforces this)
  const isAdmin = data.user.app_metadata?.role === 'admin'
  if (!isAdmin) {
    await supabase.auth.signOut()
    return { error: 'Invalid admin credentials' }
  }

  redirect('/admin')
}
