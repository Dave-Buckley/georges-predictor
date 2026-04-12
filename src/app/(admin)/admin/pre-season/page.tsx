/**
 * Admin pre-season page (Phase 9 Plan 03).
 *
 * Three sections, rendered conditionally based on season state:
 *
 *   (a) Monitoring    — always visible; table of members + submission status
 *   (b) Actuals entry — once GW1 has kicked off
 *   (c) Awards        — once actuals are locked
 *
 * Season selection priority:
 *   - Upcoming season (gw1_kickoff > now) if one is open for submissions
 *   - Else the current (past-GW1) season for actuals + awards work
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentSeason, getUpcomingSeason } from '@/lib/pre-season/seasons'
import { getPreSeasonExportRows } from '@/lib/pre-season/export'
import { getChampionshipTeams } from '@/actions/admin/championship'
import type {
  MemberRow,
  PreSeasonAwardRow,
  PreSeasonAwardFlags,
} from '@/lib/supabase/types'
import {
  AdminPreSeasonTable,
  buildAdminPreSeasonRows,
} from './_components/admin-pre-season-table'
import { SeasonActualsForm } from './_components/season-actuals-form'
import { CalculateAwardsButton } from './_components/calculate-awards-button'
import {
  ConfirmPreSeasonAwards,
  type AwardRow as AwardUiRow,
} from './_components/confirm-pre-season-awards'
import { ChampionshipManagement } from './_components/championship-management'
import { EndOfSeasonRollover } from './_components/end-of-season-rollover'

export const dynamic = 'force-dynamic'

export default async function AdminPreSeasonPage() {
  const [upcoming, current] = await Promise.all([
    getUpcomingSeason(),
    getCurrentSeason(),
  ])

  // Prefer the upcoming season for monitoring (submissions window); fall back
  // to the current season for actuals + awards flow at end-of-season.
  const activeSeason = upcoming ?? current

  if (!activeSeason) {
    return (
      <div className="p-6 lg:p-8 max-w-5xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Pre-Season</h1>
        <p className="text-gray-500">
          No season is seeded. Run the 2026-27 / 2027-28 seed migration before
          opening the pre-season window.
        </p>
      </div>
    )
  }

  const admin = createAdminClient()

  // Load data in parallel (Phase 3 pattern — no waterfalls)
  const [membersRes, awardsRes, plTeamsRes, exportRows, championshipTeams] =
    await Promise.all([
      admin
        .from('members')
        .select('id, display_name')
        .eq('approval_status', 'approved')
        .order('display_name', { ascending: true }),
      admin
        .from('pre_season_awards')
        .select('*')
        .eq('season', activeSeason.season),
      admin.from('teams').select('name').order('name', { ascending: true }),
      getPreSeasonExportRows(activeSeason.season),
      getChampionshipTeams(activeSeason.season),
    ])

  const members =
    (membersRes.data as Pick<MemberRow, 'id' | 'display_name'>[] | null) ?? []
  const awards = (awardsRes.data as PreSeasonAwardRow[] | null) ?? []
  const plTeams =
    (plTeamsRes.data as Array<{ name: string | null }> | null)
      ?.map((t) => ({ name: t.name ?? '' }))
      .filter((t) => t.name.length > 0) ?? []

  const championshipNames: readonly string[] = championshipTeams.map((t) => t.name)

  const tableRows = buildAdminPreSeasonRows(members, exportRows)

  // Determine UI state flags
  const windowOpen = upcoming && new Date(upcoming.gw1_kickoff) > new Date()
  const actualsLocked = Boolean(activeSeason.actuals_locked_at)
  const showActualsSection = !windowOpen // only shown once GW1 has begun
  const showAwardsSection = actualsLocked

  // Build award UI rows with member names joined
  const memberNameById = new Map(members.map((m) => [m.id, m.display_name]))
  const awardUiRows: AwardUiRow[] = awards.map((a) => ({
    member_id: a.member_id,
    member_name: memberNameById.get(a.member_id) ?? 'Unknown',
    calculated_points: a.calculated_points,
    awarded_points: a.awarded_points,
    flags: (a.flags ?? {
      all_top4_correct: false,
      all_relegated_correct: false,
      all_promoted_correct: false,
      all_correct_overall: false,
    }) as PreSeasonAwardFlags,
    confirmed: a.confirmed,
  }))
  // Unconfirmed first, then alpha
  awardUiRows.sort((a, b) => {
    if (a.confirmed !== b.confirmed) return a.confirmed ? 1 : -1
    return a.member_name.localeCompare(b.member_name)
  })

  const awardsAllConfirmed =
    awards.length > 0 && awards.every((a) => a.confirmed)
  const showRollover = actualsLocked // rollover section visible once actuals locked

  return (
    <div className="p-6 lg:p-8 max-w-6xl space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Pre-Season</h1>
        <p className="text-gray-500 mt-1">
          {activeSeason.label} — monitor submissions, enter season-end actuals,
          and confirm awards.
        </p>
      </header>

      {/* ── (a) Monitoring ────────────────────────────────────────────── */}
      <section>
        <AdminPreSeasonTable
          season={activeSeason.season}
          plTeams={plTeams}
          championship={championshipNames}
          rows={tableRows}
        />
      </section>

      {/* ── (b) Actuals entry ─────────────────────────────────────────── */}
      {showActualsSection && (
        <section>
          <SeasonActualsForm
            season={activeSeason.season}
            plTeams={plTeams}
            championship={championshipNames}
            existingActuals={{
              final_top4: activeSeason.final_top4 ?? [],
              final_tenth: activeSeason.final_tenth,
              final_relegated: activeSeason.final_relegated ?? [],
              final_promoted: activeSeason.final_promoted ?? [],
              final_playoff_winner: activeSeason.final_playoff_winner,
            }}
            actualsLockedAt={activeSeason.actuals_locked_at}
          />
        </section>
      )}

      {/* ── (c) Awards section ────────────────────────────────────────── */}
      {showAwardsSection && (
        <section className="space-y-4">
          <CalculateAwardsButton
            season={activeSeason.season}
            hasAwards={awards.length > 0}
          />
          {awards.length > 0 && (
            <ConfirmPreSeasonAwards
              season={activeSeason.season}
              awards={awardUiRows}
            />
          )}
        </section>
      )}

      {/* ── (d) Championship team management ──────────────────────────── */}
      <section>
        <ChampionshipManagement
          season={activeSeason.season}
          teams={championshipTeams}
        />
      </section>

      {/* ── (e) End-of-season rollover ────────────────────────────────── */}
      {showRollover && (
        <section>
          <EndOfSeasonRollover
            fromSeason={activeSeason.season}
            actualsLocked={actualsLocked}
            awardsAllConfirmed={awardsAllConfirmed}
            relegated={activeSeason.final_relegated ?? []}
            promoted={activeSeason.final_promoted ?? []}
          />
        </section>
      )}
    </div>
  )
}
