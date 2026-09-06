/**
 * Builds scripts/_data/clubs.json — the club list used to seed the `clubs`
 * table (see scripts/seed-clubs.ts and migration 029).
 *
 * Why a checked-in JSON file rather than fetching at seed time:
 *   TheSportsDB's free tier rate-limits hard (HTTP 429 / Cloudflare 1015 after
 *   roughly 30 requests). Seeding straight from the API would fail randomly
 *   part-way through. Instead we build the list once, review it, commit it, and
 *   seed from the file. No runtime dependency on TheSportsDB at all — only the
 *   badge images are hotlinked, the same arrangement as
 *   crests.football-data.org already in next.config.ts.
 *
 * RESUMABLE. Re-run until it reports 0 remaining; each run tops up clubs.json
 * with whatever it managed to fetch and leaves the rest for next time. Safe to
 * interrupt — it saves after every successful lookup.
 *
 *   npx tsx scripts/fetch-club-badges.ts
 *   npx tsx scripts/fetch-club-badges.ts --delay 3000
 *
 * Tier comes from TheSportsDB's own strLeague rather than being asserted here,
 * so promotions and relegations do not need hand-maintaining. Clubs it cannot
 * resolve are stored with badge_url null — they still appear in the picker,
 * rendered as coloured initials by the existing TeamBadge fallback.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

const CLUB_NAMES: string[] = [
  'Arsenal', 'Aston Villa', 'Bournemouth', 'Brentford',
  'Brighton & Hove Albion', 'Burnley',
  'Chelsea', 'Crystal Palace', 'Everton', 'Fulham', 'Ipswich Town',
  'Leeds United', 'Leicester City', 'Liverpool', 'Luton Town',
  'Manchester City', 'Manchester United', 'Newcastle United',
  'Nottingham Forest',
  'Sheffield United', 'Southampton', 'Sunderland', 'Tottenham Hotspur',
  'Watford',
  'West Bromwich Albion', 'West Ham United', 'Wolverhampton Wanderers',
  'Norwich City', 'Middlesbrough', 'Coventry City', 'Hull City',
  'Bristol City', 'Cardiff City', 'Swansea City', 'Preston North End',
  'Stoke City', 'Millwall', 'Blackburn Rovers', 'Queens Park Rangers',
  'Plymouth Argyle', 'Derby County', 'Portsmouth', 'Oxford United',
  'Birmingham City', 'Wrexham', 'Charlton Athletic', 'Huddersfield Town',
  'Barnsley', 'Bolton Wanderers', 'Wigan Athletic', 'Blackpool', 'Reading',
  'Peterborough United', 'Stockport County', 'Wycombe Wanderers',
  'Lincoln City', 'Mansfield Town', 'Rotherham United', 'Leyton Orient',
  'Exeter City', 'Northampton Town', 'Burton Albion', 'Crawley Town',
  'Bristol Rovers', 'Cambridge United', 'Shrewsbury Town',
  'Sheffield Wednesday', 'Stevenage', 'Walsall', 'Notts County',
  'Bradford City', 'Chesterfield', 'Gillingham', 'Colchester United',
  'Swindon Town', 'Crewe Alexandra', 'Milton Keynes Dons', 'Salford City',
  'Doncaster Rovers', 'Port Vale', 'Accrington Stanley', 'Harrogate Town',
  'Barrow', 'Newport County', 'Tranmere Rovers', 'Grimsby Town',
  'Fleetwood Town', 'Cheltenham Town', 'Carlisle United', 'Morecambe',
  'AFC Wimbledon', 'Bromley', 'Sutton United', 'Oldham Athletic',
  'Yeovil Town', 'Forest Green Rovers', 'Hartlepool United',
  'Southend United', 'Scunthorpe United',
]

const TIER_BY_LEAGUE: Record<string, number> = {
  'English Premier League': 1,
  'English League Championship': 2,
  'English League 1': 3,
  'English League 2': 4,
}

/**
 * Hand-set badges for clubs TheSportsDB's search cannot resolve to the right
 * SPORT. These win over anything the API returns.
 *
 * Nottingham Forest: searching "Nottingham Forest" returns only the netball
 * club of the same name (UK Netball Superleague). The soccer club is not in
 * the search results at all, so there is nothing correct to pick. The lookup
 * already refuses non-soccer results, which left Forest with no badge — this
 * fills it from crests.football-data.org, the same source as the crests in our
 * own `teams` table, and a host next.config.ts already allows.
 *
 * Brighton / Newcastle / Tottenham: the first build of this list searched the
 * short names "Brighton", "Newcastle" and "Tottenham". TheSportsDB resolved
 * them to Brighton WFC, Newcastle Jets (Australian A-League) and Tottenham
 * Women respectively — all real soccer clubs, so the lookup accepted them, but
 * none in TIER_BY_LEAGUE. That left the three of them at tier null, which
 * dropped them out of the picker's "Premier League" group and into "Other" at
 * the very bottom, wearing the wrong crest. Members reported not being able to
 * find Newcastle or Spurs at all. CLUB_NAMES now carries the full club names,
 * and these overrides pin the right crest and tier regardless of what the
 * search returns. Repaired in the DB by scripts/fix-club-picker-teams.ts.
 */
const BADGE_OVERRIDES: Record<string, { badge_url: string; league: string; tier: number }> = {
  'Nottingham Forest': {
    badge_url: 'https://crests.football-data.org/351.png',
    league: 'English Premier League',
    tier: 1,
  },
  'Brighton & Hove Albion': {
    badge_url: 'https://crests.football-data.org/397.png',
    league: 'English Premier League',
    tier: 1,
  },
  'Newcastle United': {
    badge_url: 'https://crests.football-data.org/67.png',
    league: 'English Premier League',
    tier: 1,
  },
  'Tottenham Hotspur': {
    badge_url: 'https://crests.football-data.org/73.png',
    league: 'English Premier League',
    tier: 1,
  },
}

export interface ClubEntry {
  name: string
  official_name: string | null
  short_name: string | null
  league: string | null
  tier: number | null
  badge_url: string | null
  sportsdb_id: string | null
}

interface SportsDbTeam {
  strTeam?: string
  strTeamShort?: string
  strLeague?: string
  strSport?: string
  strBadge?: string
  idTeam?: string
}

const OUT_PATH = path.resolve(process.cwd(), 'scripts', '_data', 'clubs.json')

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

function load(): Map<string, ClubEntry> {
  if (!fs.existsSync(OUT_PATH)) return new Map()
  try {
    const parsed = JSON.parse(fs.readFileSync(OUT_PATH, 'utf8')) as {
      clubs?: ClubEntry[]
    }
    return new Map((parsed.clubs ?? []).map((c) => [c.name, c]))
  } catch {
    return new Map()
  }
}

function save(map: Map<string, ClubEntry>): void {
  const clubs = [...map.values()].sort(
    (a, b) => (a.tier ?? 9) - (b.tier ?? 9) || a.name.localeCompare(b.name),
  )
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
  fs.writeFileSync(
    OUT_PATH,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        source: 'thesportsdb.com free API (searchteams.php)',
        count: clubs.length,
        with_badge: clubs.filter((c) => c.badge_url).length,
        clubs,
      },
      null,
      2,
    ),
    'utf8',
  )
}

async function main(): Promise<void> {
  const delayFlag = process.argv.indexOf('--delay')
  const delay =
    delayFlag !== -1 ? Number(process.argv[delayFlag + 1]) : 2500

  const have = load()

  // Apply hand-set badges first so they win over the API and are never chased
  // again on a re-run.
  for (const [name, override] of Object.entries(BADGE_OVERRIDES)) {
    const current = have.get(name)
    have.set(name, {
      name,
      official_name: current?.official_name ?? name,
      short_name: current?.short_name ?? null,
      league: override.league,
      tier: override.tier,
      badge_url: override.badge_url,
      sportsdb_id: current?.sportsdb_id ?? null,
    })
    console.log(`  fixed ${name.padEnd(26)} override badge applied`)
  }
  save(have)

  // Retry anything we have not resolved WITH a badge — a previous run may have
  // stored a miss caused by rate limiting rather than a genuinely absent club.
  const todo = CLUB_NAMES.filter((n) => !have.get(n)?.badge_url)

  console.log(
    `${have.size} already stored, ${todo.length} to fetch, ${delay}ms apart\n`,
  )
  if (todo.length === 0) {
    console.log('Nothing to do — clubs.json is complete.')
    return
  }

  let fetched = 0
  let consecutiveBlocks = 0

  for (const name of todo) {
    try {
      const res = await fetch(
        `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(name)}`,
      )

      if (res.status === 429) {
        consecutiveBlocks++
        console.log(`  429   ${name} — rate limited, backing off 30s`)
        await sleep(30_000)
        if (consecutiveBlocks >= 5) {
          console.log(
            '\nStill rate limited after 5 backoffs. Stopping — re-run later to resume.',
          )
          break
        }
        continue
      }
      consecutiveBlocks = 0

      const body = (await res.json().catch(() => null)) as {
        teams?: SportsDbTeam[]
      } | null
      const teams = (body?.teams ?? []).filter((t) => t.strSport === 'Soccer')
      const match =
        teams.find((t) => TIER_BY_LEAGUE[t.strLeague ?? ''] !== undefined) ??
        teams.find((t) => /^English/.test(t.strLeague ?? '')) ??
        teams[0]

      if (!match) {
        have.set(name, {
          name,
          official_name: null,
          short_name: null,
          league: null,
          tier: null,
          badge_url: null,
          sportsdb_id: null,
        })
        console.log(`  miss  ${name} — will render as initials`)
      } else {
        have.set(name, {
          name,
          official_name: match.strTeam ?? null,
          short_name: match.strTeamShort ?? null,
          league: match.strLeague ?? null,
          tier: TIER_BY_LEAGUE[match.strLeague ?? ''] ?? null,
          badge_url: match.strBadge ?? null,
          sportsdb_id: match.idTeam ?? null,
        })
        fetched++
        console.log(
          `  ok    ${name.padEnd(26)} ${(match.strLeague ?? '?').padEnd(28)} ${match.strBadge ? 'badge' : 'no badge'}`,
        )
      }

      // Save after every hit so an interrupt loses at most one club.
      save(have)
    } catch (err) {
      console.log(
        `  err   ${name}: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
    await sleep(delay)
  }

  save(have)
  const remaining = CLUB_NAMES.filter((n) => !have.get(n)?.badge_url).length
  console.log(
    `\n${fetched} fetched this run. ${have.size} stored, ${remaining} still missing a badge.`,
  )
  if (remaining > 0) console.log('Re-run to resume.')
}

main().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
