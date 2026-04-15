/**
 * Shared helpers for computing a member's season stats + weekly breakdown.
 * Extracted from /members/[slug]/page.tsx so /compare can reuse the same
 * aggregator without duplication.
 */
import 'server-only'

import { aggregateSeasonStats, type SeasonStats } from '@/lib/profile/stats'

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function resolveCurrentSeason(admin: any): Promise<number> {
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

export interface SeasonComputeResult {
  stats: SeasonStats
  weeklyBreakdown: Array<{ gw: number; points: number; runningTotal: number }>
}

export async function computeStatsForSeason(
  admin: any,
  memberId: string,
  season: number,
): Promise<SeasonComputeResult> {
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
      .select('id, prize_id, member_id, gameweek_id, status, snapshot_data')
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
    admin.from('members').select('id, starting_points'),
  ])

  const fixturesById = new Map<string, { id: string; gameweek_id: string }>()
  for (const f of (fixturesRes.data ?? []) as Array<{
    id: string
    gameweek_id: string
  }>) {
    fixturesById.set(f.id, f)
  }

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
      return { ...p, gameweek_id: fx.gameweek_id }
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

  const allMemberTotals = (
    (membersRes.data ?? []) as Array<{
      id: string
      starting_points: number | null
    }>
  ).map((m) => ({
    memberId: m.id,
    totalPoints: m.starting_points ?? 0,
  }))

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

  let running = 0
  const weeklyBreakdown = gameweeks.map((gw) => {
    const key = `${memberId}:${gw.id}`
    const pts = totalsByMemberGw.get(key) ?? 0
    running += pts
    return { gw: gw.number, points: pts, runningTotal: running }
  })

  return { stats, weeklyBreakdown }
}

/* eslint-enable @typescript-eslint/no-explicit-any */
