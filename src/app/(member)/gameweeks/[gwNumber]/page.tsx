import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { FixtureWithTeams, GameweekRow, GameweekStatus, PredictionScoreRow } from '@/lib/supabase/types'
import PredictionForm from '@/components/predictions/prediction-form'

// Force dynamic rendering — fixture data + predictions change frequently
export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ gwNumber: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { gwNumber } = await params
  const n = parseInt(gwNumber, 10)
  if (isNaN(n) || n < 1 || n > 38) return { title: "George's Predictor" }
  return { title: `Gameweek ${n} — George's Predictor` }
}

/**
 * Member gameweek page — shows all fixtures with inline prediction inputs.
 *
 * Server-fetches:
 *   1. Gameweek + fixtures (with joined teams)
 *   2. Authenticated member row (approval check)
 *   3. Existing predictions for this member x these fixtures
 *   4. Submission count via RPC (how many members have submitted)
 *
 * Renders PredictionForm (client component) which manages prediction state
 * and calls the submitPredictions server action on submit.
 */
export default async function GameweekPage({ params }: PageProps) {
  const { gwNumber } = await params
  const gwNum = parseInt(gwNumber, 10)

  // Validate parameter
  if (isNaN(gwNum) || gwNum < 1 || gwNum > 38) {
    notFound()
  }

  const supabase = await createServerSupabaseClient()

  // ── Auth check ──────────────────────────────────────────────────────────────
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-8 text-center">
        <p className="text-slate-400">Please log in to submit predictions.</p>
      </div>
    )
  }

  // ── Member lookup ───────────────────────────────────────────────────────────
  const { data: memberData, error: memberError } = await supabase
    .from('members')
    .select('id, approval_status')
    .eq('user_id', user.id)
    .single()

  if (memberError || !memberData) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-8 text-center">
        <p className="text-slate-400">Please log in to submit predictions.</p>
      </div>
    )
  }

  if (memberData.approval_status !== 'approved') {
    return (
      <div className="rounded-xl border border-amber-700/50 bg-amber-900/20 p-8 text-center">
        <p className="text-amber-300">Your account is awaiting approval from George.</p>
        <p className="text-slate-400 text-sm mt-2">You will be able to make predictions once approved.</p>
      </div>
    )
  }

  // ── Fetch gameweek ──────────────────────────────────────────────────────────
  const { data: gw, error: gwError } = await supabase
    .from('gameweeks')
    .select('*')
    .eq('number', gwNum)
    .single()

  if (gwError || !gw) {
    notFound()
  }

  const gameweek = gw as GameweekRow

  // ── Fetch fixtures with joined teams ────────────────────────────────────────
  const { data: fixturesData } = await supabase
    .from('fixtures')
    .select('*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*), gameweek:gameweeks!gameweek_id(*)')
    .eq('gameweek_id', gameweek.id)
    .order('kickoff_time')

  const fixtures = (fixturesData ?? []) as FixtureWithTeams[]

  // ── Fetch all gameweeks for navigation ──────────────────────────────────────
  const { data: allGameweeks } = await supabase
    .from('gameweeks')
    .select('number, status')
    .order('number')

  const navGameweeks = (allGameweeks ?? []).map((g) => ({
    number: g.number as number,
    status: g.status as GameweekStatus,
  }))

  const navList = navGameweeks.length > 0
    ? navGameweeks
    : [{ number: gwNum, status: gameweek.status }]

  const totalGw = navList.length > 0 ? Math.max(...navList.map((g) => g.number)) : 38

  // ── Fetch existing predictions for this member x these fixtures ─────────────
  const fixtureIds = fixtures.map((f) => f.id)

  let existingPredictions: Record<string, { home_score: number; away_score: number }> = {}

  if (fixtureIds.length > 0) {
    const { data: predictionsData } = await supabase
      .from('predictions')
      .select('fixture_id, home_score, away_score')
      .eq('member_id', memberData.id)
      .in('fixture_id', fixtureIds)

    if (predictionsData) {
      for (const p of predictionsData) {
        existingPredictions[p.fixture_id] = {
          home_score: p.home_score,
          away_score: p.away_score,
        }
      }
    }
  }

  // ── Fetch prediction_scores for this member x these fixtures ───────────────
  type ScoreBreakdownShape = Pick<
    PredictionScoreRow,
    | 'predicted_home'
    | 'predicted_away'
    | 'actual_home'
    | 'actual_away'
    | 'result_correct'
    | 'score_correct'
    | 'points_awarded'
  >

  let scoreBreakdowns: Record<string, ScoreBreakdownShape> = {}

  if (fixtureIds.length > 0) {
    const { data: scoresData } = await supabase
      .from('prediction_scores')
      .select('fixture_id, predicted_home, predicted_away, actual_home, actual_away, result_correct, score_correct, points_awarded')
      .eq('member_id', memberData.id)
      .in('fixture_id', fixtureIds)

    if (scoresData) {
      for (const s of scoresData) {
        scoreBreakdowns[s.fixture_id] = {
          predicted_home: s.predicted_home,
          predicted_away: s.predicted_away,
          actual_home: s.actual_home,
          actual_away: s.actual_away,
          result_correct: s.result_correct,
          score_correct: s.score_correct,
          points_awarded: s.points_awarded,
        }
      }
    }
  }

  // ── Compute gameweek totals server-side ─────────────────────────────────────
  const totalPoints = Object.values(scoreBreakdowns).reduce((sum, s) => sum + s.points_awarded, 0)
  const scoredFixtureCount = Object.keys(scoreBreakdowns).length

  // ── Fetch submission count via RPC ──────────────────────────────────────────
  let submittedCount = 0
  let totalMembers = 0

  const { data: countData } = await supabase.rpc('get_gameweek_submission_count', {
    gw_id: gameweek.id,
  })

  if (countData && countData.length > 0) {
    submittedCount = Number(countData[0].submitted_count ?? 0)
    totalMembers = Number(countData[0].total_members ?? 0)
  }

  // ── Fetch active bonus for this gameweek ────────────────────────────────────
  const { data: bonusScheduleData } = await supabase
    .from('bonus_schedule')
    .select('*, bonus_type:bonus_types!bonus_type_id(*)')
    .eq('gameweek_id', gameweek.id)
    .eq('confirmed', true)
    .single()

  const activeBonusType = bonusScheduleData
    ? {
        id: bonusScheduleData.bonus_type.id as string,
        name: bonusScheduleData.bonus_type.name as string,
        description: bonusScheduleData.bonus_type.description as string,
      }
    : null

  // ── Fetch member's existing bonus pick for this gameweek ────────────────────
  let existingBonusPick: string | null = null

  if (memberData?.id) {
    const { data: bonusAwardData } = await supabase
      .from('bonus_awards')
      .select('fixture_id, awarded, points_awarded')
      .eq('gameweek_id', gameweek.id)
      .eq('member_id', memberData.id)
      .single()

    if (bonusAwardData) {
      existingBonusPick = bonusAwardData.fixture_id as string | null
    }
  }

  return (
    <PredictionForm
      fixtures={fixtures}
      gameweek={gameweek}
      existingPredictions={existingPredictions}
      submissionCount={{ submitted: submittedCount, total: totalMembers }}
      navGameweeks={navList}
      currentGw={gwNum}
      totalGw={totalGw}
      scoreBreakdowns={scoreBreakdowns}
      totalPoints={totalPoints}
      scoredFixtureCount={scoredFixtureCount}
      activeBonusType={activeBonusType}
      existingBonusPick={existingBonusPick}
    />
  )
}
