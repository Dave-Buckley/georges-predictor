/**
 * READ-ONLY. Verifies the 2026/27 pre-season picker is ready:
 *  - pl_teams(2026) and championship_teams(2026) rosters (20 PL, no overlap,
 *    Leeds PL-only, promoted trio in PL not Champ, relegated trio in Champ)
 *  - upcoming-season detection (gw1_kickoff in the future)
 *  - no stale pre_season_picks / awards for 2026
 *
 * Usage: npx tsx scripts/diagnose-preseason.ts
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

const norm = (s: string) => s.toLowerCase().replace(/\s+fc$/, '').replace(/\s+afc$/, '').trim()

async function main() {
  const { data: seasons } = await sb.from('seasons').select('season, label, gw1_kickoff').order('season')
  console.log('=== seasons ===')
  console.table(seasons ?? [])
  const now = new Date()
  const upcoming = (seasons ?? []).find((s: any) => new Date(s.gw1_kickoff) > now)
  console.log('Upcoming season (gw1_kickoff in future):', upcoming ? (upcoming as any).season : 'NONE')

  const { data: pl } = await sb.from('pl_teams').select('name').eq('season', 2026).order('name')
  const { data: ch } = await sb.from('championship_teams').select('name').eq('season', 2026).order('name')
  const plNames = (pl ?? []).map((r: any) => r.name)
  const chNames = (ch ?? []).map((r: any) => r.name)

  console.log(`\n=== pl_teams(2026): ${plNames.length} ===`)
  console.log(plNames.join(', '))
  console.log(`\n=== championship_teams(2026): ${chNames.length} ===`)
  console.log(chNames.join(', '))

  // Overlap check (normalised, ignores FC/AFC suffix diff)
  const chSet = new Set(chNames.map(norm))
  const overlap = plNames.map(norm).filter((n) => chSet.has(n))
  console.log('\nOverlap PL∩Championship (should be empty):', overlap.length ? overlap.join(', ') : 'none ✓')

  // Specific expectations
  const has = (arr: string[], name: string) => arr.map(norm).includes(norm(name))
  console.log('\n=== spot checks ===')
  console.log('Leeds in PL:', has(plNames, 'Leeds United'), '| Leeds in Champ (want false):', has(chNames, 'Leeds United'))
  for (const promoted of ['Coventry City', 'Ipswich Town', 'Hull City']) {
    console.log(`${promoted}: PL=${has(plNames, promoted)} Champ(want false)=${has(chNames, promoted)}`)
  }
  for (const relegated of ['West Ham United', 'Burnley', 'Wolverhampton Wanderers']) {
    console.log(`${relegated}: Champ=${has(chNames, relegated)} PL(want false)=${has(plNames, relegated)}`)
  }
  console.log('PL count == 20:', plNames.length === 20)

  const { count: picks } = await sb.from('pre_season_picks').select('*', { count: 'exact', head: true }).eq('season', 2026)
  const { count: awards } = await sb.from('pre_season_awards').select('*', { count: 'exact', head: true }).eq('season', 2026)
  console.log('\npre_season_picks(2026):', picks, '| pre_season_awards(2026):', awards)
}

main().catch((e) => { console.error(e); process.exit(1) })
