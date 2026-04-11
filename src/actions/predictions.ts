'use server'

import { z } from 'zod'
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
 *  6. If bonusFixtureId provided: verify not locked, upsert bonus_awards row (RLS enforced)
 *  7. Revalidate the gameweek page cache
 *
 * IMPORTANT: member_id is resolved server-side from auth.uid() via the members table.
 * A client-passed member_id is NEVER trusted.
 *
 * Uses the member's own session client (not admin client) so RLS policies apply.
 */
export async function submitPredictions(
  gameweekNumber: number,
  entries: Array<{ fixture_id: string; home_score: number; away_score: number }>,
  bonusFixtureId: string | null = null,
): Promise<{ success?: boolean; saved: number; skipped: number; bonusSaved: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()

  // ── Step 1: Authenticate ─────────────────────────────────────────────────────
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Not authenticated', saved: 0, skipped: 0, bonusSaved: false }
  }

  // ── Step 2: Look up approved member ──────────────────────────────────────────
  const { data: member, error: memberError } = await supabase
    .from('members')
    .select('id, approval_status')
    .eq('user_id', user.id)
    .single()

  if (memberError || !member) {
    return { error: 'Member not found', saved: 0, skipped: 0, bonusSaved: false }
  }

  if (member.approval_status !== 'approved') {
    return { error: 'Member not approved', saved: 0, skipped: 0, bonusSaved: false }
  }

  // ── Step 3: Validate input ────────────────────────────────────────────────────
  // Optional UUID guard for bonusFixtureId
  if (bonusFixtureId && !z.string().uuid().safeParse(bonusFixtureId).success) {
    return { error: 'Invalid bonus fixture ID', saved: 0, skipped: 0, bonusSaved: false }
  }

  const validation = submitPredictionsSchema.safeParse({
    gameweek_number: gameweekNumber,
    entries,
  })

  if (!validation.success) {
    const firstError = validation.error.issues[0]?.message ?? 'Invalid input'
    return { error: firstError, saved: 0, skipped: 0, bonusSaved: false }
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

  // ── Step 6: Handle bonus pick if provided ────────────────────────────────────
  let bonusSaved = false

  if (bonusFixtureId) {
    // Verify the chosen fixture hasn't kicked off (same lockout check as predictions)
    const bonusLockout = await canSubmitPrediction(bonusFixtureId)

    if (bonusLockout.canSubmit) {
      // Fetch the gameweek row to get gameweek_id
      const { data: gwRow } = await supabase
        .from('gameweeks')
        .select('id')
        .eq('number', gameweek_number)
        .single()

      if (gwRow) {
        // Fetch the confirmed bonus schedule for this gameweek
        const { data: bonusSchedule } = await supabase
          .from('bonus_schedule')
          .select('bonus_type_id')
          .eq('gameweek_id', gwRow.id)
          .eq('confirmed', true)
          .single()

        if (bonusSchedule) {
          // Upsert bonus_awards row — RLS enforces member_id matches auth.uid()
          const { error: bonusError } = await supabase
            .from('bonus_awards')
            .upsert(
              {
                gameweek_id: gwRow.id,
                member_id: member.id,
                bonus_type_id: bonusSchedule.bonus_type_id,
                fixture_id: bonusFixtureId,
                awarded: null, // always pending until George confirms
                points_awarded: 0,
              },
              { onConflict: 'gameweek_id,member_id' }
            )
          if (!bonusError) bonusSaved = true
        }
      }
    }
  }

  // ── Step 7: Revalidate gameweek page ─────────────────────────────────────────
  revalidatePath('/gameweeks/' + gameweek_number)

  return { success: true, saved, skipped, bonusSaved }
}
