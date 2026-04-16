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
  losTeamId: string | null = null,
): Promise<{ success?: boolean; saved: number; skipped: number; bonusSaved: boolean; losSaved: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()

  // ── Step 1: Authenticate ─────────────────────────────────────────────────────
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Not authenticated', saved: 0, skipped: 0, bonusSaved: false, losSaved: false }
  }

  // ── Step 2: Look up approved member ──────────────────────────────────────────
  const { data: member, error: memberError } = await supabase
    .from('members')
    .select('id, approval_status')
    .eq('user_id', user.id)
    .single()

  if (memberError || !member) {
    return { error: 'Member not found', saved: 0, skipped: 0, bonusSaved: false, losSaved: false }
  }

  if (member.approval_status !== 'approved') {
    return { error: 'Member not approved', saved: 0, skipped: 0, bonusSaved: false, losSaved: false }
  }

  // ── Step 3: Validate input ────────────────────────────────────────────────────
  // Optional UUID guard for bonusFixtureId
  if (bonusFixtureId && !z.string().uuid().safeParse(bonusFixtureId).success) {
    return { error: 'Invalid bonus fixture ID', saved: 0, skipped: 0, bonusSaved: false, losSaved: false }
  }

  // Optional UUID guard for losTeamId
  if (losTeamId && !z.string().uuid().safeParse(losTeamId).success) {
    return { error: 'Invalid LOS team ID', saved: 0, skipped: 0, bonusSaved: false, losSaved: false }
  }

  const validation = submitPredictionsSchema.safeParse({
    gameweek_number: gameweekNumber,
    entries,
  })

  if (!validation.success) {
    const firstError = validation.error.issues[0]?.message ?? 'Invalid input'
    return { error: firstError, saved: 0, skipped: 0, bonusSaved: false, losSaved: false }
  }

  const { gameweek_number, entries: validatedEntries } = validation.data

  // ── Step 3a: Hard-lock check — members who tapped "Copy to WhatsApp" ────────
  // Once a member locks their picks for a gameweek, further submits are
  // rejected. George can clear a lock row via the admin client if needed.
  const { data: gwForLock } = await supabase
    .from('gameweeks')
    .select('id')
    .eq('number', gameweek_number)
    .single()

  if (gwForLock) {
    const { data: existingLock } = await supabase
      .from('prediction_locks')
      .select('id')
      .eq('gameweek_id', gwForLock.id)
      .eq('member_id', member.id)
      .maybeSingle()

    if (existingLock) {
      return {
        error: 'Your predictions for this gameweek are locked (copied to WhatsApp). Ask George if you need them reopened.',
        saved: 0,
        skipped: 0,
        bonusSaved: false,
        losSaved: false,
      }
    }
  }

  // ── Step 3b: LOS pre-check ───────────────────────────────────────────────────
  // Determine if an active competition exists and whether this member must pick.
  // Runs BEFORE predictions upsert so we can fail fast with saved=0 when the
  // mandatory picker was not filled in.
  const { data: activeCompetition } = await supabase
    .from('los_competitions')
    .select('id, status')
    .eq('status', 'active')
    .maybeSingle()

  let memberLosStatus: 'active' | 'eliminated' | null = null
  if (activeCompetition) {
    const { data: memberRow } = await supabase
      .from('los_competition_members')
      .select('status')
      .eq('competition_id', activeCompetition.id)
      .eq('member_id', member.id)
      .maybeSingle()
    memberLosStatus = (memberRow?.status ?? null) as 'active' | 'eliminated' | null
  }

  const memberIsEligible = !!activeCompetition && memberLosStatus === 'active'

  // Mandatory pick enforcement (LOS-01): eligible member MUST provide losTeamId.
  if (memberIsEligible && !losTeamId) {
    return {
      error: 'LOS team pick required — select your team before submitting',
      saved: 0,
      skipped: 0,
      bonusSaved: false,
      losSaved: false,
    }
  }

  // ── Step 3c: LOS fixture + team-already-used resolution ────────────────────
  // Resolve the gameweek id and (if losTeamId supplied) the fixture this team
  // plays in. This also enforces LOS-03 (team not used earlier in the cycle).
  // Runs before predictions upsert so we can fail-fast without partial writes.
  let losGameweekId: string | null = null
  let losFixtureId: string | null = null
  let losKickoffInFuture = false

  if (activeCompetition && memberIsEligible && losTeamId) {
    // LOS-03: reject if team appears in a prior gameweek of the same cycle.
    // Look up the current gameweek id first so we can exclude it from the query.
    const { data: gwRow } = await supabase
      .from('gameweeks')
      .select('id')
      .eq('number', gameweek_number)
      .single()
    losGameweekId = (gwRow?.id as string | undefined) ?? null

    if (!losGameweekId) {
      return {
        error: 'Gameweek not found',
        saved: 0,
        skipped: 0,
        bonusSaved: false,
        losSaved: false,
      }
    }

    const priorPicksQuery = supabase
      .from('los_picks')
      .select('id, gameweek_id, team_id')
      .eq('competition_id', activeCompetition.id)
      .eq('member_id', member.id)
      .eq('team_id', losTeamId)
      .neq('gameweek_id', losGameweekId)
    const { data: priorPicks } = await priorPicksQuery

    if (priorPicks && priorPicks.length > 0) {
      return {
        error: 'You have already used that team in this competition cycle',
        saved: 0,
        skipped: 0,
        bonusSaved: false,
        losSaved: false,
      }
    }

    // Resolve the fixture: picked team plays home or away in this gameweek.
    const { data: teamFixture } = await supabase
      .from('fixtures')
      .select('id, kickoff_time')
      .eq('gameweek_id', losGameweekId)
      .or(`home_team_id.eq.${losTeamId},away_team_id.eq.${losTeamId}`)
      .limit(1)
      .single()

    if (!teamFixture) {
      return {
        error: 'No fixture found for that team in this gameweek',
        saved: 0,
        skipped: 0,
        bonusSaved: false,
        losSaved: false,
      }
    }

    losFixtureId = (teamFixture as { id: string; kickoff_time: string }).id
    const kickoffTime = (teamFixture as { id: string; kickoff_time: string }).kickoff_time
    losKickoffInFuture = new Date(kickoffTime) > new Date()
  }

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

  // ── Step 6b: Handle LOS pick upsert ─────────────────────────────────────────
  // At this point pre-checks passed (eligibility, not already used, fixture resolved).
  // RLS additionally enforces kickoff_time > now() at the row-insert level — the
  // `losKickoffInFuture` flag is a client-side short-circuit to match the bonus
  // pattern (FIX-03: kickoff lockout is per-fixture).
  let losSaved = false

  if (activeCompetition && memberIsEligible && losTeamId && losGameweekId && losFixtureId) {
    if (losKickoffInFuture) {
      const { error: losError } = await supabase
        .from('los_picks')
        .upsert(
          {
            competition_id: activeCompetition.id,
            member_id: member.id,
            gameweek_id: losGameweekId,
            team_id: losTeamId,
            fixture_id: losFixtureId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'competition_id,member_id,gameweek_id' },
        )
      if (!losError) losSaved = true
      else console.error('[submitPredictions] LOS upsert error:', losError.message)
    }
    // else: losKickoffInFuture=false → silently skip (RLS would reject anyway)
  }

  // ── Step 7: Revalidate gameweek page ─────────────────────────────────────────
  revalidatePath('/gameweeks/' + gameweek_number)

  return { success: true, saved, skipped, bonusSaved, losSaved }
}

// ─── Get LOS Context (for form rendering) ─────────────────────────────────────

/**
 * Returns the LOS context for the current member in the current gameweek.
 *
 * Used by the prediction form to decide whether to show the LOS team picker
 * and which teams are still available.
 *
 * Returns null fields when no active competition exists, or when the member
 * is not linked to the active competition.
 */
export async function getLosContext(gameweekNumber: number): Promise<{
  activeCompetition: { id: string; status: string } | null
  memberStatus: 'active' | 'eliminated' | null
  availableTeams: Array<{ id: string; name: string; short_name: string | null; crest_url: string | null }>
  currentPickTeamId: string | null
}> {
  const supabase = await createServerSupabaseClient()

  const empty = {
    activeCompetition: null,
    memberStatus: null,
    availableTeams: [],
    currentPickTeamId: null,
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return empty

  const { data: member } = await supabase
    .from('members')
    .select('id, approval_status')
    .eq('user_id', user.id)
    .single()

  if (!member || member.approval_status !== 'approved') return empty

  const { data: activeCompetition } = await supabase
    .from('los_competitions')
    .select('id, status')
    .eq('status', 'active')
    .maybeSingle()

  if (!activeCompetition) return empty

  const { data: memberRow } = await supabase
    .from('los_competition_members')
    .select('status')
    .eq('competition_id', activeCompetition.id)
    .eq('member_id', member.id)
    .maybeSingle()

  const memberStatus = (memberRow?.status ?? null) as 'active' | 'eliminated' | null

  // Resolve current gameweek to scope the current-pick lookup
  const { data: gwRow } = await supabase
    .from('gameweeks')
    .select('id')
    .eq('number', gameweekNumber)
    .single()

  // Current-gameweek pick (for pre-populating the picker)
  let currentPickTeamId: string | null = null
  if (gwRow) {
    const { data: currentPick } = await supabase
      .from('los_picks')
      .select('team_id')
      .eq('competition_id', activeCompetition.id)
      .eq('member_id', member.id)
      .eq('gameweek_id', gwRow.id)
      .maybeSingle()
    currentPickTeamId = (currentPick?.team_id as string | undefined) ?? null
  }

  // Available teams = all PL teams − teams this member has used in this cycle
  // (but cycle-resets once all 20 used — via availableTeams pure helper).
  const { data: allTeams } = await supabase
    .from('teams')
    .select('id, name, short_name, crest_url')
    .order('name')

  const { data: priorPicks } = await supabase
    .from('los_picks')
    .select('team_id, gameweek_id')
    .eq('competition_id', activeCompetition.id)
    .eq('member_id', member.id)

  const { availableTeams } = await import('@/lib/los/team-usage')

  const allTeamIds: string[] = (allTeams ?? []).map((t: { id: string }) => t.id)
  // Exclude current-gameweek pick from "already used" so picker still shows it
  const pickedIds: string[] = ((priorPicks ?? []) as Array<{ team_id: string; gameweek_id: string }>)
    .filter((p) => !gwRow || p.gameweek_id !== gwRow.id)
    .map((p) => p.team_id)

  const availableIds = new Set(availableTeams({ all_team_ids: allTeamIds, picked_team_ids: pickedIds }))

  const filtered = (allTeams ?? [])
    .filter((t: { id: string }) => availableIds.has(t.id)) as Array<{ id: string; name: string; short_name: string | null; crest_url: string | null }>

  return {
    activeCompetition: activeCompetition as { id: string; status: string },
    memberStatus,
    availableTeams: filtered,
    currentPickTeamId,
  }
}

// ─── Lock Predictions for Gameweek ────────────────────────────────────────────

/**
 * Permanently locks the authenticated member's predictions for a gameweek.
 * Called from the "Copy my picks to WhatsApp" confirmation flow — once the
 * member confirms, their picks can't be edited for that week.
 *
 * Behaviour:
 *   - Requires an approved member
 *   - Inserts one row in prediction_locks (gameweek_id, member_id)
 *   - Idempotent: upsert on conflict (gameweek_id, member_id)
 *   - Revalidates the gameweek page so the locked UI renders on reload
 */
export async function lockPredictionsForWeek(
  gameweekNumber: number,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: member } = await supabase
    .from('members')
    .select('id, approval_status')
    .eq('user_id', user.id)
    .single()

  if (!member || member.approval_status !== 'approved') {
    return { success: false, error: 'Member not approved' }
  }

  const { data: gw } = await supabase
    .from('gameweeks')
    .select('id')
    .eq('number', gameweekNumber)
    .single()

  if (!gw) {
    return { success: false, error: 'Gameweek not found' }
  }

  const { error: insertError } = await supabase
    .from('prediction_locks')
    .upsert(
      {
        gameweek_id: gw.id,
        member_id: member.id,
        locked_at: new Date().toISOString(),
      },
      { onConflict: 'gameweek_id,member_id' },
    )

  if (insertError) {
    console.error('[lockPredictionsForWeek] insert error:', insertError.message)
    return {
      success: false,
      error: 'Could not lock your predictions. Please try again.',
    }
  }

  revalidatePath('/gameweeks/' + gameweekNumber)

  return { success: true }
}
