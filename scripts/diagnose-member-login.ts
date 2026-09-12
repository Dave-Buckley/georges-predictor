/**
 * Diagnostic: why can't a member log in? Searches members + auth users for a
 * name or email fragment and shows how the two line up (email mismatch,
 * missing auth link, pending approval, etc.).
 *
 * Read-only. Usage: npx tsx scripts/diagnose-member-login.ts <fragment> [<fragment> ...]
 *   e.g. npx tsx scripts/diagnose-member-login.ts stu lenton
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
  const fragments = process.argv.slice(2).map((f) => f.toLowerCase())
  if (fragments.length === 0) {
    console.error('Usage: npx tsx scripts/diagnose-member-login.ts <name-or-email-fragment> ...')
    process.exit(1)
  }
  const matches = (s: string | null | undefined) =>
    !!s && fragments.some((f) => s.toLowerCase().includes(f))

  const { data: members, error: mErr } = await sb.from('members').select('*')
  if (mErr) throw mErr

  const authUsers: { id: string; email?: string; created_at: string; last_sign_in_at?: string; email_confirmed_at?: string }[] = []
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    authUsers.push(...data.users)
    if (data.users.length < 1000) break
  }
  const authById = new Map(authUsers.map((u) => [u.id, u]))

  const memberHits = (members ?? []).filter((m) => matches(m.display_name) || matches(m.email))
  console.log(`=== members matching ${fragments.join(', ')} ===`)
  for (const m of memberHits) {
    const au = m.user_id ? authById.get(m.user_id) : undefined
    console.log({
      member_id: m.id,
      display_name: m.display_name,
      member_email: m.email,
      approval_status: m.approval_status,
      user_id: m.user_id,
      auth_email: au?.email ?? '(no auth user)',
      auth_last_sign_in: au?.last_sign_in_at ?? null,
      auth_confirmed: au?.email_confirmed_at ?? null,
      created_at: m.created_at,
    })
  }

  const linkedIds = new Set((members ?? []).map((m) => m.user_id).filter(Boolean))
  const authHits = authUsers.filter((u) => matches(u.email))
  console.log(`\n=== auth users matching ===`)
  for (const u of authHits) {
    console.log({
      auth_id: u.id,
      email: u.email,
      has_member_row: linkedIds.has(u.id),
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
    })
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
