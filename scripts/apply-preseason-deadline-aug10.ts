/**
 * One-shot script to move the 2026-27 pre-season deadline (seasons.gw1_kickoff
 * for season=2026) from 1 Aug 2026 to 10 Aug 2026, 23:59 London (BST = UTC+1).
 * Pure DML — no migration file needed. Idempotent — safe to re-run.
 *
 * Usage: npx tsx scripts/apply-preseason-deadline-aug10.ts
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
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
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

const NEW_DEADLINE = '2026-08-10T22:59:00+00:00' // 10 Aug 2026 23:59 BST

async function main(): Promise<void> {
  const { data, error } = await sb
    .from('seasons')
    .update({ gw1_kickoff: NEW_DEADLINE })
    .eq('season', 2026)
    .select('season, label, gw1_kickoff')

  if (error) {
    console.error(`  [fail] ${error.message}`)
    process.exit(1)
  }
  if (!data || data.length === 0) {
    console.error('  [fail] no matching row for season=2026')
    process.exit(1)
  }
  console.log(`  [ok]   seasons(season=2026).gw1_kickoff = ${data[0].gw1_kickoff}`)
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
