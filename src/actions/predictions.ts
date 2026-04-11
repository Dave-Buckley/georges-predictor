'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { canSubmitPrediction } from '@/lib/fixtures/lockout'
import { submitPredictionsSchema } from '@/lib/validators/predictions'

// ─── Submit Predictions ───────────────────────────────────────────────────────

/**
 * Submits or updates a member's predictions for a gameweek.
 *
 * Flow:
 *  1. Authenticate via getUser() (not getSession — security pattern from Phase 1)
 *  2. Look up member row, verify approval_status === 'approved'
 *  3. Validate input with Zod (rejects negative scores, invalid UUIDs, empty array)
 *  4. For each entry: check canSubmitPrediction() — skip locked fixtures
 *  5. Upsert prediction row (member_id + fixture_id as unique key)
 *  6. Revalidate the gameweek page cache
 *
 * IMPORTANT: member_id is resolved server-side from auth.uid() via the members table.
 * A client-passed member_id is NEVER trusted.
 *
 * Uses the member's own session client (not admin client) so RLS policies apply.
 */
export async function submitPredictions(
  gameweekNumber: number,
  entries: Array<{ fixture_id: string; home_score: number; away_score: number }>
): Promise<{ success?: boolean; saved: number; skipped: number; error?: string }> {
  const supabase = await createServerSupabaseClient()

  // ── Step 1: Authenticate ─────────────────────────────────────────────────────
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Not authenticated', saved: 0, skipped: 0 }
  }

  // ── Step 2: Look up approved member ──────────────────────────────────────────
  const { data: member, error: memberError } = await supabase
    .from('members')
    .select('id, approval_status')
    .eq('user_id', user.id)
    .single()

  if (memberError || !member) {
    return { error: 'Member not found', saved: 0, skipped: 0 }
  }

  if (member.approval_status !== 'approved') {
    return { error: 'Member not approved', saved: 0, skipped: 0 }
  }

  // ── Step 3: Validate input ────────────────────────────────────────────────────
  const validation = submitPredictionsSchema.safeParse({
    gameweek_number: gameweekNumber,
    entries,
  })

  if (!validation.success) {
    const firstError = validation.error.issues[0]?.message ?? 'Invalid input'
    return { error: firstError, saved: 0, skipped: 0 }
  }

  const { gameweek_number, entries: validatedEntries } = validation.data

  // ── Step 4–5: Loop, lockout check, upsert ────────────────────────────────────
  let saved = 0
  let skipped = 0

  for (const entry of validatedEntries) {
    // Server-side lockout check (two-layer enforcement with RLS)
    const lockout = await canSubmitPrediction(entry.fixture_id)

    if (!lockout.canSubmit) {
      skipped++
      continue
    }

    const { error: upsertError } = await supabase
      .from('predictions')
      .upsert(
        {
          member_id: member.id,
          fixture_id: entry.fixture_id,
          home_score: entry.home_score,
          away_score: entry.away_score,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'member_id,fixture_id' }
      )

    if (upsertError) {
      console.error('[submitPredictions] Upsert error:', upsertError.message)
      skipped++
    } else {
      saved++
    }
  }

  // ── Step 6: Revalidate gameweek page ─────────────────────────────────────────
  revalidatePath('/gameweeks/' + gameweek_number)

  return { success: true, saved, skipped }
}
