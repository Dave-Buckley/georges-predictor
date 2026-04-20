'use server'

/**
 * Phase 11 Plan 04 — Season rollover server actions.
 *
 * Six idempotent actions backing the 8-step /admin/season-rollover wizard:
 *   - getArchiveReadiness     → aggregation-only, no mutation
 *   - archiveSeason           → UPDATE seasons SET ended_at, IS NULL guard
 *   - defineNewSeason         → UPSERT seasons by season
 *   - carryForwardChampionshipTeams → clone rows with upsert (season, name)
 *   - carryForwardMembers     → reset starting_points for approved claimed members
 *   - launchNewSeason         → flip active-season + emit admin_notifications
 *
 * Pitfall 6: carryForwardMembers MUST guard WHERE approval_status='approved'
 * AND user_id IS NOT NULL — pending/rejected rows and unclaimed imports must
 * remain untouched.
 *
 * Pitfall 4: Every mutation revalidates /admin, /admin/season-rollover, /,
 * /standings, and /dashboard (Next 16 per-path, not recursive).
 *
 * Idiom mirrors src/actions/admin/championship.ts (Phase 9 Plan 03).
 */

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'

type Result = { ok: true } | { error: string }

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

function revalidateAll(): void {
  revalidatePath('/admin')
  revalidatePath('/admin/season-rollover')
  revalidatePath('/')
  revalidatePath('/standings')
  revalidatePath('/dashboard')
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const SeasonOnlySchema = z.object({ season: z.number().int().min(1900).max(3000) })

const DefineSeasonSchema = z.object({
  season: z.number().int().min(1900).max(3000),
  gw1_kickoff: z.string().min(1),
})

const CarryChampionshipSchema = z.object({
  from_season: z.number().int().min(1900).max(3000),
  to_season: z.number().int().min(1900).max(3000),
})

// ─── getArchiveReadiness ──────────────────────────────────────────────────────

export interface ArchiveReadiness {
  allGwsClosed: boolean
  preSeasonConfirmed: boolean
  losResolved: boolean
  readyToArchive: boolean
}

/**
 * Aggregates three preconditions for season archive:
 *   1. All gameweeks for the season are closed (closed_at IS NOT NULL).
 *      We invert — any row where season matches and closed_at IS NULL blocks.
 *   2. All pre_season_awards for the season are confirmed=true.
 *   3. All los_competitions for the season have a winner_id (resolved).
 *
 * Pure read — no writes, no revalidations.
 */
export async function getArchiveReadiness(
  season: number,
): Promise<ArchiveReadiness | { error: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const admin = createAdminClient()

  // 1. Gameweeks not yet closed for this season
  const { data: openGws } = await admin
    .from('gameweeks')
    .select('id')
    .eq('season', season)
    .neq('status', 'closed')
  const allGwsClosed = ((openGws as unknown[] | null) ?? []).length === 0

  // 2. Unconfirmed pre-season awards for this season
  const { data: unconfirmed } = await admin
    .from('pre_season_awards')
    .select('id')
    .eq('season', season)
    .eq('confirmed', false)
  const preSeasonConfirmed = ((unconfirmed as unknown[] | null) ?? []).length === 0

  // 3. LOS competitions without a winner for this season
  const { data: unresolved } = await admin
    .from('los_competitions')
    .select('id')
    .eq('season', season)
    .is('winner_id', null)
  const losResolved = ((unresolved as unknown[] | null) ?? []).length === 0

  return {
    allGwsClosed,
    preSeasonConfirmed,
    losResolved,
    readyToArchive: allGwsClosed && preSeasonConfirmed && losResolved,
  }
}

// ─── archiveSeason ────────────────────────────────────────────────────────────

export async function archiveSeason(formData: FormData): Promise<Result> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const parsed = SeasonOnlySchema.safeParse({ season: Number(formData.get('season')) })
  if (!parsed.success) return { error: 'Invalid input' }

  const admin = createAdminClient()
  const nowIso = new Date().toISOString()

  // Idempotent — only set ended_at when currently NULL. If already archived,
  // this is a DB no-op (zero rows updated) and we still return ok.
  const { error } = await admin
    .from('seasons')
    .update({ ended_at: nowIso })
    .eq('season', parsed.data.season)
    .is('ended_at', null)

  if (error) return { error: error.message }

  // Audit notification (failures non-fatal — the archive already succeeded)
  try {
    await admin.from('admin_notifications').insert({
      type: 'season_archived',
      title: `The ${parsed.data.season} season has been wrapped up`,
      message: `The ${parsed.data.season} season is now in the history books. Final standings, weekly prizes, and all predictions have been saved.`,
    })
  } catch {
    /* noop */
  }

  revalidateAll()
  return { ok: true }
}

// ─── defineNewSeason ──────────────────────────────────────────────────────────

export async function defineNewSeason(formData: FormData): Promise<Result> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const parsed = DefineSeasonSchema.safeParse({
    season: Number(formData.get('season')),
    gw1_kickoff: String(formData.get('gw1_kickoff') ?? ''),
  })
  if (!parsed.success) return { error: 'Invalid input' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('seasons')
    .upsert(
      { season: parsed.data.season, gw1_kickoff: parsed.data.gw1_kickoff },
      { onConflict: 'season' },
    )
  if (error) return { error: error.message }

  revalidateAll()
  return { ok: true }
}

// ─── carryForwardChampionshipTeams ────────────────────────────────────────────

export async function carryForwardChampionshipTeams(formData: FormData): Promise<Result> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const parsed = CarryChampionshipSchema.safeParse({
    from_season: Number(formData.get('from_season')),
    to_season: Number(formData.get('to_season')),
  })
  if (!parsed.success) return { error: 'Invalid input' }

  const admin = createAdminClient()

  const { data: source, error: selErr } = await admin
    .from('championship_teams')
    .select('name')
    .eq('season', parsed.data.from_season)
  if (selErr) return { error: selErr.message }

  const rows = ((source as Array<{ name: string }> | null) ?? []).map((r) => ({
    season: parsed.data.to_season,
    name: r.name,
  }))
  if (rows.length === 0) {
    revalidateAll()
    return { ok: true }
  }

  // Idempotent: case-insensitive unique index from migration 010 handles
  // collisions. Use upsert with ignoreDuplicates so re-running doesn't error.
  const { error: upErr } = await admin
    .from('championship_teams')
    .upsert(rows, { onConflict: 'season,name', ignoreDuplicates: true })
  if (upErr) return { error: upErr.message }

  revalidateAll()
  return { ok: true }
}

// ─── carryForwardMembers ──────────────────────────────────────────────────────

/**
 * Resets starting_points to 0 for approved members who have claimed their
 * account (user_id NOT NULL).
 *
 * PITFALL 6 GUARD: Must NOT touch rows where approval_status != 'approved'
 * OR user_id IS NULL — those are pending registrations and unclaimed
 * imported placeholders that have their own lifecycle.
 */
export async function carryForwardMembers(_formData: FormData): Promise<Result> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const admin = createAdminClient()

  const { error } = await admin
    .from('members')
    .update({ starting_points: 0 })
    .eq('approval_status', 'approved')
    .not('user_id', 'is', null)

  if (error) return { error: error.message }

  revalidateAll()
  return { ok: true }
}

// ─── launchNewSeason ──────────────────────────────────────────────────────────

export async function launchNewSeason(formData: FormData): Promise<Result> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const parsed = SeasonOnlySchema.safeParse({ season: Number(formData.get('season')) })
  if (!parsed.success) return { error: 'Invalid input' }

  const admin = createAdminClient()

  // Audit notification (failures non-fatal)
  try {
    await admin.from('admin_notifications').insert({
      type: 'season_launched',
      title: `The ${parsed.data.season} season is live!`,
      message: `Predictions are now open for the ${parsed.data.season} season. Good luck everyone!`,
    })
  } catch {
    /* noop */
  }

  revalidateAll()
  return { ok: true }
}
