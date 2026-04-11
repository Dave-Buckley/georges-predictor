'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { securityQuestionSchema, adminRecoverySchema } from '@/lib/validators/admin'

// ─── Admin Auth Guard ─────────────────────────────────────────────────────────

async function requireAdmin(): Promise<
  { userId: string; email: string } | { error: string }
> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user || user.app_metadata?.role !== 'admin') {
    return { error: 'Unauthorized — admin access required' }
  }

  return { userId: user.id, email: user.email ?? '' }
}

// ─── SHA-256 Hash Utility ─────────────────────────────────────────────────────

/**
 * Hashes a security answer using SHA-256 via the Web Crypto API.
 * Answer is lowercased and trimmed before hashing for case-insensitive matching.
 */
async function hashAnswer(answer: string): Promise<string> {
  const normalised = answer.trim().toLowerCase()
  const encoder = new TextEncoder()
  const data = encoder.encode(normalised)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ─── Set Security Question ────────────────────────────────────────────────────

/**
 * Sets (or updates) the current admin's security question and hashed answer.
 */
export async function setSecurityQuestion(
  formData: FormData
): Promise<{ success?: boolean; error?: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const raw = {
    question: formData.get('question'),
    answer: formData.get('answer'),
  }

  const result = securityQuestionSchema.safeParse(raw)
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { question, answer } = result.data
  const answerHash = await hashAnswer(answer)

  const supabaseAdmin = createAdminClient()

  const { error } = await supabaseAdmin
    .from('admin_security_questions')
    .upsert(
      {
        admin_user_id: auth.userId,
        question,
        answer_hash: answerHash,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'admin_user_id' }
    )

  if (error) {
    console.error('[setSecurityQuestion] Error:', error.message)
    return { error: 'Failed to save security question. Please try again.' }
  }

  return { success: true }
}

// ─── Get Security Question ────────────────────────────────────────────────────

/**
 * Returns the security question text for a given admin.
 * NEVER returns the answer hash.
 */
export async function getSecurityQuestion(
  adminUserId: string
): Promise<{ question?: string; error?: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const supabaseAdmin = createAdminClient()

  const { data, error } = await supabaseAdmin
    .from('admin_security_questions')
    .select('question')
    .eq('admin_user_id', adminUserId)
    .single()

  if (error || !data) {
    return { error: 'No security question set for this admin' }
  }

  return { question: data.question }
}

// ─── Verify Security Answer ───────────────────────────────────────────────────

/**
 * Verifies a provided answer against the stored hash for a given admin.
 */
export async function verifySecurityAnswer(
  adminUserId: string,
  answer: string
): Promise<{ verified: boolean; error?: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return { verified: false, ...auth }

  const supabaseAdmin = createAdminClient()

  const { data, error } = await supabaseAdmin
    .from('admin_security_questions')
    .select('answer_hash')
    .eq('admin_user_id', adminUserId)
    .single()

  if (error || !data) {
    return { verified: false, error: 'No security question found for this admin' }
  }

  const providedHash = await hashAnswer(answer)
  return { verified: providedHash === data.answer_hash }
}

// ─── Reset Other Admin Email ──────────────────────────────────────────────────

/**
 * Allows one admin to reset the other admin's email address after verifying
 * the other admin's security question answer.
 * Per locked decision: "Either admin can reset the other's account if email access is lost."
 */
export async function resetOtherAdminEmail(
  formData: FormData
): Promise<{ success?: boolean; error?: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const raw = {
    target_admin_email: formData.get('target_admin_email'),
    security_answer: formData.get('security_answer'),
    new_email: formData.get('new_email'),
  }

  const result = adminRecoverySchema.safeParse(raw)
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { target_admin_email, security_answer, new_email } = result.data

  // Early guard: cannot reset your own email this way
  if (auth.email.toLowerCase() === target_admin_email.toLowerCase()) {
    return { error: 'You cannot reset your own email using this recovery flow' }
  }

  const supabaseAdmin = createAdminClient()

  // Look up the target admin by their current email
  // Using admin.listUsers since we need to find user by email
  const { data: usersData, error: listError } =
    await supabaseAdmin.auth.admin.listUsers()

  if (listError || !usersData) {
    return { error: 'Failed to look up admin account' }
  }

  const targetUser = usersData.users.find(
    (u) => u.email === target_admin_email && u.app_metadata?.role === 'admin'
  )

  if (!targetUser) {
    return { error: 'Target admin account not found' }
  }

  // Verify the target admin's security answer
  const { verified } = await verifySecurityAnswer(targetUser.id, security_answer)

  if (!verified) {
    return { error: 'Security answer incorrect' }
  }

  // Update the target admin's email
  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
    targetUser.id,
    { email: new_email }
  )

  if (updateError) {
    console.error('[resetOtherAdminEmail] Update error:', updateError.message)
    return { error: 'Failed to update email. Please try again.' }
  }

  return { success: true }
}
