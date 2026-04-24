/**
 * One-shot verify for migration 020 (point_adjustments).
 *
 * Supabase JS can't run DDL — paste supabase/migrations/020_point_adjustments.sql
 * into the Supabase SQL Editor, then re-run this to confirm the table is live.
 *
 * Usage: npx tsx scripts/apply-point-adjustments.ts
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

const supabase = createClient(url, key, { auth: { persistSession: false } })

async function main() {
  const { error } = await supabase
    .from('point_adjustments')
    .select('id')
    .limit(1)

  if (error) {
    const sqlPath = path.resolve(
      process.cwd(),
      'supabase/migrations/020_point_adjustments.sql',
    )
    const sql = fs.readFileSync(sqlPath, 'utf8')
    console.error(
      `  [fail] point_adjustments table not reachable: ${error.message}\n` +
        `\n  Run this SQL in the Supabase SQL Editor (Project → SQL Editor):\n` +
        '\n  ' + '─'.repeat(72) + '\n' +
        sql +
        '\n  ' + '─'.repeat(72) + '\n' +
        '\n  Then re-run this script to verify.\n',
    )
    process.exit(1)
  }

  console.log('  [ok]   point_adjustments table exists and is reachable')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
