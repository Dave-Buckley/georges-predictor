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

  // Placeholders (user_id IS NULL, blank email) are point-holders waiting to
  // be claimed when the real member signs up — no auth user exists yet to
  // send a magic link to. Approve the row but skip the email step.
  const isPlaceholder = !member.user_id || !member.email

  if (!isPlaceholder) {
    // Existing auth user — use generateLink (inviteUserByEmail only works
    // for *new* users and errors when the account already exists).
    const { error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: member.email,
      options: { redirectTo: `${appUrl}/auth/callback?next=/dashboard` },
    })

    if (linkError) {
      console.error('[approveMember] generateLink error:', linkError.message)
      return { error: 'Failed to send magic link. Please try again.' }
    }
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
    subject: "Your registration for King Predictor",
    html: `
      <p>Hi ${member.display_name},</p>
      <p>Thanks for signing up for King Predictor competition.</p>
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
 *
 * Two kinds of member exist and they have to be deleted differently:
 *
 *  - **Registered members** have a `user_id`. Deleting the auth user cascades
 *    down to the members row (members.user_id is ON DELETE CASCADE).
 *  - **Placeholder members** are the names George typed in himself before the
 *    season opened — they have NO auth user (`user_id` is NULL). The old code
 *    called `deleteUser(null)` on these, which always errored. That is why
 *    George could remove signed-up players but not the names he had added
 *    manually (Charlie, July 2026). These need the members row deleted directly.
 *
 * Either way we first clear the member's `prize_awards` rows. That FK was
 * declared without an ON DELETE rule, so it defaults to NO ACTION and blocks
 * the delete outright for anyone who has ever won a prize — including via the
 * cascade path. Migration 025 fixes the constraint properly; this clean-up
 * keeps removal working whether or not that migration has been applied yet.
 *
 * Removal does NOT add the address to blocked_emails, so a member who leaves
 * can sign up again later with the same email.
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

  // Clear the one FK that would otherwise refuse the delete.
  const { error: prizeError } = await supabaseAdmin
    .from('prize_awards')
    .delete()
    .eq('member_id', memberId)

  if (prizeError) {
    console.error('[removeMember] Failed clearing prize_awards:', prizeError.message)
    return { error: 'Failed to remove member. Please try again.' }
  }

  if (member.user_id) {
    // Registered member — delete the auth user, cascade clears the members row.
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
      member.user_id
    )

    if (deleteError) {
      console.error('[removeMember] Delete auth user error:', deleteError.message)
      return { error: 'Failed to remove member. Please try again.' }
    }

    return { success: true }
  }

  // Placeholder member — no auth user to delete, so remove the row itself.
  const { error: rowError } = await supabaseAdmin
    .from('members')
    .delete()
    .eq('id', memberId)

  if (rowError) {
    console.error('[removeMember] Delete members row error:', rowError.message)
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
