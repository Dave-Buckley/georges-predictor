/**
 * Resets the live database for the 2026/27 season. The 2026/27 fixtures are
 * already synced; this removes last season's (2025/26) leftovers that are
 * mixed in and gives a clean slate.
 *
 * Last season's FINAL league table is preserved separately in
 * src/lib/history/season-2025-26.ts (Previous Season view), and a full JSON
 * dump lives in scripts/_backups/ — so this is recoverable.
 *
 * DRY-RUN BY DEFAULT. Requires BOTH a backup file on disk AND the --confirm
 * flag to mutate anything.
 *
 * Steps (order matters for FK constraints):
 *   1. Delete bonus_awards        (NO ACTION on fixture_id would block delete)
 *   2. Delete point_adjustments   (gw-scoped; would leak into reused GW rows)
 *   3. Delete prediction_locks    (gw-scoped; would lock members out of new GW)
 *   4. Delete bonus_schedule      (gw-scoped last-season bonus rotation)
 *   5. Delete h2h_steals          (gw-scoped)
 *   6. Delete OLD fixtures (kickoff < 2026-06-01) — CASCADEs predictions,
 *      prediction_scores, result_overrides
 *   7. Reset all 38 gameweeks to a fresh scheduled state
 *   8. Zero members.starting_points for everyone shown on standings
 *   9. Delete orphan teams (relegated clubs with no remaining fixtures)
 *
 * Usage: npx tsx scripts/reset-for-2026-27-season.ts [--confirm]
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

const CONFIRM = process.argv.includes('--confirm')
// Old 2025/26 fixtures kick off Aug 2025 – May 2026; new 2026/27 kick off from
// Aug 2026. Nothing kicks off Jun/Jul 2026, so this boundary is unambiguous.
const BOUNDARY = '2026-06-01T00:00:00Z'

function assertBackupExists(): void {
  const dir = path.resolve(process.cwd(), 'scripts', '_backups')
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')) : []
  if (files.length === 0) {
    console.error(
      'ABORT: no backup found in scripts/_backups/. Run ' +
        'scripts/backup-2025-26-season.ts first.',
    )
    process.exit(1)
  }
  console.log('Backup(s) present:', files.join(', '))
}

async function count(table: string, build?: (q: any) => any): Promise<number> {
  let q = sb.from(table).select('*', { count: 'exact', head: true })
  if (build) q = build(q)
  const { count: c } = await q
  return c ?? 0
}

async function delAll(table: string): Promise<void> {
  // Supabase requires a filter on delete; id not-null matches every row.
  const { error } = await sb.from(table).delete().not('id', 'is', null)
  if (error) throw new Error(`${table} delete: ${error.message}`)
}

async function main() {
  console.log('=== 2026/27 SEASON RESET ===  boundary(old<):', BOUNDARY)
  console.log('Mode:', CONFIRM ? 'CONFIRM (will mutate)' : 'DRY RUN')
  assertBackupExists()

  const oldFx = await count('fixtures', (q) => q.lt('kickoff_time', BOUNDARY))
  const newFx = await count('fixtures', (q) => q.gte('kickoff_time', BOUNDARY))
  console.log('\nWould delete OLD fixtures:', oldFx, '| keep NEW fixtures:', newFx)
  console.log('Would delete bonus_awards:', await count('bonus_awards'))
  console.log('Would delete point_adjustments:', await count('point_adjustments'))
  console.log('Would delete prediction_locks:', await count('prediction_locks'))
  console.log('Would delete bonus_schedule:', await count('bonus_schedule'))
  console.log('Would delete h2h_steals:', await count('h2h_steals'))
  console.log('predictions cascading with old fixtures:', await count('predictions'))
  console.log('prediction_scores cascading:', await count('prediction_scores'))

  if (!CONFIRM) {
    console.log('\nDRY RUN complete — pass --confirm to execute.')
    return
  }

  // ── 1-5. Clear gameweek-scoped + fixture-blocking tables ──────────────────
  console.log('\n[1] Deleting bonus_awards...'); await delAll('bonus_awards')
  console.log('[2] Deleting point_adjustments...'); await delAll('point_adjustments')
  console.log('[3] Deleting prediction_locks...'); await delAll('prediction_locks')
  console.log('[4] Deleting bonus_schedule...'); await delAll('bonus_schedule')
  console.log('[5] Deleting h2h_steals...'); await delAll('h2h_steals')

  // ── 6. Delete old fixtures (cascades predictions/scores/overrides) ────────
  console.log('[6] Deleting OLD fixtures (< boundary)...')
  {
    const { error } = await sb.from('fixtures').delete().lt('kickoff_time', BOUNDARY)
    if (error) throw new Error(`fixtures delete: ${error.message}`)
  }

  // ── 7. Reset all gameweeks to a clean scheduled state ─────────────────────
  console.log('[7] Resetting gameweeks...')
  {
    const { error } = await sb
      .from('gameweeks')
      .update({
        status: 'scheduled',
        closed_at: null,
        closed_by: null,
        points_applied: false,
        double_bubble: false,
        reports_sent_at: null,
        kickoff_backup_sent_at: null,
      })
      .not('id', 'is', null)
    if (error) throw new Error(`gameweeks reset: ${error.message}`)
  }

  // ── 8. Zero the leaderboard for everyone shown on standings ───────────────
  console.log('[8] Zeroing members.starting_points (non-excluded)...')
  {
    const { error } = await sb
      .from('members')
      .update({ starting_points: 0 })
      .eq('exclude_from_standings', false)
    if (error) throw new Error(`members reset: ${error.message}`)
  }

  // ── 9. Delete orphan teams (relegated clubs with no remaining fixtures) ────
  console.log('[9] Deleting orphan teams...')
  {
    const { data: fx } = await sb.from('fixtures').select('home_team_id, away_team_id')
    const used = new Set<string>()
    for (const f of (fx ?? []) as Array<{ home_team_id: string; away_team_id: string }>) {
      used.add(f.home_team_id); used.add(f.away_team_id)
    }
    const { data: teams } = await sb.from('teams').select('id, name')
    const orphans = (teams ?? []).filter((t: any) => !used.has(t.id))
    console.log('  orphan teams:', orphans.map((o: any) => o.name).join(', ') || '(none)')
    for (const o of orphans as Array<{ id: string; name: string }>) {
      const { error } = await sb.from('teams').delete().eq('id', o.id)
      if (error) console.log(`  (could not delete ${o.name}: ${error.message})`)
    }
  }

  // ── Verify ────────────────────────────────────────────────────────────────
  console.log('\n=== POST-RESET VERIFICATION ===')
  console.log('fixtures total:', await count('fixtures'),
    '| old remaining:', await count('fixtures', (q) => q.lt('kickoff_time', BOUNDARY)))
  console.log('predictions:', await count('predictions'),
    '| prediction_scores:', await count('prediction_scores'))
  console.log('bonus_awards:', await count('bonus_awards'),
    '| point_adjustments:', await count('point_adjustments'),
    '| prediction_locks:', await count('prediction_locks'))
  console.log('teams:', await count('teams'))
  const { data: gwStatuses } = await sb.from('gameweeks').select('status')
  const dist: Record<string, number> = {}
  for (const g of gwStatuses ?? []) dist[(g as any).status] = (dist[(g as any).status] ?? 0) + 1
  console.log('gameweek statuses:', JSON.stringify(dist))
  const { data: topMembers } = await sb
    .from('members').select('display_name, starting_points')
    .eq('exclude_from_standings', false)
    .order('starting_points', { ascending: false }).limit(3)
  console.log('top standings now:', JSON.stringify(topMembers))
  console.log('\nReset complete.')
}

main().catch((e) => { console.error(e); process.exit(1) })
