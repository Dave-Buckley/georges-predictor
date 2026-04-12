/**
 * /members/[slug] — Member profile page.
 * Phase 11 Plan 02 Task 2.
 *
 * Auth-gated under (member) route group — unauth viewers are redirected
 * to /login by the layout. This page also calls redirect('/login') as
 * defence-in-depth.
 *
 * Data flow:
 *   1. Resolve viewer session (server client).
 *   2. Resolve target member via findMemberBySlug (admin client).
 *   3. If unknown slug -> render "Member not found" empty state.
 *   4. Fetch current-season data in parallel + compute SeasonStats.
 *   5. For each archived season (seasons.ended_at IS NOT NULL), repeat.
 *   6. Render header + stats + achievements + chart + history.
 */
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { findMemberBySlug } from '@/lib/members/slug'
import { aggregateSeasonStats, type SeasonStats } from '@/lib/profile/stats'
import { WeeklyPointsChart } from '@/components/charts/weekly-points-chart'
import type { TeamRow } from '@/lib/supabase/types'

import { ProfileHeader } from './_components/profile-header'
import { SeasonStatsPanel } from './_components/season-stats-panel'
import { AchievementBadges } from './_components/achievement-badges'
import {
  SeasonHistoryTable,
  type SeasonHistoryEntry,
} from './_components/season-history-table'

export const dynamic = 'force-dynamic'

// ─── Helper: current season resolution ───────────────────────────────────────

/**
 * Return the numeric year of the current season (the most recent season
 * without `ended_at`). Falls back to `new Date().getFullYear()` if the
 * seasons table is empty.
 */
async function resolveCurrentSeason(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
): Promise<number> {
  const { data } = await admin
    .from('seasons')
    .select('season')
    .is('ended_at', null)
    .order('season', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (data?.season) return data.season as number
  return new Date().getFullYear()
}

// ─── Helper: compute one season's stats ──────────────────────────────────────

async function computeStatsForSeason(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  memberId: string,
  season: number,
): Promise<{ stats: SeasonStats; weeklyBreakdown: Array<{ gw: number; points: number; runningTotal: number }> }> {
  // Gameweeks for this season (id + number).
  const { data: gwRaw } = await admin
    .from('gameweeks')
    .select('id, number, season')
    .eq('season', season)
    .order('number', { ascending: true })
  const gameweeks = ((gwRaw ?? []) as Array<{
    id: string
    number: number
    season: number
  }>).map((g) => ({ id: g.id, number: g.number }))
  const gwIds = gameweeks.map((g) => g.id)
  const gwIdList = gwIds.length > 0 ? gwIds : ['00000000-0000-0000-0000-000000000000']

  // Fetch all cross-cutting data in parallel.
  const [
    psRes,
    baRes,
    paRes,
    psaRes,
    lpRes,
    lcRes,
    lcmRes,
    hsRes,
    fixturesRes,
    membersRes,
  ] = await Promise.all([
    admin
      .from('prediction_scores')
      .select(
        'id, member_id, fixture_id, predicted_home, predicted_away, actual_home, actual_away, result_correct, score_correct, points_awarded',
      ),
    admin
      .from('bonus_awards')
      .select(
        'id, gameweek_id, member_id, bonus_type_id, fixture_id, awarded, points_awarded',
      )
      .eq('member_id', memberId)
      .in('gameweek_id', gwIdList),
    admin
      .from('prize_awards')
      .select(
        'id, prize_id, member_id, gameweek_id, status, snapshot_data',
      )
      .eq('member_id', memberId),
    admin
      .from('pre_season_awards')
      .select('*')
      .eq('member_id', memberId)
      .eq('season', season)
      .maybeSingle(),
    admin.from('los_picks').select('*').eq('member_id', memberId),
    admin.from('los_competitions').select('*').eq('season', season),
    admin.from('los_competition_members').select('*'),
    admin
      .from('h2h_steals')
      .select('*')
      .in('detected_in_gw_id', gwIdList),
    admin
      .from('fixtures')
      .select('id, gameweek_id')
      .in('gameweek_id', gwIdList),
    admin
      .from('members')
      .select('id, starting_points'),
  ])

  const fixturesById = new Map<string, { id: string; gameweek_id: string }>()
  for (const f of (fixturesRes.data ?? []) as Array<{
    id: string
    gameweek_id: string
  }>) {
    fixturesById.set(f.id, f)
  }

  // Enrich prediction_scores with gameweek_id for aggregation/grouping.
  const predictionScoresRaw = (psRes.data ?? []) as Array<{
    member_id: string
    fixture_id: string
    result_correct: boolean
    score_correct: boolean
    points_awarded: number
  }>
  const predictionScores = predictionScoresRaw
    .map((p) => {
      const fx = fixturesById.get(p.fixture_id)
      if (!fx) return null
      return {
        ...p,
        gameweek_id: fx.gameweek_id,
      }
    })
    .filter(
      (p): p is {
        member_id: string
        fixture_id: string
        gameweek_id: string
        result_correct: boolean
        score_correct: boolean
        points_awarded: number
      } => p !== null,
    )

  // All-member totals for rank derivation — use members.starting_points (the
  // current aggregate) for current season. For archived seasons this is a
  // proxy until a per-season snapshot table is added in Phase 11 Plan 03.
  const allMemberTotals = (
    (membersRes.data ?? []) as Array<{
      id: string
      starting_points: number | null
    }>
  ).map((m) => ({
    memberId: m.id,
    totalPoints: m.starting_points ?? 0,
  }))

  // Weekly leaderboard — group prediction_scores + confirmed bonus points by
  // gameweek per member, find sole top scorer(s) per GW.
  const bonusConfirmedByMemberGw = new Map<string, number>()
  for (const b of (baRes.data ?? []) as Array<{
    gameweek_id: string
    member_id: string
    awarded: boolean | null
    points_awarded: number
  }>) {
    if (b.awarded !== true) continue
    const k = `${b.member_id}:${b.gameweek_id}`
    bonusConfirmedByMemberGw.set(
      k,
      (bonusConfirmedByMemberGw.get(k) ?? 0) + (b.points_awarded ?? 0),
    )
  }

  const totalsByMemberGw = new Map<string, number>()
  for (const p of predictionScores) {
    const k = `${p.member_id}:${p.gameweek_id}`
    totalsByMemberGw.set(
      k,
      (totalsByMemberGw.get(k) ?? 0) + (p.points_awarded ?? 0),
    )
  }
  for (const [k, v] of bonusConfirmedByMemberGw.entries()) {
    totalsByMemberGw.set(k, (totalsByMemberGw.get(k) ?? 0) + v)
  }

  const weeklyLeaderboard = gameweeks.map((gw) => {
    const entries: Array<{ memberId: string; total: number }> = []
    for (const [k, total] of totalsByMemberGw.entries()) {
      const [mId, gId] = k.split(':')
      if (gId === gw.id) entries.push({ memberId: mId, total })
    }
    if (entries.length === 0)
      return { gameweekId: gw.id, topMemberIds: [] as string[] }
    const top = Math.max(...entries.map((e) => e.total))
    if (top <= 0) return { gameweekId: gw.id, topMemberIds: [] as string[] }
    const topMemberIds = entries
      .filter((e) => e.total === top)
      .map((e) => e.memberId)
    return { gameweekId: gw.id, topMemberIds }
  })

  const stats = aggregateSeasonStats({
    predictionScores,
    bonusAwards: (baRes.data ?? []) as Array<{
      member_id: string
      awarded: boolean | null
      points_awarded: number
    }>,
    prizeAwards: (paRes.data ?? []) as Array<{
      member_id: string | null
      status: 'pending' | 'confirmed' | 'rejected'
      points_awarded?: number | null
    }>,
    preSeasonAward: (psaRes.data ?? null) as null | {
      member_id: string
      season: number
      awarded_points: number
      confirmed: boolean
      flags?: {
        all_top4_correct?: boolean
        all_relegated_correct?: boolean
        all_promoted_correct?: boolean
        all_correct_overall?: boolean
      }
    },
    losPicks: (lpRes.data ?? []) as Array<{
      member_id: string
      competition_id: string
      team_id: string
    }>,
    losCompetitions: (lcRes.data ?? []) as Array<{
      id: string
      season: number
      winner_id: string | null
      status: 'active' | 'complete'
      ended_at_gw?: number | null
    }>,
    losCompetitionMembers: (lcmRes.data ?? []) as Array<{
      competition_id: string
      member_id: string
      status: 'active' | 'eliminated'
      eliminated_at_gw: number | null
    }>,
    h2hSteals: (hsRes.data ?? []) as Array<{
      detected_in_gw_id: string
      winner_ids: string[] | null
      tied_member_ids: string[]
      resolved_at: string | null
    }>,
    gameweeks,
    weeklyLeaderboard,
    allMemberTotals,
    memberId,
    season,
  })

  // Per-GW weekly breakdown for the chart (member only).
  let running = 0
  const weeklyBreakdown = gameweeks.map((gw) => {
    const key = `${memberId}:${gw.id}`
    const pts = totalsByMemberGw.get(key) ?? 0
    running += pts
    return { gw: gw.number, points: pts, runningTotal: running }
  })

  return { stats, weeklyBreakdown }
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const viewerIsAdmin = user.app_metadata?.role === 'admin'

  const admin = createAdminClient()

  // Resolve the target member.
  const memberRow = await findMemberBySlug(admin, slug)
  if (!memberRow) {
    return (
      <div className="space-y-4 max-w-md mx-auto py-16 text-center">
        <h1 className="text-xl font-bold text-white">Member not found</h1>
        <p className="text-slate-400 text-sm">
          We couldn&apos;t find a member with that link. They may have been
          removed, or the link might have a typo.
        </p>
        <Link
          href="/standings"
          className="inline-block text-sm text-purple-400 hover:text-purple-300"
        >
          Back to the league table
        </Link>
      </div>
    )
  }

  const member = memberRow as unknown as {
    id: string
    display_name: string
    email: string | null
    favourite_team_id: string | null
    created_at: string
    approval_status: string
  }

  // Resolve current season + compute stats.
  const currentSeason = await resolveCurrentSeason(admin)
  const { stats: currentStats, weeklyBreakdown } = await computeStatsForSeason(
    admin,
    member.id,
    currentSeason,
  )

  // Favourite team (optional).
  let favouriteTeam: TeamRow | null = null
  if (member.favourite_team_id) {
    const { data: teamRow } = await admin
      .from('teams')
      .select('*')
      .eq('id', member.favourite_team_id)
      .maybeSingle()
    favouriteTeam = (teamRow as TeamRow | null) ?? null
  }

  // Archived seasons for history table.
  const { data: archivedRaw } = await admin
    .from('seasons')
    .select('season, ended_at')
    .not('ended_at', 'is', null)
    .order('season', { ascending: false })
  const archivedSeasons = ((archivedRaw ?? []) as Array<{
    season: number
    ended_at: string | null
  }>).map((r) => r.season)

  const historyEntries: SeasonHistoryEntry[] = await Promise.all(
    archivedSeasons.map(async (s) => {
      const { stats } = await computeStatsForSeason(admin, member.id, s)
      return {
        season: s,
        rank: stats.rank,
        totalPoints: stats.totalPoints,
        losWins: stats.losWins,
        gwWinnerCount: stats.gwWinnerCount,
      } satisfies SeasonHistoryEntry
    }),
  )

  return (
    <div className="space-y-6">
      <ProfileHeader
        member={member}
        favouriteTeam={favouriteTeam}
        viewerIsAdmin={viewerIsAdmin}
      />
      <SeasonStatsPanel stats={currentStats} />
      <AchievementBadges achievements={currentStats.achievements} />
      {weeklyBreakdown.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
            Weekly points trend
          </h2>
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
            <WeeklyPointsChart weeks={weeklyBreakdown} />
          </div>
        </section>
      ) : null}
      <SeasonHistoryTable
        entries={historyEntries}
        memberDisplayName={member.display_name}
      />
    </div>
  )
}

