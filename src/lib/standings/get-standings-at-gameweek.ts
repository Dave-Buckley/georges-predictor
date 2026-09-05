/**
 * Cumulative standings as of the end of a chosen gameweek.
 *
 * `members.starting_points` already incorporates every gameweek where
 * `points_applied = true` (the weekly→starting roll done at close). To get
 * the table at end of GWX we therefore:
 *   - add weekly scores for not-yet-applied gws with number <= X
 *   - subtract weekly scores for already-applied gws with number > X
 *
 * Weekly score per gw = Σ prediction_scores + Σ awarded bonuses, doubled
 * if double_bubble, then + point_adjustments — matches the math used by
 * `gatherGameweekData`.
 *
 * Scope: only the gameweeks whose weekly total actually changes the answer
 * are read — the target gw, plus the handful the formula above adds or
 * subtracts. Everything else is already baked into starting_points. That
 * keeps this page's cost flat as seasons accumulate instead of growing with
 * every year the league has ever played, and it goes through
 * `fetchAllRows*`, which pages past PostgREST's silent 1000-row cap.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchAllRows, fetchAllRowsIn } from '@/lib/supabase/fetch-all'
import {
  getFavouriteBadges,
  type FavouriteBadge,
} from '@/lib/members/favourite-clubs'

export interface StandingsRow {
  memberId: string
  displayName: string
  rank: number
  weeklyPoints: number
  totalPoints: number
  /**
   * Favourite-club badge (migration 029). Null when the member has not picked
   * one, and null for everyone until that migration is applied.
   */
  badge: FavouriteBadge | null
}

export interface StandingsAtGameweek {
  gwNumber: number
  gwId: string
  doubleBubbleActive: boolean
  status: 'scheduled' | 'active' | 'complete' | string
  rows: StandingsRow[]
}

interface GameweekMeta {
  id: string
  number: number
  status: string
  double_bubble: boolean
  points_applied: boolean
}

export async function getStandingsAtGameweek(
  gwNumber: number,
): Promise<StandingsAtGameweek | null> {
  const admin = createAdminClient()

  const [
    gameweeksRaw,
    membersRaw,
  ] = await Promise.all([
    // Gameweek numbers repeat every season, so read one season's worth and
    // resolve `gwNumber` inside it. `latestSeason` is the season currently
    // being played; older seasons live on untouched for member history.
    (async () => {
      const { data: seasonRow } = await admin
        .from('gameweeks')
        .select('season')
        .order('season', { ascending: false })
        .limit(1)
        .maybeSingle()
      const season = (seasonRow as { season: number } | null)?.season
      if (season === undefined) return [] as GameweekMeta[]
      return fetchAllRows<GameweekMeta>(() =>
        admin
          .from('gameweeks')
          .select('id, number, status, double_bubble, points_applied')
          .eq('season', season),
      )
    })(),
    fetchAllRows<{ id: string; display_name: string; starting_points: number | null }>(() =>
      admin
        .from('members')
        .select('id, display_name, starting_points')
        .eq('approval_status', 'approved')
        .eq('exclude_from_standings', false),
    ),
  ])

  const gameweeks = (gameweeksRaw ?? []) as GameweekMeta[]
  const target = gameweeks.find((g) => g.number === gwNumber)
  if (!target) return null

  // The only gameweeks that move the total: the target itself (shown as this
  // week's points), those at or before it not yet rolled into starting_points,
  // and those after it that already were. Typically one or two.
  const neededGws = gameweeks.filter(
    (gw) =>
      gw.id === target.id ||
      (gw.number <= target.number && !gw.points_applied) ||
      (gw.number > target.number && gw.points_applied),
  )
  const neededGwIds = neededGws.map((gw) => gw.id)

  // Map fixture_id → gameweek_id so prediction_scores can be bucketed by gw.
  const fixturesRaw = await fetchAllRowsIn<{ id: string; gameweek_id: string }>(
    neededGwIds,
    (ids) => admin.from('fixtures').select('id, gameweek_id').in('gameweek_id', ids),
  )
  const fixtureToGw = new Map<string, string>()
  for (const f of fixturesRaw) {
    fixtureToGw.set(f.id, f.gameweek_id)
  }
  const fixtureIds = fixturesRaw.map((f) => f.id)

  const [scoresRaw, bonusesRaw, adjustmentsRaw] = await Promise.all([
    fetchAllRowsIn<{
      member_id: string
      fixture_id: string
      points_awarded: number | null
    }>(fixtureIds, (ids) =>
      admin
        .from('prediction_scores')
        .select('member_id, fixture_id, points_awarded')
        .in('fixture_id', ids),
    ),
    fetchAllRowsIn<{
      gameweek_id: string
      member_id: string
      awarded: boolean | null
      points_awarded: number | null
    }>(neededGwIds, (ids) =>
      admin
        .from('bonus_awards')
        .select('gameweek_id, member_id, awarded, points_awarded')
        .in('gameweek_id', ids),
    ),
    fetchAllRowsIn<{
      gameweek_id: string
      member_id: string
      delta: number | null
    }>(neededGwIds, (ids) =>
      admin
        .from('point_adjustments')
        .select('gameweek_id, member_id, delta')
        .in('gameweek_id', ids),
    ),
  ])

  // weekly[memberId][gwId] = pre-double-bubble base from prediction_scores +
  // awarded bonuses. We multiply once per gw (uniform ×2) then add
  // adjustments — matches gather-gameweek-data.
  const baseByMemberGw = new Map<string, Map<string, number>>()
  const addBase = (memberId: string, gwId: string, delta: number) => {
    let m = baseByMemberGw.get(memberId)
    if (!m) {
      m = new Map()
      baseByMemberGw.set(memberId, m)
    }
    m.set(gwId, (m.get(gwId) ?? 0) + delta)
  }

  for (const s of scoresRaw) {
    const gwId = fixtureToGw.get(s.fixture_id)
    if (!gwId) continue
    addBase(s.member_id, gwId, s.points_awarded ?? 0)
  }
  for (const b of bonusesRaw) {
    if (b.awarded !== true) continue
    addBase(b.member_id, b.gameweek_id, b.points_awarded ?? 0)
  }

  const adjByMemberGw = new Map<string, Map<string, number>>()
  for (const a of adjustmentsRaw) {
    let m = adjByMemberGw.get(a.member_id)
    if (!m) {
      m = new Map()
      adjByMemberGw.set(a.member_id, m)
    }
    m.set(a.gameweek_id, (m.get(a.gameweek_id) ?? 0) + (a.delta ?? 0))
  }

  // Final weekly per (member, gw): base × (db ? 2 : 1) + adjustments
  const dbByGwId = new Map<string, boolean>()
  for (const g of gameweeks) dbByGwId.set(g.id, !!g.double_bubble)

  const weeklyForMemberGw = (memberId: string, gwId: string): number => {
    const base = baseByMemberGw.get(memberId)?.get(gwId) ?? 0
    const mult = dbByGwId.get(gwId) ? 2 : 1
    const adj = adjByMemberGw.get(memberId)?.get(gwId) ?? 0
    return base * mult + adj
  }

  const members = membersRaw

  // Fail-soft: empty before migration 029, which renders names as before.
  const favouriteBadges = await getFavouriteBadges(admin)

  const rowsRaw = members.map((m) => {
    const startingNow = m.starting_points ?? 0
    let cumulative = startingNow

    // Add not-yet-applied weeklies for gws ≤ target
    // Subtract applied weeklies for gws > target
    for (const gw of gameweeks) {
      if (gw.number <= target.number && !gw.points_applied) {
        cumulative += weeklyForMemberGw(m.id, gw.id)
      } else if (gw.number > target.number && gw.points_applied) {
        cumulative -= weeklyForMemberGw(m.id, gw.id)
      }
    }

    return {
      memberId: m.id,
      displayName: m.display_name,
      weeklyPoints: weeklyForMemberGw(m.id, target.id),
      totalPoints: cumulative,
      badge: favouriteBadges.get(m.id) ?? null,
    }
  })

  rowsRaw.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
    return a.displayName.localeCompare(b.displayName)
  })

  // Dense-tied rank: equal totals share the same #.
  const rows: StandingsRow[] = []
  let lastTotal: number | null = null
  let lastRank = 0
  rowsRaw.forEach((r, i) => {
    const rank = lastTotal !== null && r.totalPoints === lastTotal ? lastRank : i + 1
    rows.push({ ...r, rank })
    lastTotal = r.totalPoints
    lastRank = rank
  })

  return {
    gwNumber: target.number,
    gwId: target.id,
    doubleBubbleActive: !!target.double_bubble,
    status: target.status,
    rows,
  }
}
