/**
 * Verifies migration 023 (pl_teams + 2026 PL/Championship seed +
 * gw1_kickoff move). Supabase JS doesn't run raw SQL — the SQL must be
 * pasted into the Supabase SQL Editor first; this script then confirms
 * that everything is reachable and the row counts/values are what we
 * expect.
 *
 * Usage: npx tsx scripts/apply-pl-teams-2026.ts
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

const EXPECTED_PL_2026 = new Set([
  'AFC Bournemouth',
  'Arsenal FC',
  'Aston Villa FC',
  'Brentford FC',
  'Brighton & Hove Albion FC',
  'Chelsea FC',
  'Coventry City FC',
  'Crystal Palace FC',
  'Everton FC',
  'Fulham FC',
  'Hull City AFC',
  'Ipswich Town FC',
  'Leeds United FC',
  'Liverpool FC',
  'Manchester City FC',
  'Manchester United FC',
  'Newcastle United FC',
  'Nottingham Forest FC',
  'Sunderland AFC',
  'Tottenham Hotspur FC',
])

const EXPECTED_KICKOFF_2026 = '2026-08-01T22:59:00+00:00'

function printSql(): void {
  const sqlPath = path.resolve(
    process.cwd(),
    'supabase/migrations/023_pl_teams_and_2026_seed.sql',
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
  let failed = false

  // 1. pl_teams table reachable
  const { data: plRows, error: plErr } = await sb
    .from('pl_teams')
    .select('season, name')
    .eq('season', 2026)
    .order('name')

  if (plErr) {
    console.error(`  [fail] pl_teams table not reachable: ${plErr.message}`)
    printSql()
    process.exit(1)
  }

  const plNames = new Set(
    (plRows as Array<{ name: string }>).map((r) => r.name),
  )
  const missing = [...EXPECTED_PL_2026].filter((n) => !plNames.has(n))
  const extra = [...plNames].filter((n) => !EXPECTED_PL_2026.has(n))
  if (missing.length || extra.length) {
    console.error(
      `  [fail] pl_teams(season=2026) mismatch.\n` +
        `         missing: ${missing.join(', ') || '(none)'}\n` +
        `         extra:   ${extra.join(', ') || '(none)'}`,
    )
    failed = true
  } else {
    console.log(`  [ok]   pl_teams(season=2026) has the expected 20 clubs`)
  }

  // 2. championship_teams for 2026 — must contain Wolves/Burnley/West Ham,
  //    must not contain Coventry/Ipswich/Hull
  const { data: chRows, error: chErr } = await sb
    .from('championship_teams')
    .select('name')
    .eq('season', 2026)

  if (chErr) {
    console.error(`  [fail] championship_teams query error: ${chErr.message}`)
    failed = true
  } else {
    const chNames = new Set(
      (chRows as Array<{ name: string }>).map((r) => r.name),
    )
    const requiredIn = ['Wolverhampton Wanderers', 'Burnley', 'West Ham United']
    const forbiddenIn = ['Coventry City', 'Ipswich Town', 'Hull City']
    const missingCh = requiredIn.filter((n) => !chNames.has(n))
    const stillThere = forbiddenIn.filter((n) => chNames.has(n))
    if (missingCh.length || stillThere.length) {
      console.error(
        `  [fail] championship_teams(season=2026) wrong.\n` +
          `         missing: ${missingCh.join(', ') || '(none)'}\n` +
          `         should not be here: ${stillThere.join(', ') || '(none)'}`,
      )
      failed = true
    } else {
      console.log(
        `  [ok]   championship_teams(season=2026) has the relegated trio, not the promoted trio`,
      )
    }
  }

  // 3. seasons.gw1_kickoff for 2026
  const { data: seasonRow, error: seasonErr } = await sb
    .from('seasons')
    .select('season, gw1_kickoff')
    .eq('season', 2026)
    .single()

  if (seasonErr || !seasonRow) {
    console.error(
      `  [fail] seasons(season=2026) not reachable: ${seasonErr?.message ?? 'no row'}`,
    )
    failed = true
  } else {
    const got = new Date(
      (seasonRow as { gw1_kickoff: string }).gw1_kickoff,
    ).toISOString()
    const want = new Date(EXPECTED_KICKOFF_2026).toISOString()
    if (got !== want) {
      console.error(
        `  [fail] seasons(season=2026).gw1_kickoff is ${got}, expected ${want}`,
      )
      failed = true
    } else {
      console.log(`  [ok]   seasons(season=2026).gw1_kickoff = ${got}`)
    }
  }

  if (failed) {
    printSql()
    process.exit(1)
  }

  console.log('\n  All checks passed.')
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
