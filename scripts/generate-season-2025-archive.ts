/**
 * READ-ONLY (writes only a repo source file, not the DB). Snapshots the FINAL
 * 2025/26 league table from live members.starting_points into a static TS file
 * at src/lib/history/season-2025-26.ts, so the "Previous Season" view keeps
 * showing it permanently after the new-season reset zeroes starting_points.
 *
 * Last season is over (seasons.ended_at set) so this table is immutable — a
 * static file is the simplest zero-cost home for it (no DB/DDL needed).
 *
 * Usage: npx tsx scripts/generate-season-2025-archive.ts
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
  const { data, error } = await sb
    .from('members')
    .select('display_name, starting_points, exclude_from_standings')
    .eq('exclude_from_standings', false)
    .order('starting_points', { ascending: false })
  if (error) throw error

  const rows = (data ?? []) as Array<{ display_name: string; starting_points: number | null }>
  // Standard-competition ranking with ties sharing a rank.
  let lastPts: number | null = null
  let lastRank = 0
  const table = rows.map((m, i) => {
    const pts = m.starting_points ?? 0
    const rank = pts === lastPts ? lastRank : i + 1
    lastPts = pts
    lastRank = rank
    return { rank, name: m.display_name, points: pts }
  })

  const champion = table[0]?.name ?? ''
  const runnerUp = table.find((t) => t.rank === 2)?.name ?? ''
  const third = table.find((t) => t.rank === 3)?.name ?? ''

  const fileBody = `/**
 * Final league table for the 2025/26 season — immutable historical record.
 *
 * Snapshotted from live members.starting_points on ${new Date().toISOString()}
 * (season ended 2026-07-01) BEFORE the 2026/27 reset zeroed those totals.
 * Regenerate with: npx tsx scripts/generate-season-2025-archive.ts
 * Placeholder / excluded accounts are omitted.
 */

export interface ArchivedStanding {
  rank: number
  name: string
  points: number
}

export const SEASON_2025_26 = {
  label: '2025/26',
  season: 2025,
  champion: ${JSON.stringify(champion)},
  runnerUp: ${JSON.stringify(runnerUp)},
  third: ${JSON.stringify(third)},
  table: ${JSON.stringify(table, null, 2)
    .split('\n')
    .map((l, i) => (i === 0 ? l : '  ' + l))
    .join('\n')} as ArchivedStanding[],
} as const
`

  const outDir = path.resolve(process.cwd(), 'src', 'lib', 'history')
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, 'season-2025-26.ts')
  fs.writeFileSync(outPath, fileBody, 'utf8')

  console.log(`Wrote ${outPath}`)
  console.log(`Champion: ${champion} (${table[0]?.points} pts)`)
  console.log(`Runner-up: ${runnerUp} · Third: ${third}`)
  console.log(`Table rows: ${table.length}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
