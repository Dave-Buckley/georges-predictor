/**
 * One-shot script to apply migration 017 (prize list sync) against the live
 * DB. Mirrors the SQL exactly so we don't depend on a supabase migration push
 * being run. Idempotent — safe to re-run.
 *
 * Usage: npx tsx scripts/apply-prizes-final-list.ts
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'node:fs'
import * as path from 'node:path'

function loadEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  const contents = fs.readFileSync(envPath, 'utf8')
  for (const line of contents.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const k = trimmed.slice(0, eq).trim()
    let v = trimmed.slice(eq + 1).trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
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

const supabase = createClient(url, key, {
  auth: { persistSession: false },
})

type PrizeUpdate = {
  name: string
  description: string
  trigger_type?: 'auto' | 'date' | 'manual'
  trigger_config?: Record<string, unknown>
  cash_value: number
}

const updates: PrizeUpdate[] = [
  {
    name: '180',
    description: 'First member to score 180+ points in a week',
    trigger_type: 'auto',
    trigger_config: { threshold: 180, metric: 'weekly_points', award: 'first' },
    cash_value: 1000,
  },
  {
    name: 'Bonus King',
    description: 'First member to earn 3 consecutive bonuses',
    trigger_type: 'auto',
    trigger_config: { metric: 'consecutive_bonuses', count: 3, award: 'first' },
    cash_value: 1000,
  },
  {
    name: 'Centurion',
    description: 'First member to reach 1000 total points',
    trigger_type: 'auto',
    trigger_config: { threshold: 1000, metric: 'total_points', award: 'first' },
    cash_value: 1000,
  },
  {
    name: 'Christmas Present',
    description: 'League leader on Christmas Day',
    cash_value: 1000,
  },
  {
    name: 'Dry January',
    description: 'Lowest scoring player at the end of January',
    cash_value: 1000,
  },
  {
    name: 'Easter Egg',
    description: 'Overall losing player on Easter Sunday',
    trigger_config: { occasion: 'easter_sunday', snapshot: 'lowest' },
    cash_value: 1000,
  },
  {
    name: 'Fresh Start',
    description: 'Highest scoring player from the first gameweek',
    trigger_type: 'auto',
    trigger_config: { metric: 'gameweek_score', gameweek_number: 1, award: 'highest' },
    cash_value: 1000,
  },
  {
    name: 'Halloween Horror Show',
    description: 'Member in 31st place on Halloween',
    trigger_config: { month: 10, day: 31, snapshot: 'position', position: 31 },
    cash_value: 1000,
  },
  {
    name: 'Knockout',
    description: 'First member to lose 2 H2H steals',
    trigger_type: 'auto',
    trigger_config: { metric: 'h2h_steals_lost', count: 2, award: 'first' },
    cash_value: 1000,
  },
  {
    name: 'Smart One Standing',
    description: 'First member to reach final 10 in 3 separate LOS games',
    trigger_type: 'auto',
    trigger_config: { metric: 'los_final_ten_reaches', count: 3, award: 'first' },
    cash_value: 1000,
  },
  {
    name: 'Valentines Surprise',
    description: 'Members in 6th & 9th positions on Valentines Day',
    trigger_config: { month: 2, day: 14, snapshot: 'positions', positions: [6, 9] },
    cash_value: 1000,
  },
]

const inserts = [
  {
    name: 'Last One Standing',
    emoji: '🧍‍♂️',
    description: 'Final player standing for each LOS game',
    trigger_type: 'manual' as const,
    trigger_config: {
      note: 'Awarded to the winner of each completed Last One Standing competition',
      recurring: true,
    },
    points_value: 0,
    cash_value: 5000,
    is_custom: false,
  },
  {
    name: 'Jackpot 1st',
    emoji: '💰',
    description: 'Member with the highest score each week',
    trigger_type: 'auto' as const,
    trigger_config: { metric: 'weekly_rank', position: 1, recurring: true },
    points_value: 0,
    cash_value: 3000,
    is_custom: false,
  },
  {
    name: 'Jackpot 2nd',
    emoji: '💸',
    description: 'Member with the 2nd highest score each week',
    trigger_type: 'auto' as const,
    trigger_config: { metric: 'weekly_rank', position: 2, recurring: true },
    points_value: 0,
    cash_value: 1000,
    is_custom: false,
  },
]

async function main() {
  const { error: deleteError } = await supabase
    .from('additional_prizes')
    .delete()
    .in('name', ['Bore Draw', 'Fantastic 4'])

  if (deleteError) {
    console.error(`  [fail] delete: ${deleteError.message}`)
  } else {
    console.log('  [ok]   removed Bore Draw + Fantastic 4 (if present)')
  }

  let applied = 0
  for (const u of updates) {
    const patch: Record<string, unknown> = {
      description: u.description,
      cash_value: u.cash_value,
    }
    if (u.trigger_type) patch.trigger_type = u.trigger_type
    if (u.trigger_config) patch.trigger_config = u.trigger_config

    const { data, error } = await supabase
      .from('additional_prizes')
      .update(patch)
      .eq('name', u.name)
      .select('id, name')

    if (error) {
      console.error(`  [fail] update ${u.name}: ${error.message}`)
      continue
    }
    if (!data || data.length === 0) {
      console.warn(`  [skip] update ${u.name}: no matching row`)
      continue
    }
    console.log(`  [ok]   update ${u.name}`)
    applied++
  }

  let inserted = 0
  for (const row of inserts) {
    const { data: existing } = await supabase
      .from('additional_prizes')
      .select('id')
      .eq('name', row.name)
      .maybeSingle()

    if (existing) {
      console.log(`  [skip] ${row.name} already exists`)
      continue
    }

    const { error } = await supabase.from('additional_prizes').insert(row)
    if (error) {
      console.error(`  [fail] insert ${row.name}: ${error.message}`)
      continue
    }
    console.log(`  [ok]   insert ${row.name}`)
    inserted++
  }

  console.log(`\nUpdated ${applied}/${updates.length} existing prizes; inserted ${inserted}/${inserts.length} new.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
