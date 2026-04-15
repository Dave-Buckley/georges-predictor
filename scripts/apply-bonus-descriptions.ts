/**
 * One-shot script to apply the bonus description corrections from
 * migration 015. Uses the service role key (bypasses RLS) to run the 8
 * UPDATEs. Idempotent — safe to re-run.
 *
 * Usage: npx tsx scripts/apply-bonus-descriptions.ts
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

const updates: Array<{ name: string; description: string }> = [
  {
    name: 'Brace Yourself',
    description:
      'Predict a player scores exactly 2 goals in your chosen match',
  },
  {
    name: 'Captain Fantastic',
    description:
      'Predict a captain to score, assist or be booked in your chosen match',
  },
  {
    name: 'Jose Park The Bus',
    description: 'Predict under 2.5 goals in your chosen match',
  },
  {
    name: 'Klopp Trumps',
    description:
      'Predict the home team to score, concede and receive 3+ yellows in your chosen match',
  },
  {
    name: 'London Derby',
    description: 'Predict both teams to score in your chosen match',
  },
  {
    name: 'Pep Talk',
    description:
      'Predict the team to win by over 2.5 goals in your chosen match',
  },
  {
    name: 'Roy Keane',
    description:
      'Predict the highest number of cards in your chosen match',
  },
  {
    name: 'Shane Long',
    description:
      'Predict the fastest goal to be scored in your chosen match',
  },
]

async function main() {
  let applied = 0
  for (const u of updates) {
    const { data, error } = await supabase
      .from('bonus_types')
      .update({ description: u.description })
      .eq('name', u.name)
      .select('id, name')
    if (error) {
      console.error(`  [fail] ${u.name}: ${error.message}`)
      continue
    }
    if (!data || data.length === 0) {
      console.warn(`  [skip] ${u.name}: no matching row`)
      continue
    }
    console.log(`  [ok]   ${u.name}`)
    applied++
  }
  console.log(`\nApplied ${applied}/${updates.length} updates.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
