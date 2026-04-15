/**
 * update-points.ts
 *
 * Bulk-updates members' starting_points from a pasted tally.
 * The /standings page displays starting_points directly, so updating this
 * column is what gets the new numbers live.
 *
 * Usage:
 *   npm run update:points           → dry run (prints what would change)
 *   npm run update:points -- --apply → writes to Supabase
 *
 * Matching is case-insensitive on display_name. Unmatched names are listed
 * at the end so you can fix typos without half-applying the update.
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

function loadEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnvLocal()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  process.exit(1)
}

// ─── The tally ─────────────────────────────────────────────────────────────
// Edit this list each week before running. Format: [display_name, points]
const TALLY: Array<[string, number]> = [
  ['Big Steve', 2790],
  ['Dan The Man', 2700],
  ['Stu', 2670],
  ['Eric', 2610],
  ['Michael', 2600],
  ['Harry', 2590],
  ['Dave', 2550],
  ['Jack', 2520],
  ['Darren', 2510],
  ['Rohan', 2500],
  ['George', 2480],
  ['Craig', 2470],
  ['Hugo', 2460],
  ['Liam', 2460],
  ['Martyn', 2440],
  ['Mike', 2440],
  ['Jimmy', 2420],
  ['Winston', 2420],
  ['Papa Spam', 2410],
  ['Rich', 2380],
  ['Big Sean', 2370],
  ['Leigh-Ann', 2360],
  ['Eddie', 2350],
  ['Jonni', 2340],
  ['Tom', 2340],
  ['Ashley', 2330],
  ['Pete', 2330],
  ['Bert', 2310],
  ['Danny', 2310],
  ['Anna', 2300],
  ['Louis', 2270],
  ['Leon', 2270],
  ['Dad', 2260],
  ['Lewis', 2240],
  ['Shaun', 2240],
  ['Sammy', 2230],
  ['Sunny', 2220],
  ['Dan', 2190],
  ['Grant', 2180],
  ['Barny', 2180],
  ['Phil', 2170],
  ['Milly', 2140],
  ['Matt', 2120],
  ['Jim', 2060],
  ['Luke', 2050],
  ['Steve', 2020],
  ['Charlie', 1910],
  ['Obi', 1340],
]

const APPLY = process.argv.includes('--apply')

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main(): Promise<void> {
  console.log(`=== Update points — ${APPLY ? 'APPLY' : 'DRY RUN'} ===\n`)

  const { data: members, error } = await supabase
    .from('members')
    .select('id, display_name, starting_points')

  if (error) throw new Error(`Failed to fetch members: ${error.message}`)

  const byLower = new Map<string, { id: string; display_name: string; starting_points: number }>()
  for (const m of (members ?? []) as Array<{ id: string; display_name: string; starting_points: number | null }>) {
    byLower.set(m.display_name.toLowerCase().trim(), {
      id: m.id,
      display_name: m.display_name,
      starting_points: m.starting_points ?? 0,
    })
  }

  const matched: Array<{ id: string; name: string; was: number; now: number }> = []
  const unchanged: Array<{ name: string; points: number }> = []
  const unmatched: string[] = []

  for (const [name, points] of TALLY) {
    const hit = byLower.get(name.toLowerCase().trim())
    if (!hit) {
      unmatched.push(name)
      continue
    }
    if (hit.starting_points === points) {
      unchanged.push({ name: hit.display_name, points })
    } else {
      matched.push({ id: hit.id, name: hit.display_name, was: hit.starting_points, now: points })
    }
  }

  console.log(`Matched with changes: ${matched.length}`)
  for (const m of matched) {
    const delta = m.now - m.was
    const sign = delta >= 0 ? '+' : ''
    console.log(`  ${m.name.padEnd(20)} ${String(m.was).padStart(5)} → ${String(m.now).padStart(5)}  (${sign}${delta})`)
  }

  if (unchanged.length > 0) {
    console.log(`\nAlready correct: ${unchanged.length}`)
    for (const u of unchanged) console.log(`  ${u.name} (${u.points})`)
  }

  if (unmatched.length > 0) {
    console.log(`\nNOT FOUND in members table: ${unmatched.length}`)
    for (const n of unmatched) console.log(`  - ${n}`)
    console.log('\nFix these names (typo? not registered/imported yet?) before applying.')
  }

  if (!APPLY) {
    console.log('\nDry run only. Re-run with --apply to write changes.')
    return
  }

  if (matched.length === 0) {
    console.log('\nNothing to update.')
    return
  }

  console.log('\nApplying updates...')
  let ok = 0
  let fail = 0
  for (const m of matched) {
    const { error: updErr } = await supabase
      .from('members')
      .update({ starting_points: m.now })
      .eq('id', m.id)
    if (updErr) {
      console.error(`  ✗ ${m.name}: ${updErr.message}`)
      fail++
    } else {
      ok++
    }
  }
  console.log(`\nDone. Updated: ${ok}${fail ? `  failed: ${fail}` : ''}`)
}

main().catch((err: unknown) => {
  console.error('\nFailed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
