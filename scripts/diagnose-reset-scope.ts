/**
 * READ-ONLY. Confirms the exact scope of a 2026/27 season reset:
 *  - old vs new fixture split by kickoff boundary
 *  - members.starting_points (is last season's table still live on /standings?)
 *  - counts of dependent rows that a reset would clear
 *  - whether any los_picks / bonus_awards reference OLD fixtures (delete blockers)
 *
 * Usage: npx tsx scripts/diagnose-reset-scope.ts
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

// Old 2025/26 fixtures kick off Aug 2025 – May 2026; new 2026/27 kick off Aug 2026+.
// Clean gap in Jun/Jul 2026 → boundary of 2026-06-01 separates them unambiguously.
const BOUNDARY = '2026-06-01T00:00:00Z'

async function count(table: string, build?: (q: any) => any): Promise<number> {
  let q = sb.from(table).select('*', { count: 'exact', head: true })
  if (build) q = build(q)
  const { count: c, error } = await q
  if (error) { console.log(`  (${table}: ERROR ${error.message})`); return -1 }
  return c ?? 0
}

async function main() {
  console.log('BOUNDARY (old < this <= new):', BOUNDARY)

  const oldFx = await count('fixtures', (q) => q.lt('kickoff_time', BOUNDARY))
  const newFx = await count('fixtures', (q) => q.gte('kickoff_time', BOUNDARY))
  console.log('\nFixtures — old:', oldFx, '| new:', newFx, '| total:', oldFx + newFx)

  // Any fixtures between Jun 1 and Aug 1 2026 (would indicate boundary overlap)?
  const gap = await count('fixtures', (q) =>
    q.gte('kickoff_time', BOUNDARY).lt('kickoff_time', '2026-08-01T00:00:00Z'))
  console.log('Fixtures in Jun–Jul 2026 gap (should be 0):', gap)

  console.log('\n=== members.starting_points (drives public /standings) ===')
  const { data: members } = await sb
    .from('members')
    .select('display_name, starting_points, approval_status, user_id, exclude_from_standings')
    .order('starting_points', { ascending: false })
  const approved = (members ?? []).filter(
    (m: any) => m.approval_status === 'approved' && m.user_id,
  )
  const nonZero = (members ?? []).filter((m: any) => (m.starting_points ?? 0) !== 0)
  console.log('total members:', (members ?? []).length, '| approved+claimed:', approved.length)
  console.log('members with non-zero starting_points:', nonZero.length,
    '(if >0, last season table still showing on /standings)')
  console.table((members ?? []).slice(0, 12).map((m: any) => ({
    name: m.display_name,
    pts: m.starting_points,
    status: m.approval_status,
    claimed: !!m.user_id,
    excluded: m.exclude_from_standings,
  })))

  console.log('\n=== Dependent-row counts a reset would clear ===')
  console.log('predictions (CASCADE w/ fixtures):', await count('predictions'))
  console.log('prediction_scores (CASCADE):', await count('prediction_scores'))
  console.log('result_overrides (CASCADE):', await count('result_overrides'))
  console.log('bonus_awards (must delete first — NO ACTION on fixture_id):', await count('bonus_awards'))
  console.log('bonus_schedule (gw-scoped, reused rows):', await count('bonus_schedule'))
  console.log('point_adjustments (gw-scoped, reused rows):', await count('point_adjustments'))
  console.log('prediction_locks (gw-scoped, reused rows):', await count('prediction_locks'))
  console.log('prize_awards:', await count('prize_awards'))
  console.log('los_picks (should be 0 — LOS never started):', await count('los_picks'))
  console.log('h2h_steals:', await count('h2h_steals'))

  console.log('\n=== Delete blockers: do any picks/awards point at OLD fixtures? ===')
  // Gather old fixture ids
  const { data: oldRows } = await sb
    .from('fixtures')
    .select('id')
    .lt('kickoff_time', BOUNDARY)
  const oldIds = new Set((oldRows ?? []).map((r: any) => r.id))
  console.log('old fixture ids:', oldIds.size)

  const { data: baList } = await sb.from('bonus_awards').select('id, fixture_id')
  const baOld = (baList ?? []).filter((b: any) => b.fixture_id && oldIds.has(b.fixture_id)).length
  console.log('bonus_awards referencing OLD fixtures (block delete):', baOld)

  const { data: lpList } = await sb.from('los_picks').select('id, fixture_id')
  const lpOld = (lpList ?? []).filter((b: any) => b.fixture_id && oldIds.has(b.fixture_id)).length
  console.log('los_picks referencing OLD fixtures (block delete):', lpOld)

  console.log('\n=== gameweek status distribution ===')
  const { data: gws } = await sb.from('gameweeks').select('status')
  const dist: Record<string, number> = {}
  for (const g of gws ?? []) dist[(g as any).status] = (dist[(g as any).status] ?? 0) + 1
  console.table(dist)
}

main().catch((e) => { console.error(e); process.exit(1) })
