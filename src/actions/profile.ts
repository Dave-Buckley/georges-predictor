'use server'

/**
 * Member profile server actions.
 *
 * `updateEmailPreferences` toggles the per-member weekly email opt-outs
 * (email_weekly_personal, email_weekly_group).
 * `updateFavouriteClub` sets or clears the member's favourite club, whose
 * badge renders beside their name in the league table.
 *
 * Both are session-scoped: the member row is resolved from `auth.getUser()`
 * and every write is keyed on that user_id. Client input is never trusted to
 * say which member row to touch.
 *
 * ─── Why these use the admin client ────────────────────────────────────────
 * public.members has no self-UPDATE RLS policy. Migration 001 grants UPDATE
 * only to admins (`admins_update_members`), and nothing since has added a
 * member-owned equivalent. A session-client update therefore matches zero rows
 * — and PostgREST reports that as success, not an error, so the old
 * implementation of updateEmailPreferences silently did nothing for every
 * non-admin member while showing them "Saved".
 *
 * Using the service role from a server action is how every other member-row
 * write in this codebase already works (see src/actions/admin/*.ts). The
 * safety property is preserved by resolving the member from the verified
 * session and scoping each update with .eq('user_id', user.id) — the caller
 * can only ever write their own row.
 *
 * Critical emails (approval, password reset) always fire regardless of the
 * email flags — see the /profile page copy.
 */
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const emailSchema = z.object({
  email_weekly_personal: z
    .union([z.literal('true'), z.literal('false')])
    .optional(),
  email_weekly_group: z
    .union([z.literal('true'), z.literal('false')])
    .optional(),
})

export async function updateEmailPreferences(
  formData: FormData,
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  const raw: Record<string, unknown> = {}
  const personal = formData.get('email_weekly_personal')
  const group = formData.get('email_weekly_group')
  if (personal !== null) raw.email_weekly_personal = personal
  if (group !== null) raw.email_weekly_group = group

  const parsed = emailSchema.safeParse(raw)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Invalid input'
    return { success: false, error: firstError }
  }

  const update: Record<string, boolean> = {}
  if (parsed.data.email_weekly_personal !== undefined) {
    update.email_weekly_personal = parsed.data.email_weekly_personal === 'true'
  }
  if (parsed.data.email_weekly_group !== undefined) {
    update.email_weekly_group = parsed.data.email_weekly_group === 'true'
  }

  if (Object.keys(update).length === 0) {
    // Nothing to update — treat as no-op success.
    return { success: true }
  }

  const admin = createAdminClient()
  const { data: updated, error } = await admin
    .from('members')
    .update(update)
    .eq('user_id', user.id)
    .select('id')

  if (error) {
    console.error('[updateEmailPreferences] Update error:', error.message)
    return { success: false, error: error.message }
  }
  // A zero-row update means the session has no member row. Report it rather
  // than showing "Saved" over a write that did not happen.
  if (!updated || updated.length === 0) {
    return { success: false, error: 'We could not find your member record.' }
  }

  revalidatePath('/profile')
  return { success: true }
}

const clubSchema = z.object({
  // Empty string clears the pick; otherwise it must be a club UUID.
  favourite_club_id: z.union([z.literal(''), z.string().uuid()]),
})

export async function updateFavouriteClub(
  formData: FormData,
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  const parsed = clubSchema.safeParse({
    favourite_club_id: formData.get('favourite_club_id') ?? '',
  })
  if (!parsed.success) {
    return { success: false, error: 'That is not a valid club.' }
  }

  const clubId = parsed.data.favourite_club_id === '' ? null : parsed.data.favourite_club_id

  const admin = createAdminClient()

  // Verify the club exists before storing it. The FK would catch a bad id
  // anyway, but this returns a message a member can understand instead of a
  // raw constraint violation.
  if (clubId !== null) {
    const { data: club } = await admin
      .from('clubs')
      .select('id')
      .eq('id', clubId)
      .maybeSingle()
    if (!club) {
      return { success: false, error: 'That club is no longer available.' }
    }
  }

  const { data: updated, error } = await admin
    .from('members')
    .update({ favourite_club_id: clubId })
    .eq('user_id', user.id)
    .select('id')

  if (error) {
    console.error('[updateFavouriteClub] Update error:', error.message)
    return { success: false, error: error.message }
  }
  if (!updated || updated.length === 0) {
    return { success: false, error: 'We could not find your member record.' }
  }

  // The badge shows up next to the member's name in several places.
  revalidatePath('/profile')
  revalidatePath('/standings')
  revalidatePath('/tables')

  return { success: true }
}
