/**
 * A member's predictions for one gameweek, for display on /members/[slug].
 *
 * ─── The reveal rule, and why it is enforced HERE ───────────────────────────
 * A prediction becomes public the moment its fixture kicks off. That is safe
 * because it is also the moment it becomes unchangeable: the RLS policies
 * `predictions_insert_before_kickoff` and `predictions_update_before_kickoff`
 * (migration 003) both require `f.kickoff_time > now()`, so nobody can see a
 * rival's pick and then alter their own for that fixture.
 *
 * The matching read policy `predictions_select_member` already encodes exactly
 * this. We cannot lean on it, though: /members/[slug] runs on the ADMIN client,
 * which bypasses RLS entirely. So the same rule is re-implemented here in
 * application code. If you change one, change the other.
 *
 * The one exception mirrors the policy too — a member always sees their own
 * predictions, kicked off or not. Pass `includeUnplayed: true` only when the
 * viewer IS the member being viewed.
 *
 * Once revealed, a prediction stays revealed. There is no "during the match
 * only" window: kicked-off fixtures from any past gameweek remain visible, so
 * the gameweek navigation can page back through the whole season.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export interface MemberPredictionRow {
  fixtureId: string
  kickoffTime: string
  homeTeam: string
  awayTeam: string
  homeCrest: string | null
  awayCrest: string | null
  /** Null when the member submitted no prediction for this fixture. */
  predictedHome: number | null
  predictedAway: number | null
  /** Null until the result is in. */
  actualHome: number | null
  actualAway: number | null
  /** Null until scored. */
  pointsAwarded: number | null
  exact: boolean
  fixtureStatus: string
}

export interface MemberGameweekPredictions {
  gwNumber: number
  rows: MemberPredictionRow[]
  /** Fixtures in this gameweek not yet kicked off, so deliberately withheld. */
  hiddenCount: number
  /** Sum of pointsAwarded across revealed, scored fixtures. */
  totalPoints: number
}

/**
 * Gameweek numbers that have at least one kicked-off fixture — i.e. the weeks
 * there is something to show. Drives the navigation so it never offers a week
 * that would render empty.
 */
export async function getRevealedGameweekNumbers(
  admin: SupabaseClient,
  nowIso: string = new Date().toISOString(),
): Promise<number[]> {
  try {
    const { data: fixtures, error } = await admin
      .from('fixtures')
      .select('gameweek_id, kickoff_time')
      .lte('kickoff_time', nowIso)

    if (error || !Array.isArray(fixtures)) return []

    const gwIds = new Set(
      (fixtures as Array<{ gameweek_id: string }>).map((f) => f.gameweek_id),
    )
    if (gwIds.size === 0) return []

    const { data: gws, error: gwErr } = await admin
      .from('gameweeks')
      .select('id, number')
      .order('number')

    if (gwErr || !Array.isArray(gws)) return []

    return (gws as Array<{ id: string; number: number }>)
      .filter((g) => gwIds.has(g.id))
      .map((g) => g.number)
  } catch {
    return []
  }
}

export async function getMemberPredictionsForGameweek(
  admin: SupabaseClient,
  memberId: string,
  gwNumber: number,
  options: { includeUnplayed?: boolean; nowIso?: string } = {},
): Promise<MemberGameweekPredictions | null> {
  const { includeUnplayed = false, nowIso = new Date().toISOString() } = options

  const { data: gwRow } = await admin
    .from('gameweeks')
    .select('id, number')
    .eq('number', gwNumber)
    .maybeSingle()

  const gw = gwRow as { id: string; number: number } | null
  if (!gw) return null

  const { data: fixturesRaw } = await admin
    .from('fixtures')
    .select(
      'id, kickoff_time, status, home_score, away_score, ' +
        'home_team:teams!fixtures_home_team_id_fkey(name, short_name, crest_url), ' +
        'away_team:teams!fixtures_away_team_id_fkey(name, short_name, crest_url)',
    )
    .eq('gameweek_id', gw.id)
    .order('kickoff_time')

  interface TeamSide {
    name: string
    short_name: string | null
    crest_url: string | null
  }
  type FixtureRaw = {
    id: string
    kickoff_time: string
    status: string
    home_score: number | null
    away_score: number | null
    home_team: TeamSide | TeamSide[] | null
    away_team: TeamSide | TeamSide[] | null
  }

  const allFixtures = (fixturesRaw ?? []) as unknown as FixtureRaw[]

  // THE GATE. Everything downstream only ever sees this subset.
  const visible = includeUnplayed
    ? allFixtures
    : allFixtures.filter((f) => f.kickoff_time <= nowIso)

  const hiddenCount = allFixtures.length - visible.length

  if (visible.length === 0) {
    return { gwNumber: gw.number, rows: [], hiddenCount, totalPoints: 0 }
  }

  const visibleIds = visible.map((f) => f.id)

  const { data: predsRaw } = await admin
    .from('predictions')
    .select('fixture_id, home_score, away_score')
    .eq('member_id', memberId)
    .in('fixture_id', visibleIds)

  const predByFixture = new Map(
    ((predsRaw ?? []) as Array<{
      fixture_id: string
      home_score: number
      away_score: number
    }>).map((p) => [p.fixture_id, p]),
  )

  const { data: scoresRaw } = await admin
    .from('prediction_scores')
    .select('fixture_id, points_awarded, score_correct')
    .eq('member_id', memberId)
    .in('fixture_id', visibleIds)

  const scoreByFixture = new Map(
    ((scoresRaw ?? []) as Array<{
      fixture_id: string
      points_awarded: number | null
      score_correct: boolean | null
    }>).map((s) => [s.fixture_id, s]),
  )

  const side = (t: TeamSide | TeamSide[] | null): TeamSide | null =>
    Array.isArray(t) ? (t[0] ?? null) : t

  const rows: MemberPredictionRow[] = visible.map((f) => {
    const home = side(f.home_team)
    const away = side(f.away_team)
    const pred = predByFixture.get(f.id) ?? null
    const score = scoreByFixture.get(f.id) ?? null

    return {
      fixtureId: f.id,
      kickoffTime: f.kickoff_time,
      homeTeam: home?.short_name ?? home?.name ?? '?',
      awayTeam: away?.short_name ?? away?.name ?? '?',
      homeCrest: home?.crest_url ?? null,
      awayCrest: away?.crest_url ?? null,
      predictedHome: pred?.home_score ?? null,
      predictedAway: pred?.away_score ?? null,
      actualHome: f.home_score,
      actualAway: f.away_score,
      pointsAwarded: score?.points_awarded ?? null,
      exact: score?.score_correct === true,
      fixtureStatus: f.status,
    }
  })

  const totalPoints = rows.reduce((sum, r) => sum + (r.pointsAwarded ?? 0), 0)

  return { gwNumber: gw.number, rows, hiddenCount, totalPoints }
}
