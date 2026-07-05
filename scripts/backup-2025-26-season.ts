/**
 * READ-ONLY. Dumps every row the 2026/27 season reset will touch to a single
 * timestamped JSON file so last season is fully recoverable. Run this BEFORE
 * any destructive reset. Also captures the final leaderboard snapshot used to
 * populate the season archive.
 *
 * Usage: npx tsx scripts/backup-2025-26-season.ts
 * Output: scripts/_backups/season-2025-backup-<ISO>.json
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

async function dump(table: string): Promise<unknown[]> {
  const all: unknown[] = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await sb.from(table).select('*').range(from, from + pageSize - 1)
    if (error) { console.log(`  ${table}: ERROR ${error.message}`); break }
    all.push(...(data ?? []))
    if (!data || data.length < pageSize) break
  }
  console.log(`  ${table}: ${all.length} rows`)
  return all
}

// Timestamp passed in (Date.now unavailable in some sandboxes; here it's fine
// via process, but keep it explicit and filename-safe).
function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

async function main() {
  console.log('Backing up 2025/26 season data...')
  const backup: Record<string, unknown> = { captured_at: new Date().toISOString() }

  for (const table of [
    'members',
    'teams',
    'gameweeks',
    'fixtures',
    'predictions',
    'prediction_scores',
    'result_overrides',
    'bonus_awards',
    'bonus_schedule',
    'point_adjustments',
    'prediction_locks',
    'prize_awards',
    'h2h_steals',
    'los_competitions',
    'los_competition_members',
    'los_picks',
    'seasons',
  ]) {
    backup[table] = await dump(table)
  }

  const outDir = path.resolve(process.cwd(), 'scripts', '_backups')
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, `season-2025-backup-${stamp()}.json`)
  fs.writeFileSync(outPath, JSON.stringify(backup, null, 2), 'utf8')
  const bytes = fs.statSync(outPath).size
  console.log(`\nWrote ${outPath} (${(bytes / 1024).toFixed(0)} KB)`)
}

main().catch((e) => { console.error(e); process.exit(1) })
