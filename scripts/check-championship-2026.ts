/**
 * Read-only diagnostic for the 2026-27 Championship roster.
 * Prints the current championship_teams(season=2026) rows and flags any
 * pre_season_picks that reference a team we are about to remove.
 *
 * Usage: npx tsx scripts/check-championship-2026.ts
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

const TO_REMOVE = ['Leeds United', 'Leicester City', 'Oxford United', 'Sheffield Wednesday']

async function main(): Promise<void> {
  const { data: rows, error } = await sb
    .from('championship_teams')
    .select('name')
    .eq('season', 2026)
    .order('name')
  if (error) {
    console.error('query error:', error.message)
    process.exit(1)
  }
  const names = (rows as Array<{ name: string }>).map((r) => r.name)
  console.log(`\nCurrent championship_teams(season=2026) — ${names.length} rows:`)
  for (const n of names) console.log('  -', n)

  // Any pre-season picks referencing a to-be-removed team?
  const { data: picks, error: pErr } = await sb
    .from('pre_season_picks')
    .select('member_id, promoted, promoted_playoff_winner')
    .eq('season', 2026)
  if (pErr) {
    console.log(`\n(could not read pre_season_picks: ${pErr.message})`)
  } else {
    const affected: string[] = []
    for (const p of (picks as Array<{ member_id: string; promoted: string[] | null; promoted_playoff_winner: string | null }>)) {
      const used = [...(p.promoted ?? []), p.promoted_playoff_winner ?? '']
      const hits = used.filter((u) => TO_REMOVE.includes(u))
      if (hits.length) affected.push(`${p.member_id}: ${hits.join(', ')}`)
    }
    console.log(`\npre_season_picks(2026): ${(picks as unknown[]).length} rows`)
    if (affected.length) {
      console.log('  ⚠ picks referencing a team to be REMOVED:')
      for (const a of affected) console.log('    -', a)
    } else {
      console.log('  ✓ no picks reference any of the 4 teams to be removed')
    }
  }
}
main().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
