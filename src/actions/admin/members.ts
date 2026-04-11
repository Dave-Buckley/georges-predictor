'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { addMemberSchema, updateEmailSchema } from '@/lib/validators/admin'
import { sendEmail } from '@/lib/email'

// ─── Admin Auth Guard ─────────────────────────────────────────────────────────

async function requireAdmin(): Promise<{ userId: string } | { error: string }> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user || user.app_metadata?.role !== 'admin') {
    return { error: 'Unauthorized — admin access required' }
  }

  return { userId: user.id }
}

// ─── Approve Member ───────────────────────────────────────────────────────────

/**
 * Approves a pending member:
 * 1. Fetches member record
 * 2. Sends magic link (invite email) via Supabase
 * 3. Updates approval_status = 'approved', sets approved_at and approved_by
 */
export async function approveMember(
  memberId: string
): Promise<{ success?: boolean; error?: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const supabaseAdmin = createAdminClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  // Fetch member
  const { data: member, error: fetchError } = await supabaseAdmin
    .from('members')
    .select('user_id, email, display_name')
    .eq('id', memberId)
    .single()

  if (fetchError || !member) {
    return { error: 'Member not found' }
  }

  // Send magic link (invite) via Supabase
  const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    member.email,
    { redirectTo: `${appUrl}/auth/callback?next=/dashboard` }
  )

  if (inviteError) {
    console.error('[approveMember] Invite error:', inviteError.message)
    return { error: 'Failed to send magic link. Please try again.' }
  }

  // Update approval status
  const { error: updateError } = await supabaseAdmin
    .from('members')
    .update({
      approval_status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: auth.userId,
    })
    .eq('id', memberId)

  if (updateError) {
    console.error('[approveMember] Update error:', updateError.message)
    return { error: 'Approval recorded but member row update failed.' }
  }

  return { success: true }
}

// ─── Reject Member ────────────────────────────────────────────────────────────

/**
 * Rejects a pending member:
 * 1. Fetches member record
 * 2. Deletes auth user (triggers FK cascade to members row)
 * 3. Sends rejection email via Resend
 * 4. Optionally blocks the email address
 */
export async function rejectMember(
  memberId: string,
  blockEmail: boolean
): Promise<{ success?: boolean; error?: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const supabaseAdmin = createAdminClient()

  // Fetch member
  const { data: member, error: fetchError } = await supabaseAdmin
    .from('members')
    .select('user_id, email, display_name')
    .eq('id', memberId)
    .single()

  if (fetchError || !member) {
    return { error: 'Member not found' }
  }

  // Delete auth user — cascades to members row via FK
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
    member.user_id
  )

  if (deleteError) {
    console.error('[rejectMember] Delete error:', deleteError.message)
    return { error: 'Failed to remove member. Please try again.' }
  }

  // Send rejection email (fire-and-forget — don't block on email failure)
  sendEmail({
    to: member.email,
    subject: "Your registration for George's Predictor",
    html: `
      <p>Hi ${member.display_name},</p>
      <p>Thanks for signing up for George's Predictor competition.</p>
      <p>Unfortunately your registration was not approved at this time.</p>
      <p>If you believe this is an error, please reach out to George directly.</p>
    `,
  }).catch((err) => {
    console.error('[rejectMember] Failed to send rejection email:', err)
  })

  // Optionally block the email address
  if (blockEmail) {
    await supabaseAdmin
      .from('blocked_emails')
      .insert({
        email: member.email,
        blocked_by: auth.userId,
        blocked_at: new Date().toISOString(),
      })
      .then(({ error }) => {
        if (error) console.error('[rejectMember] Block email error:', error.message)
      })
  }

  return { success: true }
}

// ─── Add Member ───────────────────────────────────────────────────────────────

/**
 * Manually adds a member (for late joiners or admin-added accounts).
 * Creates auth user, updates the members row created by trigger,
 * then sends a welcome magic link.
 */
export async function addMember(
  formData: FormData
): Promise<{ success?: boolean; error?: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const raw = {
    display_name: formData.get('display_name'),
    email: formData.get('email'),
    starting_points: formData.get('starting_points'),
  }

  const result = addMemberSchema.safeParse(raw)
  if (!result.success) {
    const firstError = result.error.issues[0]?.message ?? 'Invalid input'
    return { error: firstError }
  }

  const { display_name, email, starting_points } = result.data

  const supabaseAdmin = createAdminClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  // Create auth user with email confirmed
  const { data: userData, error: createError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
    })

  if (createError || !userData.user) {
    console.error('[addMember] Create user error:', createError?.message)
    return { error: 'Failed to create user. Email may already be registered.' }
  }

  // Update members row (created by DB trigger)
  const { error: updateError } = await supabaseAdmin
    .from('members')
    .update({
      approval_status: 'approved',
      display_name,
      starting_points,
      approved_at: new Date().toISOString(),
      approved_by: auth.userId,
    })
    .eq('user_id', userData.user.id)

  if (updateError) {
    console.error('[addMember] Update members error:', updateError.message)
    // Non-fatal — user was created, just members row not fully updated
  }

  // Send welcome magic link
  await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${appUrl}/auth/callback?next=/dashboard`,
  }).catch((err) => {
    console.error('[addMember] Failed to send welcome invite:', err)
  })

  return { success: true }
}

// ─── Remove Member ────────────────────────────────────────────────────────────

/**
 * Permanently removes a member from the competition.
 * Deletes the auth user — FK cascade removes the members row.
 */
export async function removeMember(
  memberId: string
): Promise<{ success?: boolean; error?: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const supabaseAdmin = createAdminClient()

  // Fetch member to get user_id
  const { data: member, error: fetchError } = await supabaseAdmin
    .from('members')
    .select('user_id')
    .eq('id', memberId)
    .single()

  if (fetchError || !member) {
    return { error: 'Member not found' }
  }

  // Delete auth user — cascades to members row
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
    member.user_id
  )

  if (deleteError) {
    console.error('[removeMember] Delete error:', deleteError.message)
    return { error: 'Failed to remove member. Please try again.' }
  }

  return { success: true }
}

// ─── Update Member Email ──────────────────────────────────────────────────────

/**
 * Updates a member's email in both auth.users and the members table.
 */
export async function updateMemberEmail(
  memberId: string,
  newEmail: string
): Promise<{ success?: boolean; error?: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const result = updateEmailSchema.safeParse({ member_id: memberId, new_email: newEmail })
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Invalid input' }
  }

  const supabaseAdmin = createAdminClient()

  // Fetch member to get user_id
  const { data: member, error: fetchError } = await supabaseAdmin
    .from('members')
    .select('user_id')
    .eq('id', memberId)
    .single()

  if (fetchError || !member) {
    return { error: 'Member not found' }
  }

  // Update auth user email
  const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
    member.user_id,
    { email: newEmail }
  )

  if (authUpdateError) {
    console.error('[updateMemberEmail] Auth update error:', authUpdateError.message)
    return { error: 'Failed to update email. Please try again.' }
  }

  // Update members table
  const { error: dbUpdateError } = await supabaseAdmin
    .from('members')
    .update({ email: newEmail })
    .eq('id', memberId)

  if (dbUpdateError) {
    console.error('[updateMemberEmail] DB update error:', dbUpdateError.message)
    return { error: 'Email updated in auth but members table update failed.' }
  }

  return { success: true }
}

// ─── Set Member Starting Points ───────────────────────────────────────────────

/**
 * Updates a member's starting points (used for mid-season joiners).
 */
export async function setMemberStartingPoints(
  memberId: string,
  points: number
): Promise<{ success?: boolean; error?: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  if (typeof points !== 'number' || points < 0) {
    return { error: 'Starting points must be a non-negative number' }
  }

  const supabaseAdmin = createAdminClient()

  const { error } = await supabaseAdmin
    .from('members')
    .update({ starting_points: Math.floor(points) })
    .eq('id', memberId)

  if (error) {
    console.error('[setMemberStartingPoints] Error:', error.message)
    return { error: 'Failed to update starting points.' }
  }

  return { success: true }
}
