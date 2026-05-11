/**
 * audit-scores.ts
 *
 * Two-layer audit of result data:
 *   Layer A — fixtures.home_score / away_score   vs   football-data.org API
 *             (catches scores that were stored before VAR/correction and
 *              never refreshed, or fixtures the API has since revised)
 *   Layer B — fixtures.home_score / away_score   vs   prediction_scores.actual_*
 *             (catches predictions that were calculated against an old score
 *              and were never recalculated when the fixture was corrected)
 *
 * Layer A requires FOOTBALL_DATA_API_KEY in .env.local. Without it, only
 * Layer B runs.
 *
 * Usage:
 *   npx tsx scripts/audit-scores.ts             # full audit, read-only
 *   npx tsx scripts/audit-scores.ts --gw 36     # restrict to one gameweek
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'node:fs'
import * as path from 'node:path'

function loadEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  const contents = fs.readFileSync(envPath, 'utf8')
  for (const line of contents.split('\n')) {
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const FD_API_KEY = process.env.FOOTBALL_DATA_API_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ─── CLI args ──────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const gwIdx = argv.indexOf('--gw')
const gwFilter = gwIdx >= 0 ? Number(argv[gwIdx + 1]) : null

// ─── Types ─────────────────────────────────────────────────────────────────
interface DbFixture {
  id: string
  external_id: number
  status: string
  home_score: number | null
  away_score: number | null
  result_source: string | null
  gameweek_number: number
  home_team: string
  away_team: string
}

interface ApiFixture {
  external_id: number
  status: string
  home_score: number | null
  away_score: number | null
  home_team: string
  away_team: string
}

interface PredScoreDrift {
  fixture_id: string
  label: string
  gw: number
  fixtures_home: number | null
  fixtures_away: number | null
  ps_home: number
  ps_away: number
  affected_predictions: number
}

interface ApiDrift {
  fixture_id: string
  external_id: number
  label: string
  gw: number
  db_home: number | null
  db_away: number | null
  api_home: number | null
  api_away: number | null
  result_source: string | null
}

// ─── Step 1: Load DB fixtures ──────────────────────────────────────────────
async function loadDbFixtures(): Promise<DbFixture[]> {
  let query = supabase
    .from('fixtures')
    .select(`
      id,
      external_id,
      status,
      home_score,
      away_score,
      result_source,
      gameweek:gameweeks!gameweek_id(number),
      home_team:teams!home_team_id(short_name),
      away_team:teams!away_team_id(short_name)
    `)
    .eq('status', 'FINISHED')

  const { data, error } = await query
  if (error) throw new Error(`Fixture read: ${error.message}`)

  const rows = (data ?? []).map((r: unknown) => {
    const row = r as {
      id: string
      external_id: number
      status: string
      home_score: number | null
      away_score: number | null
      result_source: string | null
      gameweek: { number: number } | null
      home_team: { short_name: string } | null
      away_team: { short_name: string } | null
    }
    return {
      id: row.id,
      external_id: row.external_id,
      status: row.status,
      home_score: row.home_score,
      away_score: row.away_score,
      result_source: row.result_source,
      gameweek_number: row.gameweek?.number ?? -1,
      home_team: row.home_team?.short_name ?? '?',
      away_team: row.away_team?.short_name ?? '?',
    }
  })

  return gwFilter !== null ? rows.filter((r) => r.gameweek_number === gwFilter) : rows
}

// ─── Step 2: Load API fixtures (optional) ──────────────────────────────────
async function loadApiFixtures(): Promise<Map<number, ApiFixture> | null> {
  if (!FD_API_KEY) return null
  const res = await fetch('https://api.football-data.org/v4/competitions/PL/matches', {
    headers: { 'X-Auth-Token': FD_API_KEY },
    cache: 'no-store',
  })
  if (!res.ok) {
    console.warn(`[warn] football-data.org returned ${res.status} ${res.statusText} — skipping Layer A`)
    return null
  }
  const json = (await res.json()) as {
    matches: Array<{
      id: number
      status: string
      score: { fullTime: { home: number | null; away: number | null } }
      homeTeam: { shortName: string }
      awayTeam: { shortName: string }
    }>
  }
  const map = new Map<number, ApiFixture>()
  for (const m of json.matches) {
    map.set(m.id, {
      external_id: m.id,
      status: m.status,
      home_score: m.score.fullTime.home,
      away_score: m.score.fullTime.away,
      home_team: m.homeTeam.shortName,
      away_team: m.awayTeam.shortName,
    })
  }
  return map
}

// ─── Step 3: Detect Layer A drift (DB vs API) ──────────────────────────────
function detectApiDrift(
  dbFixtures: DbFixture[],
  apiMap: Map<number, ApiFixture>,
): ApiDrift[] {
  const drift: ApiDrift[] = []
  for (const f of dbFixtures) {
    const api = apiMap.get(f.external_id)
    if (!api) continue
    if (api.status !== 'FINISHED') continue
    if (api.home_score === null || api.away_score === null) continue
    if (f.home_score === api.home_score && f.away_score === api.away_score) continue
    drift.push({
      fixture_id: f.id,
      external_id: f.external_id,
      label: `${f.home_team} vs ${f.away_team}`,
      gw: f.gameweek_number,
      db_home: f.home_score,
      db_away: f.away_score,
      api_home: api.home_score,
      api_away: api.away_score,
      result_source: f.result_source,
    })
  }
  return drift
}

// ─── Step 4: Detect Layer B drift (fixtures vs prediction_scores) ─────────
async function detectPredictionScoreDrift(dbFixtures: DbFixture[]): Promise<PredScoreDrift[]> {
  const fixtureIds = dbFixtures.filter((f) => f.home_score !== null && f.away_score !== null).map((f) => f.id)
  if (fixtureIds.length === 0) return []

  const drift: PredScoreDrift[] = []

  // Page in chunks to avoid query-size limits
  const CHUNK = 80
  for (let i = 0; i < fixtureIds.length; i += CHUNK) {
    const ids = fixtureIds.slice(i, i + CHUNK)
    const { data, error } = await supabase
      .from('prediction_scores')
      .select('fixture_id, actual_home, actual_away')
      .in('fixture_id', ids)
    if (error) throw new Error(`prediction_scores read: ${error.message}`)

    // Group: fixture_id -> {actual_home, actual_away} -> count
    const byFixture = new Map<string, Map<string, number>>()
    for (const row of (data ?? []) as Array<{
      fixture_id: string
      actual_home: number
      actual_away: number
    }>) {
      const key = `${row.actual_home}-${row.actual_away}`
      const inner = byFixture.get(row.fixture_id) ?? new Map<string, number>()
      inner.set(key, (inner.get(key) ?? 0) + 1)
      byFixture.set(row.fixture_id, inner)
    }

    for (const [fixtureId, scoreCounts] of byFixture) {
      const fixture = dbFixtures.find((f) => f.id === fixtureId)
      if (!fixture || fixture.home_score === null || fixture.away_score === null) continue
      const expectedKey = `${fixture.home_score}-${fixture.away_score}`
      for (const [key, count] of scoreCounts) {
        if (key === expectedKey) continue
        const [psHome, psAway] = key.split('-').map(Number)
        drift.push({
          fixture_id: fixtureId,
          label: `${fixture.home_team} vs ${fixture.away_team}`,
          gw: fixture.gameweek_number,
          fixtures_home: fixture.home_score,
          fixtures_away: fixture.away_score,
          ps_home: psHome,
          ps_away: psAway,
          affected_predictions: count,
        })
      }
    }
  }

  return drift
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Score Audit ===')
  if (gwFilter !== null) console.log(`Filter: GW${gwFilter} only`)

  const dbFixtures = await loadDbFixtures()
  console.log(`\nFINISHED fixtures in DB: ${dbFixtures.length}`)

  const apiMap = await loadApiFixtures()
  console.log(apiMap ? `API fixtures fetched: ${apiMap.size}` : 'API key not set — Layer A skipped')

  // ── Layer A ──
  if (apiMap) {
    const apiDrift = detectApiDrift(dbFixtures, apiMap)
    console.log(`\n── Layer A: DB fixtures vs football-data.org API ──`)
    if (apiDrift.length === 0) {
      console.log('  [ok]   All DB scores match the API.')
    } else {
      console.log(`  [drift] ${apiDrift.length} fixture(s) with stored score ≠ API:\n`)
      for (const d of apiDrift) {
        console.log(
          `    GW${String(d.gw).padStart(2)} ${d.label.padEnd(28)} ` +
          `DB ${d.db_home}-${d.db_away}   API ${d.api_home}-${d.api_away}   ` +
          `source=${d.result_source ?? 'null'}   external_id=${d.external_id}`,
        )
      }
    }
  }

  // ── Layer B ──
  const psDrift = await detectPredictionScoreDrift(dbFixtures)
  console.log(`\n── Layer B: fixtures vs prediction_scores.actual_* ──`)
  if (psDrift.length === 0) {
    console.log('  [ok]   All prediction_scores match their fixture\'s current score.')
  } else {
    console.log(`  [drift] ${psDrift.length} stale grouping(s):\n`)
    for (const d of psDrift) {
      console.log(
        `    GW${String(d.gw).padStart(2)} ${d.label.padEnd(28)} ` +
        `fixture ${d.fixtures_home}-${d.fixtures_away}   ` +
        `prediction_scores think ${d.ps_home}-${d.ps_away}   ` +
        `(${d.affected_predictions} prediction${d.affected_predictions === 1 ? '' : 's'})`,
      )
    }
  }

  // ── Summary ──
  console.log('\n── Summary ──')
  if (apiMap) {
    const apiDrift = detectApiDrift(dbFixtures, apiMap)
    const fixtureIdsToFix = new Set<string>([
      ...apiDrift.map((d) => d.fixture_id),
      ...psDrift.map((d) => d.fixture_id),
    ])
    console.log(`  Distinct fixtures needing repair: ${fixtureIdsToFix.size}`)
  } else {
    const fixtureIdsToFix = new Set<string>(psDrift.map((d) => d.fixture_id))
    console.log(`  Distinct fixtures with stale prediction_scores: ${fixtureIdsToFix.size}`)
    console.log(`  (Add FOOTBALL_DATA_API_KEY to .env.local to also audit DB scores against the API.)`)
  }
}

main().catch((err) => {
  console.error('Audit failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
