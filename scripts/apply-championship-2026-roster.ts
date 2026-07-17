/**
 * Applies migration 024 — fixes the 2026-27 Championship roster to George's
 * real 24-team list. Pure DML, so this runs the change directly via the
 * service-role client (no SQL-editor paste needed), then verifies the final
 * roster is exactly George's 24.
 *
 * Idempotent: re-running is a no-op once the roster is correct.
 *
 * Usage: npx tsx scripts/apply-championship-2026-roster.ts
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing SUPABASE URL or SERVICE_ROLE_KEY')
  process.exit(1)
}
const sb = createClient(url, key, { auth: { persistSession: false } })

const SEASON = 2026
const REMOVE = ['leicester city', 'oxford united', 'sheffield wednesday']
const ADD = ['Bolton Wanderers', 'Cardiff City', 'Lincoln City', 'Wrexham']

// George's authoritative 2026-27 Championship (24 teams), full canonical names.
const EXPECTED = new Set([
  'Birmingham City',
  'Blackburn Rovers',
  'Bolton Wanderers',
  'Bristol City',
  'Burnley',
  'Cardiff City',
  'Charlton Athletic',
  'Derby County',
  'Lincoln City',
  'Middlesbrough',
  'Millwall',
  'Norwich City',
  'Portsmouth',
  'Preston North End',
  'Queens Park Rangers',
  'Sheffield United',
  'Southampton',
  'Stoke City',
  'Swansea City',
  'Watford',
  'West Bromwich Albion',
  'West Ham United',
  'Wolverhampton Wanderers',
  'Wrexham',
])

async function read(): Promise<string[]> {
  const { data, error } = await sb
    .from('championship_teams')
    .select('name')
    .eq('season', SEASON)
    .order('name')
  if (error) throw new Error(error.message)
  return (data as Array<{ name: string }>).map((r) => r.name)
}

async function main(): Promise<void> {
  // 1. Remove stale clubs (case-insensitive match on name).
  const before = await read()
  for (const target of REMOVE) {
    const match = before.find((n) => n.trim().toLowerCase() === target)
    if (!match) continue
    const { error } = await sb
      .from('championship_teams')
      .delete()
      .eq('season', SEASON)
      .eq('name', match)
    if (error) throw new Error(`delete ${match}: ${error.message}`)
    console.log(`  removed: ${match}`)
  }

  // 2. Add the newly-promoted clubs (skip if already present, CI).
  const mid = await read()
  const present = new Set(mid.map((n) => n.trim().toLowerCase()))
  for (const name of ADD) {
    if (present.has(name.toLowerCase())) {
      console.log(`  already present: ${name}`)
      continue
    }
    const { error } = await sb.from('championship_teams').insert({ season: SEASON, name })
    if (error) throw new Error(`insert ${name}: ${error.message}`)
    console.log(`  added: ${name}`)
  }

  // 3. Verify final roster == George's 24.
  const after = await read()
  const got = new Set(after)
  const missing = [...EXPECTED].filter((n) => !got.has(n))
  const extra = [...got].filter((n) => !EXPECTED.has(n))
  console.log(`\nFinal championship_teams(season=${SEASON}) — ${after.length} rows`)
  if (missing.length || extra.length) {
    console.error(`  [fail] roster mismatch`)
    console.error(`         missing: ${missing.join(', ') || '(none)'}`)
    console.error(`         extra:   ${extra.join(', ') || '(none)'}`)
    process.exit(1)
  }
  console.log('  [ok]   roster matches George\'s 24-team 2026-27 Championship')
}

main().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
