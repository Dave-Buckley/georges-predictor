/**
 * Diagnostic: which approved members are NOT enrolled in the active LOS
 * competition? Un-enrolled members never see the shield on the gameweek page
 * (PredictionForm hides it when memberStatus !== 'active').
 *
 * Read-only. Usage: npx tsx scripts/diagnose-los-enrolment.ts
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

async function main() {
  const { data: comps } = await sb
    .from('los_competitions')
    .select('id, season, competition_num, status, starts_at_gw, ended_at_gw, created_at')
    .order('created_at')
  console.log('=== los_competitions ===')
  console.table(comps ?? [])

  const active = (comps ?? []).find((c) => c.status === 'active') as
    | { id: string; competition_num: number; starts_at_gw: number }
    | undefined
  if (!active) {
    console.log('No active competition.')
    return
  }

  const { data: gws } = await sb
    .from('gameweeks')
    .select('number, status, deadline')
    .in('status', ['active', 'upcoming'])
    .order('number')
    .limit(3)
  console.log('\n=== next gameweeks ===')
  console.table(gws ?? [])

  const { data: members } = await sb
    .from('members')
    .select('id, display_name, approval_status, exclude_from_standings, user_id, approved_at')
    .order('display_name')

  const { data: enrolled } = await sb
    .from('los_competition_members')
    .select('member_id, status, eliminated_at_gw, eliminated_reason')
    .eq('competition_id', active.id)

  const enrolledById = new Map((enrolled ?? []).map((r) => [r.member_id as string, r]))

  const rows = (members ?? []).map((m) => {
    const e = enrolledById.get(m.id as string)
    return {
      name: m.display_name,
      approval: m.approval_status,
      excluded: m.exclude_from_standings,
      hasAuth: !!m.user_id,
      losRow: e ? e.status : '*** MISSING ***',
      elimGw: e?.eliminated_at_gw ?? '',
      approved_at: (m.approved_at as string | null)?.slice(0, 10) ?? '',
    }
  })
  console.log(`\n=== members vs enrolment in competition #${active.competition_num} (${active.id}) ===`)
  console.table(rows)

  const missing = rows.filter((r) => r.losRow === '*** MISSING ***' && r.approval === 'approved')
  console.log(`\nApproved members with NO los_competition_members row: ${missing.length}`)
  for (const m of missing) {
    console.log(`  - ${m.name} (excluded_from_standings=${m.excluded}, hasAuth=${m.hasAuth}, approved ${m.approved_at})`)
  }

  const { data: picks } = await sb
    .from('los_picks')
    .select('member_id, gameweek_id, team_id, outcome')
    .eq('competition_id', active.id)
  console.log(`\nTotal los_picks in this cycle: ${(picks ?? []).length}`)
  const evaluated = (picks ?? []).filter((p) => p.outcome !== null).length
  console.log(`Picks already evaluated (outcome set): ${evaluated}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
