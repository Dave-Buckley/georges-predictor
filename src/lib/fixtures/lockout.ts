// ─── Prediction Lockout Utility ───────────────────────────────────────────────
// Server-side lockout check for Phase 3 prediction server actions.
// Provides two layers of enforcement alongside the RLS policy in migration 002.

import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { FixtureStatus } from '@/lib/supabase/types'

export interface LockoutResult {
  canSubmit: boolean
  reason?: string
  fixture?: {
    kickoff_time: string
    status: string
  }
}

/**
 * Statuses where predictions are not allowed, regardless of kickoff time.
 * These fixtures are in-progress, finished, or otherwise closed.
 */
const NON_PREDICTABLE_STATUSES: FixtureStatus[] = [
  'IN_PLAY',
  'PAUSED',
  'FINISHED',
  'POSTPONED',
  'SUSPENDED',
  'CANCELLED',
  'AWARDED',
]

/**
 * Server-side check whether a prediction can be submitted for a given fixture.
 *
 * Returns { canSubmit: true } if:
 *   - The fixture exists
 *   - now() is before kickoff_time
 *   - The fixture status is SCHEDULED or TIMED
 *
 * Returns { canSubmit: false, reason } if:
 *   - The fixture is not found
 *   - kickoff_time has already passed
 *   - The fixture is in a non-predictable status
 *
 * Used by Phase 3 prediction server actions as the primary server-side gate.
 * Combined with the RLS policy on predictions (defined in 002_fixture_layer.sql)
 * for two-layer enforcement (FIX-03).
 */
export async function canSubmitPrediction(fixtureId: string): Promise<LockoutResult> {
  const supabase = await createServerSupabaseClient()

  const { data: fixture, error } = await supabase
    .from('fixtures')
    .select('kickoff_time, status')
    .eq('id', fixtureId)
    .single()

  if (error || !fixture) {
    return { canSubmit: false, reason: 'Fixture not found' }
  }

  if (new Date() >= new Date(fixture.kickoff_time)) {
    return {
      canSubmit: false,
      reason: 'This fixture has kicked off — predictions are locked',
      fixture,
    }
  }

  if (NON_PREDICTABLE_STATUSES.includes(fixture.status as FixtureStatus)) {
    return {
      canSubmit: false,
      reason: `Fixture status is ${fixture.status} — predictions are locked`,
      fixture,
    }
  }

  return { canSubmit: true, fixture }
}
