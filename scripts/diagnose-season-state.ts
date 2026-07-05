/**
 * READ-ONLY diagnostic. Reports the live DB state relevant to the 2026/27
 * season changeover: seasons, gameweeks (season + status), fixture spread by
 * season, sample GW1 fixtures, LOS competitions, and the Leeds dropdown bug.
 *
 * Usage: npx tsx scripts/diagnose-season-state.ts
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const sb = createClient(url, key, { auth: { persistSession: false } })

async function main() {
  console.log('=== SEASONS ===')
  const { data: seasons } = await sb
    .from('seasons')
    .select('season, label, gw1_kickoff, ended_at')
    .order('season')
  console.table(seasons ?? [])

  console.log('\n=== GAMEWEEKS (number, season, status) ===')
  const { data: gws } = await sb
    .from('gameweeks')
    .select('number, season, status')
    .order('number')
  console.table(gws ?? [])

  console.log('\n=== FIXTURES: count by gameweek season ===')
  // pull minimal fixture rows joined to gameweek season
  const { data: fx } = await sb
    .from('fixtures')
    .select('id, external_id, kickoff_time, status, gameweek:gameweeks!gameweek_id(number, season)')
  const rows = (fx ?? []) as unknown as Array<{
    id: string
    external_id: number
    kickoff_time: string
    status: string
    gameweek: { number: number; season: number } | null
  }>
  const bySeason = new Map<number, number>()
  const negExt = rows.filter((r) => r.external_id < 0).length
  for (const r of rows) {
    const s = r.gameweek?.season ?? -1
    bySeason.set(s, (bySeason.get(s) ?? 0) + 1)
  }
  console.log('Total fixtures:', rows.length, '| manual (negative external_id):', negExt)
  console.table(
    [...bySeason.entries()].map(([season, count]) => ({ season, count })),
  )

  console.log('\n=== Earliest 8 fixtures by kickoff (what members see as "next") ===')
  const sorted = [...rows].sort(
    (a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime(),
  )
  console.table(
    sorted.slice(0, 8).map((r) => ({
      gw: r.gameweek?.number,
      season: r.gameweek?.season,
      kickoff: r.kickoff_time,
      status: r.status,
      ext: r.external_id,
    })),
  )

  console.log('\n=== Latest 4 fixtures by kickoff ===')
  console.table(
    sorted.slice(-4).map((r) => ({
      gw: r.gameweek?.number,
      season: r.gameweek?.season,
      kickoff: r.kickoff_time,
      status: r.status,
      ext: r.external_id,
    })),
  )

  console.log('\n=== Any fixture kicking off on 2026-08-21 (Arsenal v Coventry expected) ===')
  const aug21 = rows.filter((r) => r.kickoff_time.startsWith('2026-08-21'))
  console.log('count:', aug21.length)

  console.log('\n=== TEAMS count ===')
  const { count: teamCount } = await sb
    .from('teams')
    .select('*', { count: 'exact', head: true })
  console.log('teams rows:', teamCount)

  console.log('\n=== LOS competitions ===')
  const { data: comps } = await sb
    .from('los_competitions')
    .select('id, season, competition_num, status, starts_at_gw, ended_at_gw, winner_id')
    .order('season')
  console.table(comps ?? [])

  console.log('\n=== Leeds in championship_teams (bug check) ===')
  const { data: leedsCh } = await sb
    .from('championship_teams')
    .select('season, name')
    .ilike('name', '%leeds%')
  console.table(leedsCh ?? [])

  console.log('\n=== Leeds in pl_teams ===')
  const { data: leedsPl } = await sb
    .from('pl_teams')
    .select('season, name')
    .ilike('name', '%leeds%')
  console.table(leedsPl ?? [])

  console.log('\n=== sync_log: last 5 attempts ===')
  const { data: syncs } = await sb
    .from('sync_log')
    .select('synced_at, success, fixtures_updated, error_message')
    .order('synced_at', { ascending: false })
    .limit(5)
  console.table(syncs ?? [])
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
