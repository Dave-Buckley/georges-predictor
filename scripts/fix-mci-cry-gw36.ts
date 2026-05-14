/**
 * One-shot fix for the manual Man City vs Crystal Palace GW36 fixture
 * (synthetic external_id=9000036).
 *
 * Why this script exists:
 *   The fixture was inserted manually in 359c154 with a synthetic external_id
 *   outside the football-data.org range, so the sync engine never matches the
 *   real API row back onto it — the score stays null forever.
 *
 *   The real API row (external_id=538091, currently in GW31) shows the match
 *   FINISHED 3-0. This script mirrors that result onto the GW36 manual row,
 *   marks it FINISHED, and re-scores the 20 predictions tied to it.
 *
 *   GW36 is still open (closed_at IS NULL, points_applied=false), so re-scoring
 *   only touches prediction_scores — starting_points untouched until close.
 *
 *   The systemic fix lives in src/lib/fixtures/sync.ts (mirrorApiResultsToManualFixtures).
 *
 * Usage:
 *   npx tsx scripts/fix-mci-cry-gw36.ts           # dry run
 *   npx tsx scripts/fix-mci-cry-gw36.ts --apply   # write
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'node:fs'
import * as path from 'node:path'

function loadEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    const k = t.slice(0, i).trim()
    let v = t.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    if (!process.env[k]) process.env[k] = v
  }
}
loadEnvLocal()

const APPLY = process.argv.includes('--apply')
const SYNTH_EXTERNAL_ID = 9000036
const REAL_API_EXTERNAL_ID = 538091
const FINAL_HOME = 3
const FINAL_AWAY = 0

const sb = createClient(
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
  console.log(`=== Fix MCI vs CRY GW36 — ${APPLY ? 'APPLY' : 'DRY RUN'} ===\n`)

  // Resolve the manual fixture row in GW36
  const { data: manualRows, error: manualErr } = await sb
    .from('fixtures')
    .select(`
      id, external_id, status, home_score, away_score, manual_gameweek_override, result_source,
      gameweek:gameweeks!gameweek_id(id, number, closed_at, points_applied)
    `)
    .eq('external_id', SYNTH_EXTERNAL_ID)
  if (manualErr) throw new Error(`Manual row read: ${manualErr.message}`)
  const manual = manualRows?.[0] as unknown as
    | {
        id: string
        external_id: number
        status: string
        home_score: number | null
        away_score: number | null
        manual_gameweek_override: boolean | null
        result_source: string | null
        gameweek: { id: string; number: number; closed_at: string | null; points_applied: boolean }
      }
    | undefined
  if (!manual) throw new Error(`Manual fixture ${SYNTH_EXTERNAL_ID} not found`)

  console.log(`  Manual row id   : ${manual.id}`)
  console.log(`  Gameweek        : ${manual.gameweek.number}`)
  console.log(`  Stored score    : ${manual.home_score ?? '-'} - ${manual.away_score ?? '-'}`)
  console.log(`  Status          : ${manual.status}`)
  console.log(`  GW closed       : ${manual.gameweek.closed_at ? 'YES — ' + manual.gameweek.closed_at : 'no'}`)
  console.log(`  points_applied  : ${manual.gameweek.points_applied}`)

  if (manual.gameweek.closed_at !== null || manual.gameweek.points_applied) {
    throw new Error(
      `Refusing to recalc — GW${manual.gameweek.number} is closed/points_applied. ` +
        `Script is intentionally limited to open weeks.`,
    )
  }

  // Sanity-check the real API row still says 3-0 FINISHED
  const { data: realRows, error: realErr } = await sb
    .from('fixtures')
    .select('id, external_id, status, home_score, away_score, kickoff_time')
    .eq('external_id', REAL_API_EXTERNAL_ID)
  if (realErr) throw new Error(`Real-API row read: ${realErr.message}`)
  const real = realRows?.[0]
  if (!real) throw new Error(`Real API row ${REAL_API_EXTERNAL_ID} not found — has it been pulled by sync yet?`)

  console.log(`\n  Real API row id : ${real.id}`)
  console.log(`  Status          : ${real.status}`)
  console.log(`  Final score     : ${real.home_score}-${real.away_score}`)
  console.log(`  Kickoff (api)   : ${real.kickoff_time}`)

  if (real.status !== 'FINISHED' || real.home_score === null || real.away_score === null) {
    throw new Error(
      `Real API row is not FINISHED with a score yet (status=${real.status}, ${real.home_score}-${real.away_score}). Abort.`,
    )
  }

  if (real.home_score !== FINAL_HOME || real.away_score !== FINAL_AWAY) {
    console.warn(
      `[warn] Real API row score (${real.home_score}-${real.away_score}) differs from script constants (${FINAL_HOME}-${FINAL_AWAY}). ` +
        `Using the API value.`,
    )
  }

  const useHome = real.home_score
  const useAway = real.away_score

  // Pull predictions tied to the manual row so we can show the diff
  const { data: predictionsRaw, error: predErr } = await sb
    .from('predictions')
    .select('id, member_id, home_score, away_score')
    .eq('fixture_id', manual.id)
  if (predErr) throw new Error(`predictions read: ${predErr.message}`)
  const predictions = (predictionsRaw ?? []) as Array<{
    id: string
    member_id: string
    home_score: number
    away_score: number
  }>

  console.log(`\n  Predictions on manual row : ${predictions.length}`)

  let totalPoints = 0
  let exact = 0
  let resultOnly = 0
  let zero = 0
  for (const p of predictions) {
    const pts = pointsFor(p.home_score, p.away_score, useHome, useAway)
    totalPoints += pts
    if (pts === 30) exact++
    else if (pts === 10) resultOnly++
    else zero++
  }
  console.log(`  Projected awards: ${exact} exact (30pt), ${resultOnly} result-only (10pt), ${zero} zero`)
  console.log(`  Total weekly points to be awarded across all members: ${totalPoints}`)

  if (!APPLY) {
    console.log('\nDry run only. Re-run with --apply to write.')
    return
  }

  // 1. Update the manual row's status/score
  const { error: updateErr } = await sb
    .from('fixtures')
    .update({
      status: 'FINISHED',
      home_score: useHome,
      away_score: useAway,
      result_source: 'api',
    })
    .eq('id', manual.id)
  if (updateErr) throw new Error(`Fixture update failed: ${updateErr.message}`)
  console.log('\n[ok] Manual fixture row updated to FINISHED 3-0.')

  // 2. Insert prediction_scores rows for each prediction (idempotent via UNIQUE prediction_id).
  //    Mirrors what recalculateFixture would do — kept inline so the script doesn't
  //    depend on Next.js path aliases (`@/...`) which don't resolve via `npx tsx`.
  const scoreRows = predictions.map((p) => {
    const predResult = p.home_score > p.away_score ? 'H' : p.home_score < p.away_score ? 'A' : 'D'
    const actResult = useHome > useAway ? 'H' : useHome < useAway ? 'A' : 'D'
    const result_correct = predResult === actResult
    const score_correct = p.home_score === useHome && p.away_score === useAway
    const points_awarded = score_correct ? 30 : result_correct ? 10 : 0
    return {
      prediction_id: p.id,
      fixture_id: manual.id,
      member_id: p.member_id,
      predicted_home: p.home_score,
      predicted_away: p.away_score,
      actual_home: useHome,
      actual_away: useAway,
      result_correct,
      score_correct,
      points_awarded,
    }
  })

  const { error: scoreErr } = await sb
    .from('prediction_scores')
    .upsert(scoreRows, { onConflict: 'prediction_id' })
  if (scoreErr) throw new Error(`prediction_scores upsert failed: ${scoreErr.message}`)
  console.log(`[ok] prediction_scores upserted: ${scoreRows.length} rows`)

  // 3. Admin notification
  await sb.from('admin_notifications').insert({
    type: 'scoring_complete',
    title: `Man City 3-0 Crystal Palace — GW36 result applied`,
    message:
      `The rescheduled Man City vs Crystal Palace match (Wed 13 May, GW36) ended 3-0. The score was published to the football-data feed under its real fixture id but we had a manual placeholder row in GW36 — the sync was not mirroring the result onto the placeholder. ` +
      `Score has now been applied manually and the ${predictions.length} predictions have been scored against 3-0. ` +
      `The sync engine has also been updated so this kind of manual placeholder will now auto-pick-up the result from the API on future syncs.`,
  })
  console.log('[ok] Admin notification posted.')
}

main().catch((e) => { console.error('\nFix failed:', e instanceof Error ? e.message : e); process.exit(1) })
