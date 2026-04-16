/**
 * One-shot script to insert "Double Bubble" as a bonus_types row so George
 * can pick it from the admin bonus dropdown. Mirrors migration 016.
 * Idempotent — safe to re-run.
 *
 * Usage: npx tsx scripts/apply-double-bubble-bonus.ts
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

async function main() {
  const { data: existing } = await supabase
    .from('bonus_types')
    .select('id, name, description')
    .eq('name', 'Double Bubble')
    .maybeSingle()

  if (existing) {
    console.log(`  [skip] Double Bubble already exists (id=${existing.id})`)
    return
  }

  const { error } = await supabase.from('bonus_types').insert({
    name: 'Double Bubble',
    description: 'Your points are doubled for this gameweek',
    is_custom: false,
  })

  if (error) {
    console.error(`  [fail] ${error.message}`)
    process.exit(1)
  }
  console.log('  [ok]   Double Bubble bonus type inserted')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
