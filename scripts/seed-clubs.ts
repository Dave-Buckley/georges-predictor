/**
 * Seeds public.clubs from scripts/_data/clubs.json (built by
 * scripts/fetch-club-badges.ts). Run after pasting migration 029 into the
 * Supabase SQL editor.
 *
 *   npx tsx scripts/seed-clubs.ts            # dry run, shows what would change
 *   npx tsx scripts/seed-clubs.ts --confirm  # writes
 *
 * Idempotent: matches on lower(btrim(name)) via the clubs_name_ci_idx unique
 * index, so re-running updates badges and tiers in place rather than creating
 * duplicates. Re-run it after a fresh fetch to pick up promotions/relegations
 * or newly-resolved badges.
 *
 * Never deletes. A club that drops out of clubs.json stays in the table,
 * because a member may already have it set as their favourite.
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

interface ClubEntry {
  name: string
  official_name: string | null
  short_name: string | null
  league: string | null
  tier: number | null
  badge_url: string | null
  sportsdb_id: string | null
}

interface ExistingClub {
  id: string
  name: string
  badge_url: string | null
  tier: number | null
}

const DATA_PATH = path.resolve(process.cwd(), 'scripts', '_data', 'clubs.json')

async function main(): Promise<void> {
  const confirm = process.argv.includes('--confirm')

  if (!fs.existsSync(DATA_PATH)) {
    console.error(
      `Missing ${DATA_PATH}\n  Run: npx tsx scripts/fetch-club-badges.ts`,
    )
    process.exit(1)
  }

  const parsed = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')) as {
    generated_at?: string
    clubs?: ClubEntry[]
  }
  const clubs = parsed.clubs ?? []
  if (clubs.length === 0) {
    console.error('clubs.json contains no clubs — nothing to seed.')
    process.exit(1)
  }

  console.log(`Loaded ${clubs.length} clubs (generated ${parsed.generated_at ?? 'unknown'})`)
  const withBadge = clubs.filter((c) => c.badge_url).length
  console.log(`  ${withBadge} with a badge, ${clubs.length - withBadge} will render as initials\n`)

  // Reachability check — gives a clear message if migration 029 has not been
  // pasted in yet, rather than a wall of per-row errors.
  const { error: probeErr } = await sb.from('clubs').select('id').limit(1)
  if (probeErr) {
    console.error(
      `  public.clubs is not reachable: ${probeErr.message}\n\n` +
        '  Paste supabase/migrations/029_favourite_club.sql into the Supabase\n' +
        '  SQL editor first, then re-run this script.',
    )
    process.exit(1)
  }

  const { data: existingRaw } = await sb
    .from('clubs')
    .select('id, name, badge_url, tier')
  const existing = new Map(
    ((existingRaw ?? []) as ExistingClub[]).map((c) => [
      c.name.trim().toLowerCase(),
      c,
    ]),
  )

  const toInsert: ClubEntry[] = []
  const toUpdate: Array<{ id: string; entry: ClubEntry }> = []

  for (const c of clubs) {
    const found = existing.get(c.name.trim().toLowerCase())
    if (!found) {
      toInsert.push(c)
    } else if (found.badge_url !== c.badge_url || found.tier !== c.tier) {
      toUpdate.push({ id: found.id, entry: c })
    }
  }

  console.log(`  ${toInsert.length} to insert, ${toUpdate.length} to update, ` +
    `${clubs.length - toInsert.length - toUpdate.length} unchanged`)

  if (!confirm) {
    if (toInsert.length > 0) {
      console.log('\n  Would insert:')
      for (const c of toInsert.slice(0, 10)) {
        console.log(`    ${c.name.padEnd(26)} tier ${c.tier ?? '-'}`)
      }
      if (toInsert.length > 10) console.log(`    ... and ${toInsert.length - 10} more`)
    }
    console.log('\nDRY RUN — pass --confirm to write.')
    return
  }

  let inserted = 0
  let updated = 0

  if (toInsert.length > 0) {
    const rows = toInsert.map((c) => ({
      name: c.name,
      official_name: c.official_name,
      short_name: c.short_name,
      tier: c.tier,
      league: c.league,
      badge_url: c.badge_url,
      sportsdb_id: c.sportsdb_id,
    }))
    const { error } = await sb.from('clubs').insert(rows)
    if (error) {
      console.error(`  insert failed: ${error.message}`)
      process.exit(1)
    }
    inserted = rows.length
  }

  for (const { id, entry } of toUpdate) {
    const { error } = await sb
      .from('clubs')
      .update({
        official_name: entry.official_name,
        short_name: entry.short_name,
        tier: entry.tier,
        league: entry.league,
        badge_url: entry.badge_url,
        sportsdb_id: entry.sportsdb_id,
      })
      .eq('id', id)
    if (error) {
      console.error(`  update failed for ${entry.name}: ${error.message}`)
      continue
    }
    updated++
  }

  const { count } = await sb.from('clubs').select('*', { count: 'exact', head: true })
  console.log(`\n  inserted ${inserted}, updated ${updated}. public.clubs now holds ${count} clubs.`)
}

main().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
