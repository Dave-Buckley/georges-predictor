/**
 * One-shot fix for the WHU vs ARS GW36 score (1-1 → 0-1).
 *
 * Re-runs recalculateFixture for that single fixture so prediction_scores
 * are rebuilt against the correct 0-1 result. Bonus awards already confirmed
 * by George (awarded=true / false) are NOT touched — recalculateFixture
 * skips them by design.
 *
 * GW36 is open (closed_at IS NULL, points_applied=false) so members'
 * starting_points need no adjustment — they only roll up at close time.
 *
 * Usage:
 *   npx tsx scripts/fix-whu-ars-gw36.ts             # dry run
 *   npx tsx scripts/fix-whu-ars-gw36.ts --apply     # write
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'node:fs'
import * as path from 'node:path'

function loadEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const k = trimmed.slice(0, eq).trim()
    let v = trimmed.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    if (!process.env[k]) process.env[k] = v
  }
}
loadEnvLocal()

const APPLY = process.argv.includes('--apply')
const FIXTURE_EXTERNAL_ID = 538144 // WHU vs ARS, GW36

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

function pointsFor(predH: number, predA: number, actH: number, actA: number): number {
  const predResult = predH > predA ? 'H' : predH < predA ? 'A' : 'D'
  const actResult = actH > actA ? 'H' : actH < actA ? 'A' : 'D'
  if (predH === actH && predA === actA) return 30
  if (predResult === actResult) return 10
  return 0
}

async function main() {
  console.log(`=== Fix WHU vs ARS — ${APPLY ? 'APPLY' : 'DRY RUN'} ===\n`)

  // Resolve the fixture
  const { data: fxRows, error: fxErr } = await supabase
    .from('fixtures')
    .select(`
      id, external_id, status, home_score, away_score,
      gameweek:gameweeks!gameweek_id(id, number, closed_at, points_applied)
    `)
    .eq('external_id', FIXTURE_EXTERNAL_ID)
  if (fxErr) throw new Error(`Fixture read: ${fxErr.message}`)
  const fx = fxRows?.[0] as unknown as
    | {
        id: string
        external_id: number
        status: string
        home_score: number | null
        away_score: number | null
        gameweek: { id: string; number: number; closed_at: string | null; points_applied: boolean }
      }
    | undefined
  if (!fx) throw new Error(`Fixture ${FIXTURE_EXTERNAL_ID} not found`)

  console.log(`  Fixture     : ${fx.id}  GW${fx.gameweek.number}`)
  console.log(`  Stored score: ${fx.home_score}-${fx.away_score}`)
  console.log(`  Status      : ${fx.status}`)
  console.log(`  GW closed   : ${fx.gameweek.closed_at ? 'YES — ' + fx.gameweek.closed_at : 'no'}`)
  console.log(`  points_appl : ${fx.gameweek.points_applied}`)

  // Hard guard — refuse to operate on a closed gameweek (the user explicitly
  // said "do not enter previous weeks").
  if (fx.gameweek.closed_at !== null || fx.gameweek.points_applied) {
    throw new Error(
      `Refusing to recalc — GW${fx.gameweek.number} is closed/points_applied. ` +
      `This script is intentionally limited to open weeks.`,
    )
  }

  if (fx.home_score === null || fx.away_score === null) {
    throw new Error('Fixture has no score in the DB — abort.')
  }

  // Pull current prediction_scores for the fixture so we can show the diff
  const { data: psRows, error: psErr } = await supabase
    .from('prediction_scores')
    .select('id, prediction_id, member_id, predicted_home, predicted_away, actual_home, actual_away, points_awarded')
    .eq('fixture_id', fx.id)
  if (psErr) throw new Error(`prediction_scores read: ${psErr.message}`)

  console.log(`\n  Existing prediction_scores rows: ${(psRows ?? []).length}`)

  // Compute what each row should be
  type Row = {
    id: string
    prediction_id: string
    member_id: string
    predicted_home: number
    predicted_away: number
    actual_home: number
    actual_away: number
    points_awarded: number
  }
  const rows = (psRows ?? []) as Row[]

  let totalSwing = 0
  const updates: Array<{ id: string; new_actual_h: number; new_actual_a: number; new_points: number; new_result_correct: boolean; new_score_correct: boolean }> = []
  for (const r of rows) {
    const newPoints = pointsFor(r.predicted_home, r.predicted_away, fx.home_score, fx.away_score)
    const predResult = r.predicted_home > r.predicted_away ? 'H' : r.predicted_home < r.predicted_away ? 'A' : 'D'
    const actResult = fx.home_score > fx.away_score ? 'H' : fx.home_score < fx.away_score ? 'A' : 'D'
    const new_result_correct = predResult === actResult
    const new_score_correct = r.predicted_home === fx.home_score && r.predicted_away === fx.away_score
    const swing = newPoints - r.points_awarded
    totalSwing += swing
    if (
      r.actual_home === fx.home_score &&
      r.actual_away === fx.away_score &&
      r.points_awarded === newPoints
    ) continue
    updates.push({
      id: r.id,
      new_actual_h: fx.home_score,
      new_actual_a: fx.away_score,
      new_points: newPoints,
      new_result_correct,
      new_score_correct,
    })
  }

  console.log(`  Rows to update : ${updates.length}`)
  console.log(`  Net point swing: ${totalSwing >= 0 ? '+' : ''}${totalSwing} (across all members in this fixture)`)

  if (!APPLY) {
    console.log('\nDry run only. Re-run with --apply to write.')
    return
  }

  if (updates.length === 0) {
    console.log('\nNothing to update.')
    return
  }

  console.log('\nApplying updates...')
  let ok = 0
  let fail = 0
  for (const u of updates) {
    const { error } = await supabase
      .from('prediction_scores')
      .update({
        actual_home: u.new_actual_h,
        actual_away: u.new_actual_a,
        result_correct: u.new_result_correct,
        score_correct: u.new_score_correct,
        points_awarded: u.new_points,
      })
      .eq('id', u.id)
    if (error) { console.error(`  ✗ ${u.id}: ${error.message}`); fail++ }
    else ok++
  }
  console.log(`\nDone. Updated ${ok}${fail ? `  failed ${fail}` : ''}`)

  // Notify the admins so George knows the bonus award for Winston needs a re-look.
  await supabase.from('admin_notifications').insert({
    type: 'system',
    title: `WHU vs ARS GW36 score corrected to 0-1 — points re-scored`,
    message:
      `The football data feed had this fixture as 1-1 when it was first marked finished, then later updated to the correct 0-1. ` +
      `The 18 predictions for this match have been re-scored against 0-1. ` +
      `Net point swing across affected members was ${totalSwing >= 0 ? '+' : ''}${totalSwing} weekly points. ` +
      `Heads-up: Winston has a confirmed "Jose Park The Bus" bonus on this fixture currently set to 0 points. ` +
      `Now that the result is 0-1 (and his prediction was also 0-1), George may want to re-review whether that bonus should now score points.`,
  })
  console.log('Admin notification posted.')
}

main().catch((e) => { console.error('\nFix failed:', e instanceof Error ? e.message : e); process.exit(1) })
