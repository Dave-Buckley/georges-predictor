/**
 * One-shot verifier/repairer for migration 019.
 *
 * Checks whether `fixtures.manual_gameweek_override` exists and whether the
 * three GW33-bundled fixtures (Brighton vs Chelsea, Bournemouth vs Leeds,
 * Burnley vs Man City) are correctly pinned to GW33 with override=true.
 *
 * Supabase JS can't run DDL, so if the column is missing this script prints
 * the SQL to paste into the Supabase SQL editor. The gameweek-id re-pin is
 * DML and can be performed by this script with `--repair`.
 *
 * Usage:
 *   npx tsx scripts/apply-fixture-override.ts           # verify only
 *   npx tsx scripts/apply-fixture-override.ts --repair  # re-pin to GW33
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

const supabase = createClient(url, key, {
  auth: { persistSession: false },
})

const BUNDLED_FIXTURE_IDS = [
  '9ca38a78-dfee-40fc-8af8-3e3aba0b4225', // Brighton vs Chelsea
  '7b953a65-caeb-4874-9a14-b9b1d3dd34b2', // Bournemouth vs Leeds
  'd2be9f53-4bed-480e-b8ea-6bba4d4e4dbf', // Burnley vs Man City
]

async function main() {
  const repair = process.argv.includes('--repair')

  const { error: colError } = await supabase
    .from('fixtures')
    .select('manual_gameweek_override')
    .limit(1)

  if (colError) {
    const sqlPath = path.resolve(
      process.cwd(),
      'supabase/migrations/019_fixture_override_and_prize_fix.sql',
    )
    const sql = fs.readFileSync(sqlPath, 'utf8')
    console.error(
      `  [fail] fixtures.manual_gameweek_override missing: ${colError.message}\n` +
        `\n  Run this SQL in the Supabase SQL Editor (Project → SQL Editor):\n` +
        '\n  ' + '─'.repeat(72) + '\n' +
        sql +
        '\n  ' + '─'.repeat(72) + '\n' +
        '\n  Then re-run this script to verify.\n',
    )
    process.exit(1)
  }

  console.log('  [ok]   fixtures.manual_gameweek_override column exists')

  const { data: rows, error: rowsError } = await supabase
    .from('fixtures')
    .select('id, manual_gameweek_override, gameweeks(number)')
    .in('id', BUNDLED_FIXTURE_IDS)

  if (rowsError) {
    console.error(`  [fail] could not read bundled fixtures: ${rowsError.message}`)
    process.exit(1)
  }

  let allGood = true
  for (const id of BUNDLED_FIXTURE_IDS) {
    const row = rows?.find((r) => r.id === id) as
      | {
          id: string
          manual_gameweek_override: boolean | null
          gameweeks: { number: number } | null
        }
      | undefined
    if (!row) {
      console.error(`  [fail] bundled fixture ${id} not found`)
      allGood = false
      continue
    }
    const gwNumber = row.gameweeks?.number ?? null
    const override = !!row.manual_gameweek_override
    if (gwNumber === 33 && override) {
      console.log(`  [ok]   ${id} → GW33, override=true`)
    } else {
      console.error(
        `  [fail] ${id} → GW${gwNumber ?? '?'}, override=${override} (expected GW33, override=true)`,
      )
      allGood = false
    }
  }

  if (!allGood) {
    if (!repair) {
      console.error(
        '\n  One or more bundled fixtures are not correctly pinned to GW33.\n' +
          '  Re-run with --repair to pin them back to GW33 with override=true.\n',
      )
      process.exit(1)
    }

    console.log('\n  --repair passed — pinning bundled fixtures to GW33...')

    const { data: gw33, error: gwError } = await supabase
      .from('gameweeks')
      .select('id')
      .eq('number', 33)
      .single()

    if (gwError || !gw33) {
      console.error(`  [fail] could not resolve GW33 id: ${gwError?.message}`)
      process.exit(1)
    }

    const { error: repairError } = await supabase
      .from('fixtures')
      .update({
        gameweek_id: gw33.id,
        manual_gameweek_override: true,
        is_rescheduled: true,
      })
      .in('id', BUNDLED_FIXTURE_IDS)

    if (repairError) {
      console.error(`  [fail] repair update failed: ${repairError.message}`)
      process.exit(1)
    }

    console.log('  [ok]   bundled fixtures re-pinned to GW33')
    return
  }

  console.log('\n  All three bundled fixtures are correctly pinned to GW33.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
