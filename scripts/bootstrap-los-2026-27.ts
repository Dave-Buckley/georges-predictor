/**
 * Bootstraps the FIRST Last One Standing competition for the 2026/27 season.
 * The app can auto-reset a cycle when a winner is found, but nothing ever
 * seeds cycle #1 — so LOS has never started. This creates it and enrols every
 * approved member, mirroring resetCompetitionIfNeeded (src/lib/los/round.ts).
 *
 * Idempotent: aborts if an active competition already exists.
 * Dry-run by default. Pass --confirm to create.
 * Usage: npx tsx scripts/bootstrap-los-2026-27.ts [--confirm]
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

const CONFIRM = process.argv.includes('--confirm')
const SEASON = 2026
const STARTS_AT_GW = 1

async function main() {
  const { data: active } = await sb
    .from('los_competitions')
    .select('id, season, competition_num, status')
    .eq('status', 'active')
    .maybeSingle()

  if (active) {
    console.log('An active LOS competition already exists — nothing to do:')
    console.table([active])
    return
  }

  const { data: approved } = await sb
    .from('members')
    .select('id, display_name')
    .eq('approval_status', 'approved')
    .eq('exclude_from_standings', false)
  const members = (approved ?? []) as Array<{ id: string; display_name: string }>
  console.log(`Would create LOS competition #1 (season ${SEASON}, starts GW${STARTS_AT_GW})`)
  console.log(`Would enrol ${members.length} approved members.`)

  if (!CONFIRM) {
    console.log('\nDRY RUN — pass --confirm to create.')
    return
  }

  const { data: comp, error: compErr } = await sb
    .from('los_competitions')
    .insert({ season: SEASON, competition_num: 1, status: 'active', starts_at_gw: STARTS_AT_GW })
    .select('id')
    .single()
  if (compErr) throw compErr
  const competitionId = (comp as { id: string }).id

  const rows = members.map((m) => ({
    competition_id: competitionId,
    member_id: m.id,
    status: 'active',
  }))
  if (rows.length > 0) {
    const { error: memErr } = await sb.from('los_competition_members').insert(rows)
    if (memErr) throw memErr
  }

  console.log(`\nCreated competition ${competitionId} and enrolled ${rows.length} members.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
