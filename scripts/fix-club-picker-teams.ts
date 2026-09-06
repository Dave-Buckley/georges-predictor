/**
 * One-shot repair for three clubs the favourite-club picker resolved wrongly.
 *
 * scripts/fetch-club-badges.ts originally searched TheSportsDB for the short
 * names "Brighton", "Newcastle" and "Tottenham". All three returned a real
 * soccer club, so the lookup accepted them — just the wrong one:
 *
 *   Brighton   -> Brighton WFC     (English Womens Super League)
 *   Newcastle  -> Newcastle Jets   (Australian A-League)
 *   Tottenham  -> Tottenham Women  (English Womens Super League)
 *
 * None of those leagues are in TIER_BY_LEAGUE, so all three landed at tier
 * NULL. The picker groups by tier, which pushed them out of the "Premier
 * League" optgroup and down into "Other" at the very bottom of a ~100-entry
 * list, wearing the wrong crest. Members reported simply not being able to
 * find Newcastle or Spurs.
 *
 * This UPDATEs the three existing rows in place rather than inserting new
 * ones, so members.favourite_club_id keeps pointing at a valid club and
 * anyone who did pick one gets the right badge instead of a broken link. It
 * never deletes and never touches any other club.
 *
 * Idempotent — safe to re-run. The source data is already corrected in
 * scripts/_data/clubs.json and scripts/fetch-club-badges.ts, so a future
 * re-seed agrees with what this writes.
 *
 * Usage:
 *   npx tsx scripts/fix-club-picker-teams.ts             # dry run
 *   npx tsx scripts/fix-club-picker-teams.ts --confirm   # write
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

/**
 * Crests come from crests.football-data.org rather than TheSportsDB — the same
 * source as teams.crest_url, already allowed by next.config.ts, and the same
 * treatment Nottingham Forest already gets in fetch-club-badges.ts.
 */
const REPAIRS = [
  {
    /** The wrong name currently in the DB, matched case-insensitively. */
    currentName: 'Brighton',
    name: 'Brighton & Hove Albion',
    official_name: 'Brighton & Hove Albion',
    short_name: 'BHA',
    badge_url: 'https://crests.football-data.org/397.png',
  },
  {
    currentName: 'Newcastle',
    name: 'Newcastle United',
    official_name: 'Newcastle United',
    short_name: 'NEW',
    badge_url: 'https://crests.football-data.org/67.png',
  },
  {
    currentName: 'Tottenham',
    name: 'Tottenham Hotspur',
    official_name: 'Tottenham Hotspur',
    short_name: 'TOT',
    badge_url: 'https://crests.football-data.org/73.png',
  },
] as const

interface ClubRow {
  id: string
  name: string
  official_name: string | null
  short_name: string | null
  tier: number | null
  league: string | null
  badge_url: string | null
}

async function main(): Promise<void> {
  const confirm = process.argv.includes('--confirm')
  console.log(`=== Fix favourite-club picker teams — ${confirm ? 'APPLY' : 'DRY RUN'} ===\n`)

  const { data: clubsRaw, error: clubsErr } = await sb
    .from('clubs')
    .select('id, name, official_name, short_name, tier, league, badge_url')
  if (clubsErr) {
    console.error(`  clubs read failed: ${clubsErr.message}`)
    process.exit(1)
  }
  const clubs = (clubsRaw ?? []) as ClubRow[]
  const byName = new Map(clubs.map((c) => [c.name.trim().toLowerCase(), c]))

  // Which members would be affected. Nobody is expected to be — the whole
  // point of the bug is that these three were unfindable — but a rename must
  // never silently move somebody's pick, so report it either way.
  const { data: membersRaw } = await sb
    .from('members')
    .select('id, display_name, favourite_club_id')
    .not('favourite_club_id', 'is', null)
  const members = (membersRaw ?? []) as Array<{
    id: string
    display_name: string
    favourite_club_id: string
  }>

  let changed = 0
  let alreadyOk = 0

  for (const r of REPAIRS) {
    const done = byName.get(r.name.trim().toLowerCase())
    const wrong = byName.get(r.currentName.trim().toLowerCase())

    if (done && !wrong) {
      console.log(`  [ok]   ${r.name} already correct (tier ${done.tier})`)
      alreadyOk++
      continue
    }

    if (done && wrong && done.id !== wrong.id) {
      // A correct row was inserted alongside the broken one at some point.
      // Renaming would collide with clubs_name_ci_idx, so leave both and say so.
      console.error(
        `  [skip] both "${r.currentName}" (${wrong.id}) and "${r.name}" (${done.id}) exist. ` +
          'Merge them by hand — renaming would violate the unique name index.',
      )
      continue
    }

    if (!wrong) {
      console.error(`  [skip] no club named "${r.currentName}" found — nothing to repair`)
      continue
    }

    const holders = members.filter((m) => m.favourite_club_id === wrong.id)
    console.log(
      `  [fix]  "${wrong.name}" (${wrong.official_name ?? '?'}, ` +
        `${wrong.league ?? 'no league'}, tier ${wrong.tier ?? 'null'})\n` +
        `           -> "${r.name}" (English Premier League, tier 1)\n` +
        `           badge ${wrong.badge_url ?? 'none'}\n` +
        `              -> ${r.badge_url}\n` +
        `           members with this club set: ${holders.length}` +
        (holders.length > 0 ? ` (${holders.map((m) => m.display_name).join(', ')})` : ''),
    )

    if (!confirm) {
      changed++
      continue
    }

    const { error } = await sb
      .from('clubs')
      .update({
        name: r.name,
        official_name: r.official_name,
        short_name: r.short_name,
        tier: 1,
        league: 'English Premier League',
        // The old sportsdb_id pointed at a different club entirely; clearing
        // it stops a future re-fetch from trusting it.
        sportsdb_id: null,
        badge_url: r.badge_url,
      })
      .eq('id', wrong.id)

    if (error) {
      console.error(`  [fail] ${r.name}: ${error.message}`)
      continue
    }
    changed++
  }

  if (!confirm) {
    console.log(`\n  ${changed} row(s) would change, ${alreadyOk} already correct.`)
    console.log('\nDRY RUN — re-run with --confirm to write.')
    return
  }

  const { data: after } = await sb
    .from('clubs')
    .select('name')
    .eq('tier', 1)
    .order('name')
  console.log(
    `\n  Updated ${changed} row(s). The picker's Premier League group now holds ` +
      `${(after ?? []).length} clubs:\n    ` +
      (after ?? []).map((c: { name: string }) => c.name).join('\n    '),
  )
}

main().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
