/**
 * Sets members.favourite_club_id for a named list of members (migration 029).
 *
 *   npx tsx scripts/apply-favourite-clubs.ts            # dry run, shows what would change
 *   npx tsx scripts/apply-favourite-clubs.ts --confirm  # writes
 *
 * The favourite club is cosmetic — it only decides which badge renders beside a
 * name via MemberLink. It never touches scoring, standings order, or LOS.
 *
 * Members are matched on display_name, case-insensitively, and the run aborts
 * before writing anything if a name is missing or matches more than one member,
 * so a rename upstream fails loudly rather than silently updating the wrong
 * person. Clubs are matched the same way against public.clubs.
 *
 * Idempotent: a member already on the intended club is reported as unchanged
 * and skipped. To clear someone, set their entry to null.
 *
 * Take a snapshot first (scripts/snapshot.ts --label pre-...) as with any bulk
 * edit.
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'node:fs'
import * as path from 'node:path'

/** display_name -> club name in public.clubs, or null to clear. */
const ASSIGNMENTS: Record<string, string | null> = {
  Tom: 'Chelsea',
  Shaun: 'Manchester United',
  Barny: 'Liverpool',
  Dad: 'Chelsea',
  Dave: 'Chelsea',
  George: 'Chelsea',
}

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

const confirm = process.argv.includes('--confirm')
const norm = (s: string) => s.trim().toLowerCase()

interface Member {
  id: string
  display_name: string
  favourite_club_id: string | null
}
interface Club {
  id: string
  name: string
}

async function main() {
  const sb = createClient(url!, key!, { auth: { persistSession: false } })

  const { data: memberRows, error: memberErr } = await sb
    .from('members')
    .select('id, display_name, favourite_club_id')
  if (memberErr) {
    console.error('Could not read members:', memberErr.message)
    process.exit(1)
  }
  const { data: clubRows, error: clubErr } = await sb.from('clubs').select('id, name')
  if (clubErr) {
    console.error('Could not read clubs:', clubErr.message)
    process.exit(1)
  }

  const members = (memberRows ?? []) as Member[]
  const clubs = (clubRows ?? []) as Club[]

  // Resolve everything up front. Any problem is a hard stop — a partial run
  // that updated three of six members would be worse than doing nothing.
  const problems: string[] = []
  const planned: Array<{ member: Member; club: Club | null; label: string }> = []

  for (const [name, clubName] of Object.entries(ASSIGNMENTS)) {
    const matches = members.filter((m) => norm(m.display_name) === norm(name))
    if (matches.length === 0) {
      problems.push(`No member named "${name}"`)
      continue
    }
    if (matches.length > 1) {
      problems.push(`"${name}" matches ${matches.length} members — ambiguous`)
      continue
    }

    let club: Club | null = null
    if (clubName !== null) {
      const clubMatches = clubs.filter((c) => norm(c.name) === norm(clubName))
      if (clubMatches.length !== 1) {
        problems.push(`Club "${clubName}" matched ${clubMatches.length} rows in public.clubs`)
        continue
      }
      club = clubMatches[0]
    }
    planned.push({ member: matches[0], club, label: clubName ?? '(cleared)' })
  }

  if (problems.length > 0) {
    console.error('Aborting, nothing written:')
    for (const p of problems) console.error('  - ' + p)
    process.exit(1)
  }

  const clubNameById = new Map(clubs.map((c) => [c.id, c.name]))
  const changes = planned.filter((p) => (p.club?.id ?? null) !== p.member.favourite_club_id)
  const unchanged = planned.filter((p) => (p.club?.id ?? null) === p.member.favourite_club_id)

  console.log(confirm ? 'Applying favourite clubs' : 'Dry run — nothing will be written')
  console.log()
  for (const p of planned) {
    const from = p.member.favourite_club_id
      ? (clubNameById.get(p.member.favourite_club_id) ?? p.member.favourite_club_id)
      : '(none)'
    const changing = (p.club?.id ?? null) !== p.member.favourite_club_id
    console.log(
      `  ${p.member.display_name.padEnd(10)} ${from} -> ${p.label}` +
        (changing ? '' : '   [already set, skipping]'),
    )
  }
  console.log()

  if (changes.length === 0) {
    console.log('Nothing to do.')
    return
  }
  if (!confirm) {
    console.log(`${changes.length} member(s) would change. Re-run with --confirm to write.`)
    return
  }

  let written = 0
  for (const p of changes) {
    const { error } = await sb
      .from('members')
      .update({ favourite_club_id: p.club?.id ?? null })
      .eq('id', p.member.id)
    if (error) {
      console.error(`  FAILED ${p.member.display_name}: ${error.message}`)
      continue
    }
    written++
  }
  console.log(`Updated ${written} of ${changes.length} member(s). ${unchanged.length} already correct.`)
}

main()
