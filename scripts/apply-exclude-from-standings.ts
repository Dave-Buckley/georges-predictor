/**
 * Verifies migration 022 (members.exclude_from_standings flag + Bucks
 * excluded). The DDL must be pasted into Supabase SQL Editor; this script
 * confirms the column exists and Bucks is excluded.
 *
 * Usage: npx tsx scripts/apply-exclude-from-standings.ts
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

function printSql(): void {
  const sqlPath = path.resolve(
    process.cwd(),
    'supabase/migrations/022_exclude_from_standings.sql',
  )
  const sql = fs.readFileSync(sqlPath, 'utf8')
  console.error(
    `\n  Run this SQL in the Supabase SQL Editor (Project → SQL Editor):\n` +
      '\n  ' + '─'.repeat(72) + '\n' +
      sql +
      '\n  ' + '─'.repeat(72) + '\n' +
      '\n  Then re-run this script to verify.\n',
  )
}

async function main(): Promise<void> {
  // 1. Column reachable?
  const { error: colErr } = await sb
    .from('members')
    .select('exclude_from_standings')
    .limit(1)

  if (colErr) {
    console.error(`  [fail] members.exclude_from_standings not reachable: ${colErr.message}`)
    printSql()
    process.exit(1)
  }
  console.log('  [ok]   members.exclude_from_standings column exists')

  // 2. Bucks excluded?
  const { data: bucks, error: bErr } = await sb
    .from('members')
    .select('display_name, exclude_from_standings')
    .ilike('display_name', 'bucks')

  if (bErr) {
    console.error(`  [fail] could not query Bucks row: ${bErr.message}`)
    process.exit(1)
  }
  const rows = (bucks as Array<{ display_name: string; exclude_from_standings: boolean }>) ?? []
  if (rows.length === 0) {
    console.warn('  [warn] no member named "Bucks" found — nothing to exclude')
  } else if (rows.every((r) => r.exclude_from_standings)) {
    console.log(`  [ok]   Bucks (${rows.length} row${rows.length === 1 ? '' : 's'}) is excluded from standings`)
  } else {
    console.error(`  [fail] Bucks exists but exclude_from_standings is still false`)
    printSql()
    process.exit(1)
  }

  console.log('\n  All checks passed.')
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
