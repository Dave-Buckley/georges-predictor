/**
 * One-off: enter Stu's GW4 picks on his behalf.
 *
 * Stu couldn't log in on 12 Sep (the login page showed "No account found" even
 * though his account exists) so he sent his picks to George on WhatsApp before
 * the 15:00 kickoffs. This writes exactly those picks + his London Derby bonus
 * choice, and scores the fixtures that have already finished so his points show
 * straight away. Fixtures still to play are scored by the normal sync.
 *
 * Insert-only: aborts if Stu already has any GW4 prediction or bonus row, so it
 * can never overwrite anything he entered himself.
 *
 * Usage: npx tsx scripts/add-stu-gw4-picks.ts
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { calculatePoints } from '../src/lib/scoring/calculate'

function loadEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const k = t.slice(0, eq).trim()
    let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!process.env[k]) process.env[k] = v
  }
}
loadEnvLocal()

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

const STU_MEMBER_ID = 'b37ae768-cddb-4cf2-bb49-bf9b4e9e6608'
const GW4_ID = '7e6e5891-9621-401d-863b-224201b8f7ac'
const BONUS_HOME_TEAM = 'Manchester United FC'

// Home team → [home, away], exactly as sent to George.
const PICKS: Record<string, [number, number]> = {
  'Crystal Palace FC': [2, 0],
  'Liverpool FC': [3, 0],
  'Aston Villa FC': [1, 1],
  'AFC Bournemouth': [0, 2],
  'Chelsea FC': [4, 0],
  'Tottenham Hotspur FC': [2, 0],
  'Sunderland AFC': [0, 2],
  'Coventry City FC': [0, 2],
  'Manchester United FC': [1, 2],
  'Leeds United FC': [2, 2],
}

async function main() {
  const { data: fixtures, error: fxErr } = await sb
    .from('fixtures')
    .select('id, home_team_id, away_team_id, home_score, away_score, status')
    .eq('gameweek_id', GW4_ID)
  if (fxErr) throw fxErr
  const { data: teams, error: tErr } = await sb.from('teams').select('id, name')
  if (tErr) throw tErr
  const teamName = new Map((teams ?? []).map((t) => [t.id as string, t.name as string]))

  const fixtureByHome = new Map(
    (fixtures ?? []).map((f) => [teamName.get(f.home_team_id as string) ?? '', f]),
  )
  for (const home of Object.keys(PICKS)) {
    if (!fixtureByHome.has(home)) throw new Error(`No GW4 fixture with home team ${home}`)
  }
  if ((fixtures ?? []).length !== Object.keys(PICKS).length) {
    throw new Error(`GW4 has ${fixtures?.length} fixtures but ${Object.keys(PICKS).length} picks`)
  }

  // Guard: never overwrite anything Stu entered himself.
  const { data: existingPreds } = await sb
    .from('predictions')
    .select('id')
    .eq('member_id', STU_MEMBER_ID)
    .in('fixture_id', (fixtures ?? []).map((f) => f.id))
  const { data: existingBonus } = await sb
    .from('bonus_awards')
    .select('id')
    .eq('member_id', STU_MEMBER_ID)
    .eq('gameweek_id', GW4_ID)
  if ((existingPreds ?? []).length > 0 || (existingBonus ?? []).length > 0) {
    throw new Error('Stu already has GW4 predictions or a bonus pick — aborting, nothing written.')
  }

  // 1. Predictions
  const rows = Object.entries(PICKS).map(([home, [h, a]]) => ({
    member_id: STU_MEMBER_ID,
    fixture_id: fixtureByHome.get(home)!.id as string,
    home_score: h,
    away_score: a,
  }))
  const { data: inserted, error: insErr } = await sb
    .from('predictions')
    .insert(rows)
    .select('id, fixture_id, home_score, away_score')
  if (insErr) throw insErr
  console.log(`Inserted ${inserted?.length} predictions`)

  // 2. Bonus pick
  const { data: schedule, error: bsErr } = await sb
    .from('bonus_schedule')
    .select('bonus_type_id')
    .eq('gameweek_id', GW4_ID)
    .eq('confirmed', true)
    .single()
  if (bsErr) throw bsErr
  const { error: bonusErr } = await sb.from('bonus_awards').insert({
    gameweek_id: GW4_ID,
    member_id: STU_MEMBER_ID,
    bonus_type_id: schedule.bonus_type_id,
    fixture_id: fixtureByHome.get(BONUS_HOME_TEAM)!.id,
    awarded: null,
    points_awarded: 0,
  })
  if (bonusErr) throw bonusErr
  console.log(`Inserted bonus pick on ${BONUS_HOME_TEAM} fixture`)

  // 3. Score fixtures that have already finished (only Stu's new rows).
  const fixtureById = new Map((fixtures ?? []).map((f) => [f.id as string, f]))
  const scoreRows = (inserted ?? []).flatMap((p) => {
    const f = fixtureById.get(p.fixture_id as string)!
    if (f.status !== 'FINISHED' || f.home_score == null || f.away_score == null) return []
    const r = calculatePoints(
      { home: p.home_score as number, away: p.away_score as number },
      { home: f.home_score as number, away: f.away_score as number },
    )
    return [{
      prediction_id: p.id,
      fixture_id: f.id,
      member_id: STU_MEMBER_ID,
      predicted_home: r.predicted_home,
      predicted_away: r.predicted_away,
      actual_home: r.actual_home,
      actual_away: r.actual_away,
      result_correct: r.result_correct,
      score_correct: r.score_correct,
      points_awarded: r.points_awarded,
    }]
  })
  if (scoreRows.length > 0) {
    const { error: scoreErr } = await sb
      .from('prediction_scores')
      .upsert(scoreRows, { onConflict: 'prediction_id' })
    if (scoreErr) throw scoreErr
  }
  console.log(`Scored ${scoreRows.length} finished fixtures`)

  // 4. Read back
  const { data: check } = await sb
    .from('predictions')
    .select('fixture_id, home_score, away_score, prediction_scores(points_awarded)')
    .eq('member_id', STU_MEMBER_ID)
    .in('fixture_id', (fixtures ?? []).map((f) => f.id))
  console.log('\n=== Stu GW4 (read back) ===')
  for (const [home] of Object.entries(PICKS)) {
    const f = fixtureByHome.get(home)!
    const p = (check ?? []).find((c) => c.fixture_id === f.id)
    // prediction_id is UNIQUE, so PostgREST embeds a single object, not an array.
    const embedded = p?.prediction_scores as unknown as
      | { points_awarded: number }
      | { points_awarded: number }[]
      | null
    const pts = Array.isArray(embedded) ? embedded[0]?.points_awarded : embedded?.points_awarded
    const actual = f.status === 'FINISHED' ? `(actual ${f.home_score}-${f.away_score})` : '(not played yet)'
    console.log(`${home} ${p?.home_score}-${p?.away_score} ${teamName.get(f.away_team_id as string)} ${actual}${pts != null ? ` → ${pts} pts` : ''}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
