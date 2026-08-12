/**
 * Enrols every approved, non-excluded member who is missing from the active
 * Last One Standing cycle.
 *
 * Why this exists: los_competition_members rows were only ever created by the
 * season bootstrap and by resetCompetitionIfNeeded. Anyone approved after the
 * cycle started never got a row, so the shield never appeared on their
 * gameweek page (predictions and bonus still worked, which made it look like
 * the shield was randomly missing for some people).
 *
 * approveMember/addMember now enrol automatically — this script repairs the
 * members who slipped through before that fix, and is safe to re-run any time.
 *
 * Never touches an existing row: an eliminated member stays eliminated.
 *
 * Dry-run by default. Usage: npx tsx scripts/backfill-los-enrolment.ts [--confirm]
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

async function main() {
  const { data: active } = await sb
    .from('los_competitions')
    .select('id, season, competition_num, starts_at_gw')
    .eq('status', 'active')
    .maybeSingle()

  if (!active) {
    console.log('No active LOS competition — nothing to backfill.')
    return
  }
  const comp = active as { id: string; season: number; competition_num: number; starts_at_gw: number }
  console.log(`Active competition #${comp.competition_num} (season ${comp.season}, starts GW${comp.starts_at_gw})`)

  const { data: approved } = await sb
    .from('members')
    .select('id, display_name')
    .eq('approval_status', 'approved')
    .eq('exclude_from_standings', false)
    .order('display_name')

  const { data: enrolled } = await sb
    .from('los_competition_members')
    .select('member_id')
    .eq('competition_id', comp.id)

  const enrolledIds = new Set((enrolled ?? []).map((r) => r.member_id as string))
  const missing = ((approved ?? []) as Array<{ id: string; display_name: string }>)
    .filter((m) => !enrolledIds.has(m.id))

  console.log(`Approved members: ${(approved ?? []).length} · already enrolled: ${enrolledIds.size} · missing: ${missing.length}`)
  for (const m of missing) console.log(`  + ${m.display_name}`)

  if (missing.length === 0) return

  if (!CONFIRM) {
    console.log('\nDRY RUN — pass --confirm to enrol the members listed above.')
    return
  }

  const rows = missing.map((m) => ({
    competition_id: comp.id,
    member_id: m.id,
    status: 'active',
  }))

  const { error } = await sb.from('los_competition_members').insert(rows)
  if (error) throw error

  console.log(`\nEnrolled ${rows.length} member(s) in competition #${comp.competition_num}.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
