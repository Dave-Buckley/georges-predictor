/**
 * verify-gameweek-close.ts — READ-ONLY preflight for a gameweek close.
 *
 * Closing a gameweek rolls its weekly points into members.starting_points
 * permanently. If the read behind that roll-up is short by even one row, the
 * banked total is wrong and nothing downstream ever notices.
 *
 * That is not hypothetical: in September 2026 an unfiltered read of
 * prediction_scores hit PostgREST's 1000-row response cap, and 28 members
 * showed zero on the standings table while their scores were perfectly
 * correct. See src/lib/supabase/fetch-all.ts for the full write-up.
 *
 * This script recomputes each gameweek's weekly points two independent ways
 * and only passes when they agree:
 *
 *   A. the scoped + paged read the app now uses (fetchAllRowsIn)
 *   B. a full-table sweep, paged locally and filtered in JS
 *
 * It also re-derives every stored score from the raw fixture result, so a
 * corrupted prediction_scores row is caught rather than trusted.
 *
 * The reported total is the prediction component only — bonuses, adjustments
 * and Double Bubble are applied by apply-points on top of it.
 *
 * Nothing is written. Run it before closing a gameweek.
 *
 *   npx tsx scripts/verify-gameweek-close.ts
 *   npx tsx scripts/verify-gameweek-close.ts --gw 3
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import * as fs from 'node:fs'
import * as path from 'node:path'

import { fetchAllRows, fetchAllRowsIn } from '../src/lib/supabase/fetch-all'

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
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    if (!process.env[k]) process.env[k] = v
  }
}
loadEnvLocal()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const sb: SupabaseClient = createClient(url, key, { auth: { persistSession: false } })

const argv = process.argv.slice(2)
const gwIdx = argv.indexOf('--gw')
const gwFilter = gwIdx >= 0 ? Number(argv[gwIdx + 1]) : null

interface ScoreRow {
  member_id: string
  fixture_id: string
  points_awarded: number | null
}

interface FixtureRow {
  id: string
  status: string
  home_score: number | null
  away_score: number | null
}

function outcome(home: number, away: number): 'H' | 'D' | 'A' {
  if (home > away) return 'H'
  if (home < away) return 'A'
  return 'D'
}

/** Method A — the scoped, paged read the app uses in production. */
async function weeklyScoped(fixtureIds: string[]): Promise<{
  weekly: Map<string, number>
  scoreRows: number
}> {
  const scores = await fetchAllRowsIn<ScoreRow>(fixtureIds, (ids) =>
    sb
      .from('prediction_scores')
      .select('member_id, fixture_id, points_awarded')
      .in('fixture_id', ids),
  )

  const weekly = new Map<string, number>()
  for (const s of scores) {
    weekly.set(s.member_id, (weekly.get(s.member_id) ?? 0) + (s.points_awarded ?? 0))
  }
  return { weekly, scoreRows: scores.length }
}

/**
 * Method B — sweep the whole table locally, then filter in JS. Deliberately
 * shares no code with method A so a bug in the helper cannot hide itself.
 */
async function weeklySweep(fixtureIds: string[]): Promise<{
  weekly: Map<string, number>
  tableRows: number
}> {
  const all: ScoreRow[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from('prediction_scores')
      .select('member_id, fixture_id, points_awarded')
      .order('id', { ascending: true })
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    all.push(...((data ?? []) as ScoreRow[]))
    if (!data || data.length < 1000) break
  }

  const wanted = new Set(fixtureIds)
  const weekly = new Map<string, number>()
  for (const s of all) {
    if (!wanted.has(s.fixture_id)) continue
    weekly.set(s.member_id, (weekly.get(s.member_id) ?? 0) + (s.points_awarded ?? 0))
  }
  return { weekly, tableRows: all.length }
}

async function main(): Promise<void> {
  const gameweeks = await fetchAllRows<{
    id: string
    number: number
    points_applied: boolean
    double_bubble: boolean
  }>(() => {
    const q = sb.from('gameweeks').select('id, number, points_applied, double_bubble')
    return gwFilter !== null ? q.eq('number', gwFilter) : q
  })

  const members = await fetchAllRows<{ id: string; display_name: string }>(() =>
    sb.from('members').select('id, display_name').eq('approval_status', 'approved'),
  )
  const nameOf = new Map(members.map((m) => [m.id, m.display_name]))

  console.log('Verifying gameweek roll-ups (read-only)\n')

  let problems = 0

  for (const gw of gameweeks.sort((a, b) => a.number - b.number)) {
    const fixtures = await fetchAllRows<FixtureRow>(() =>
      sb.from('fixtures').select('id, status, home_score, away_score').eq('gameweek_id', gw.id),
    )
    const fixtureIds = fixtures.map((f) => f.id)
    if (fixtureIds.length === 0) continue

    const [scoped, sweep] = await Promise.all([
      weeklyScoped(fixtureIds),
      weeklySweep(fixtureIds),
    ])

    // Any member the scoped read sees fewer points for than a brute-force
    // sweep is exactly the silent-truncation signature.
    const drift: string[] = []
    for (const m of members) {
      const a = scoped.weekly.get(m.id) ?? 0
      const b = sweep.weekly.get(m.id) ?? 0
      if (a !== b) drift.push(`${m.display_name}: scoped=${a} sweep=${b}`)
    }

    // Re-derive every stored score straight from the fixture result.
    const detail = await fetchAllRowsIn<{
      fixture_id: string
      member_id: string
      predicted_home: number
      predicted_away: number
      points_awarded: number | null
    }>(fixtureIds, (ids) =>
      sb
        .from('prediction_scores')
        .select('fixture_id, member_id, predicted_home, predicted_away, points_awarded')
        .in('fixture_id', ids),
    )

    const fixtureById = new Map(fixtures.map((f) => [f.id, f]))
    let miscalculated = 0
    for (const s of detail) {
      const f = fixtureById.get(s.fixture_id)
      if (!f || f.home_score === null || f.away_score === null) continue
      const exact = s.predicted_home === f.home_score && s.predicted_away === f.away_score
      const rightResult =
        outcome(s.predicted_home, s.predicted_away) === outcome(f.home_score, f.away_score)
      const expected = exact ? 30 : rightResult ? 10 : 0
      if ((s.points_awarded ?? 0) !== expected) {
        miscalculated++
        if (miscalculated <= 5) {
          console.log(
            `    [bad] ${nameOf.get(s.member_id) ?? s.member_id}: ` +
              `predicted ${s.predicted_home}-${s.predicted_away}, ` +
              `actual ${f.home_score}-${f.away_score}, ` +
              `stored ${s.points_awarded}, expected ${expected}`,
          )
        }
      }
    }

    const played = fixtures.filter((f) => f.status === 'FINISHED').length
    const total = [...scoped.weekly.values()].reduce((a, b) => a + b, 0)
    const ok = drift.length === 0 && miscalculated === 0
    if (!ok) problems++

    console.log(
      `GW${String(gw.number).padStart(2)}  ` +
        `${played}/${fixtures.length} played  ` +
        `${String(scoped.scoreRows).padStart(4)} score rows  ` +
        `${String(total).padStart(5)} pred pts  ` +
        `applied=${gw.points_applied ? 'yes' : 'no '}  ` +
        `${ok ? 'OK' : `PROBLEM (${drift.length} drift, ${miscalculated} miscalculated)`}`,
    )
    for (const d of drift.slice(0, 10)) console.log(`    [drift] ${d}`)
  }

  console.log(
    problems === 0
      ? '\nEvery gameweek agrees across both read paths, and every stored score ' +
          're-derives from its fixture result.'
      : `\n${problems} gameweek(s) need attention before closing.`,
  )
  process.exit(problems === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('Verification failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
