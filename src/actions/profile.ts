'use server'

/**
 * Member profile server actions.
 *
 * `updateEmailPreferences` toggles the per-member weekly email opt-outs
 * (email_weekly_personal, email_weekly_group). Session-scoped — the member
 * row is resolved via `auth.getUser()`, never trusted from client input.
 *
 * Critical emails (approval, password reset) always fire regardless of
 * these flags — see the /profile page copy.
 */
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createServerSupabaseClient } from '@/lib/supabase/server'

const schema = z.object({
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

  const parsed = schema.safeParse(raw)
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

  const { error } = await supabase
    .from('members')
    .update(update)
    .eq('user_id', user.id)

  if (error) {
    console.error('[updateEmailPreferences] Update error:', error.message)
    return { success: false, error: error.message }
  }

  revalidatePath('/profile')
  return { success: true }
}
