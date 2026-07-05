/**
 * Removes the duplicate "Leeds United" rows from championship_teams (seasons
 * 2025 and 2026). Leeds are a Premier League club — they belong only in
 * pl_teams ("Leeds United FC"), not in the Championship dropdowns.
 *
 * Dry-run by default. Pass --confirm to actually delete.
 * Usage: npx tsx scripts/fix-leeds-championship.ts [--confirm]
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
  const { data: before } = await sb
    .from('championship_teams')
    .select('id, season, name')
    .ilike('name', 'leeds%')
  console.log('championship_teams Leeds rows found:', before?.length ?? 0)
  console.table(before ?? [])

  if (!CONFIRM) {
    console.log('\nDRY RUN — pass --confirm to delete these rows.')
    return
  }

  const { error } = await sb
    .from('championship_teams')
    .delete()
    .ilike('name', 'leeds%')
  if (error) throw error

  const { data: after } = await sb
    .from('championship_teams')
    .select('id')
    .ilike('name', 'leeds%')
  console.log('\nDeleted. championship_teams Leeds rows remaining:', after?.length ?? 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
