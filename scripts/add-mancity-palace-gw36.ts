/**
 * Adds the rescheduled Manchester City vs Crystal Palace fixture
 * to Gameweek 36 — Wednesday 13 May 2026, 20:00 BST (19:00 UTC).
 *
 * George requested this manually because football-data.org may not yet have
 * the rescheduled match listed for the right matchday.
 *
 * Idempotent: skipped if any GW36 fixture already pairs Man City vs Crystal Palace.
 *
 * Usage:
 *   npx tsx scripts/add-mancity-palace-gw36.ts            # dry-run
 *   npx tsx scripts/add-mancity-palace-gw36.ts --apply    # write
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
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
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

// Synthetic external_id far above the football-data ID range (~600k) so the
// API sync never collides with this row. manual_gameweek_override=true tells
// the next sync run to leave the row alone.
const SYNTH_EXTERNAL_ID = 9000036
const KICKOFF_UTC = '2026-05-13T19:00:00+00:00'

async function main() {
  const apply = process.argv.includes('--apply')

  const { data: gw36, error: gwErr } = await sb
    .from('gameweeks')
    .select('id, number')
    .eq('number', 36)
    .single()

  if (gwErr || !gw36) {
    console.error(`[fail] GW36 not found: ${gwErr?.message}`)
    process.exit(1)
  }

  const { data: teams, error: teamsErr } = await sb
    .from('teams')
    .select('id, name')
    .or('name.eq.Manchester City FC,name.eq.Crystal Palace FC')

  if (teamsErr || !teams) {
    console.error(`[fail] could not read teams: ${teamsErr?.message}`)
    process.exit(1)
  }

  const home = teams.find((t) => t.name === 'Manchester City FC')
  const away = teams.find((t) => t.name === 'Crystal Palace FC')
  if (!home || !away) {
    console.error('[fail] could not resolve Man City / Crystal Palace team rows')
    process.exit(1)
  }

  // Idempotency: any existing GW36 fixture with these two teams (either side)?
  const { data: existing } = await sb
    .from('fixtures')
    .select('id, external_id, kickoff_time, status, home_team_id, away_team_id, manual_gameweek_override')
    .eq('gameweek_id', gw36.id)
    .or(
      `and(home_team_id.eq.${home.id},away_team_id.eq.${away.id}),` +
        `and(home_team_id.eq.${away.id},away_team_id.eq.${home.id})`,
    )

  if (existing && existing.length > 0) {
    console.log('[ok] fixture already present in GW36 — nothing to do:')
    console.log(JSON.stringify(existing, null, 2))
    return
  }

  const row = {
    external_id: SYNTH_EXTERNAL_ID,
    gameweek_id: gw36.id,
    home_team_id: home.id,
    away_team_id: away.id,
    kickoff_time: KICKOFF_UTC,
    status: 'TIMED' as const,
    is_rescheduled: true,
    manual_gameweek_override: true,
  }

  console.log('Inserting fixture:')
  console.log(JSON.stringify(row, null, 2))

  if (!apply) {
    console.log('\n(dry-run) re-run with --apply to write.')
    return
  }

  const { error: insertErr } = await sb.from('fixtures').insert(row)
  if (insertErr) {
    console.error(`[fail] insert error: ${insertErr.message}`)
    process.exit(1)
  }
  console.log('[ok] fixture inserted.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
