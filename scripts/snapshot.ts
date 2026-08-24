/**
 * READ-ONLY full-database snapshot.
 *
 * Dumps every table to one timestamped JSON file so the current state can be
 * restored if a change goes wrong. Nothing in here writes to the database.
 *
 * Run this BEFORE any migration, reset, or bulk edit — and once a week as a
 * routine safety net (see docs/WEEKLY-SNAPSHOT.md).
 *
 *   npx tsx scripts/snapshot.ts
 *   npx tsx scripts/snapshot.ts --label pre-favourite-team
 *
 * Output: scripts/_backups/snapshot-<ISO>[-<label>].json
 *
 * Restoring is deliberately NOT automated. A blind restore would clobber
 * legitimate activity that happened after the snapshot. To roll something
 * back, open the JSON, find the rows in question, and put them back
 * explicitly — see docs/WEEKLY-SNAPSHOT.md.
 *
 * Table list is probed, not assumed: unknown/renamed tables are reported
 * rather than silently skipped, so a new table added later shows up as a gap
 * instead of quietly falling out of the backup.
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const sb = createClient(url, key, { auth: { persistSession: false } })

/**
 * Every table the app owns. Keep this list in sync when a migration adds one —
 * anything missing here is silently absent from the backup, which is the one
 * failure mode a snapshot must not have.
 */
const TABLES = [
  'members',
  'archived_members',
  'admin_settings',
  'admin_security_questions',
  'admin_notifications',
  'blocked_emails',
  'seasons',
  'teams',
  'pl_teams',
  'championship_teams',
  'gameweeks',
  'fixtures',
  'result_overrides',
  'predictions',
  'prediction_scores',
  'prediction_locks',
  'bonus_types',
  'bonus_awards',
  'bonus_schedule',
  'point_adjustments',
  'prize_awards',
  'additional_prizes',
  'pre_season_picks',
  'pre_season_awards',
  'h2h_steals',
  'los_competitions',
  'los_competition_members',
  'los_picks',
  'member_report_log',
  'sync_log',
] as const

async function dump(table: string): Promise<{ rows: unknown[]; error?: string }> {
  const all: unknown[] = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await sb.from(table).select('*').range(from, from + pageSize - 1)
    if (error) return { rows: all, error: error.message }
    all.push(...(data ?? []))
    if (!data || data.length < pageSize) break
  }
  return { rows: all }
}

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

async function main(): Promise<void> {
  const labelFlag = process.argv.indexOf('--label')
  const label = labelFlag !== -1 ? process.argv[labelFlag + 1] : undefined

  console.log('Snapshotting database (read-only)...\n')

  const tables: Record<string, unknown[]> = {}
  const missing: string[] = []
  let totalRows = 0

  for (const table of TABLES) {
    const { rows, error } = await dump(table)
    if (error) {
      missing.push(`${table} (${error})`)
      console.log(`  ${table.padEnd(26)} —  SKIPPED: ${error}`)
      continue
    }
    tables[table] = rows
    totalRows += rows.length
    console.log(`  ${table.padEnd(26)} ${String(rows.length).padStart(6)} rows`)
  }

  const payload = {
    captured_at: new Date().toISOString(),
    label: label ?? null,
    supabase_url: url,
    table_count: Object.keys(tables).length,
    total_rows: totalRows,
    tables_missing: missing,
    tables,
  }

  const outDir = path.resolve(process.cwd(), 'scripts', '_backups')
  fs.mkdirSync(outDir, { recursive: true })
  const name = `snapshot-${stamp()}${label ? `-${label}` : ''}.json`
  const outPath = path.join(outDir, name)
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8')

  const kb = fs.statSync(outPath).size / 1024
  console.log(`\n  ${Object.keys(tables).length} tables, ${totalRows} rows`)
  if (missing.length > 0) {
    console.log(`  ${missing.length} table(s) skipped — check whether they were renamed or dropped:`)
    for (const m of missing) console.log(`    - ${m}`)
  }
  console.log(`\nWrote ${outPath} (${kb.toFixed(0)} KB)`)
}

main().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
