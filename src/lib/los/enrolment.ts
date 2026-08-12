/**
 * Last One Standing enrolment.
 *
 * A member only sees the LOS shields on the gameweek page when they have a
 * `los_competition_members` row with status='active' in the current cycle
 * (see getLosContext in src/actions/predictions.ts). Rows were only ever
 * created in two places — the season bootstrap script and
 * resetCompetitionIfNeeded — so anyone approved *after* a cycle started was
 * silently left out of LOS: predictions and bonus worked, the shield never
 * appeared.
 *
 * This helper closes that gap. Call it whenever a member becomes approved.
 * Idempotent and non-throwing — enrolment must never block approval.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export type EnrolResult =
  | { enrolled: true }
  | {
      enrolled: false
      reason: 'no-active-competition' | 'not-eligible' | 'already-enrolled' | 'error'
      detail?: string
    }

/**
 * Enrols one member in the currently-active LOS competition.
 *
 * Skips (without error) when:
 *   - there is no active competition
 *   - the member isn't approved, or is hidden from standings (placeholder
 *     point-holders can't log in to pick, mirroring resetCompetitionIfNeeded)
 *   - the member already has a row in this cycle — never overwrite an
 *     existing status, an eliminated member must stay eliminated
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function enrolMemberInActiveLos(
  adminClient: SupabaseClient<any>,
  memberId: string,
): Promise<EnrolResult> {
  try {
    const { data: activeCompetition } = await adminClient
      .from('los_competitions')
      .select('id')
      .eq('status', 'active')
      .maybeSingle()

    const competitionId = (activeCompetition as { id?: string } | null)?.id
    if (!competitionId) return { enrolled: false, reason: 'no-active-competition' }

    const { data: member } = await adminClient
      .from('members')
      .select('approval_status, exclude_from_standings')
      .eq('id', memberId)
      .maybeSingle()

    const memberRow = member as
      | { approval_status?: string; exclude_from_standings?: boolean }
      | null

    if (
      !memberRow ||
      memberRow.approval_status !== 'approved' ||
      memberRow.exclude_from_standings === true
    ) {
      return { enrolled: false, reason: 'not-eligible' }
    }

    const { data: existing } = await adminClient
      .from('los_competition_members')
      .select('id')
      .eq('competition_id', competitionId)
      .eq('member_id', memberId)
      .maybeSingle()

    if (existing) return { enrolled: false, reason: 'already-enrolled' }

    const { error } = await adminClient
      .from('los_competition_members')
      .insert({ competition_id: competitionId, member_id: memberId, status: 'active' })

    if (error) return { enrolled: false, reason: 'error', detail: error.message }

    return { enrolled: true }
  } catch (err) {
    return {
      enrolled: false,
      reason: 'error',
      detail: err instanceof Error ? err.message : String(err),
    }
  }
}
