/**
 * seed-admins.ts
 *
 * Creates or verifies George and Dave's admin accounts in Supabase.
 * Run via: npm run seed:admins
 *
 * Prerequisites:
 * - Copy .env.local.example to .env.local and fill in real values
 * - NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY must be set
 * - ADMIN_EMAIL_GEORGE and ADMIN_EMAIL_DAVE must be set
 *
 * What this script does:
 * - Creates auth users for George and Dave (if they don't exist)
 * - Sets app_metadata.role = 'admin' for both
 * - Creates a members row for George ONLY (he's both admin AND participant)
 * - Does NOT create a members row for Dave (admin only, not a participant)
 * - Is idempotent — safe to run multiple times
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// ─── Load environment variables from .env.local ────────────────────────────
// We use a manual parse instead of dotenv to avoid adding another dependency.
function loadEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) {
    console.warn('.env.local not found — using process.env directly')
    return
  }
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

loadEnvLocal()

// ─── Config ────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const GEORGE_EMAIL = process.env.ADMIN_EMAIL_GEORGE
const DAVE_EMAIL = process.env.ADMIN_EMAIL_DAVE

// Temporary passwords — admins MUST change these on first login
const TEMP_PASSWORD = 'ChangeMe123!@#'

// ─── Validation ────────────────────────────────────────────────────────────
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  process.exit(1)
}
if (!GEORGE_EMAIL || !DAVE_EMAIL) {
  console.error('ERROR: ADMIN_EMAIL_GEORGE and ADMIN_EMAIL_DAVE must be set')
  process.exit(1)
}

// ─── Admin client ──────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

interface AdminConfig {
  email: string
  name: string
  isParticipant: boolean // George = true, Dave = false
}

const admins: AdminConfig[] = [
  { email: GEORGE_EMAIL, name: 'George', isParticipant: true },
  { email: DAVE_EMAIL, name: 'Dave', isParticipant: false },
]

// ─── Main ──────────────────────────────────────────────────────────────────
async function seedAdmin(config: AdminConfig): Promise<void> {
  console.log(`\nProcessing ${config.name} (${config.email})...`)

  // Check if user already exists
  const { data: listData, error: listError } = await supabase.auth.admin.listUsers()
  if (listError) {
    throw new Error(`Failed to list users: ${listError.message}`)
  }

  const existingUser = listData.users.find((u) => u.email === config.email)

  let userId: string

  if (existingUser) {
    console.log(`  ✓ User already exists (id: ${existingUser.id})`)
    userId = existingUser.id
  } else {
    // Create the auth user
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email: config.email,
      password: TEMP_PASSWORD,
      email_confirm: true,
    })

    if (createError || !createData.user) {
      throw new Error(`Failed to create user: ${createError?.message ?? 'No user returned'}`)
    }

    userId = createData.user.id
    console.log(`  ✓ Created user (id: ${userId})`)
  }

  // Set admin role in app_metadata
  const { error: metaError } = await supabase.auth.admin.updateUserById(userId, {
    app_metadata: { role: 'admin' },
  })

  if (metaError) {
    throw new Error(`Failed to set admin role: ${metaError.message}`)
  }
  console.log(`  ✓ Set app_metadata.role = 'admin'`)

  // Create members row for George only (he's both admin and participant)
  if (config.isParticipant) {
    const { data: existingMember } = await supabase
      .from('members')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    if (existingMember) {
      console.log(`  ✓ Members row already exists — skipping`)
    } else {
      const { error: memberError } = await supabase.from('members').insert({
        user_id: userId,
        email: config.email,
        display_name: config.name,
        approval_status: 'approved',
        email_opt_in: true,
        starting_points: 0,
        approved_at: new Date().toISOString(),
        approved_by: userId,
      })

      if (memberError) {
        throw new Error(`Failed to create members row: ${memberError.message}`)
      }
      console.log(`  ✓ Created members row (approved participant)`)
    }
  } else {
    console.log(`  ✓ No members row needed (admin-only, not a participant)`)
  }
}

async function main(): Promise<void> {
  console.log('=== George\'s Predictor — Admin Seeder ===')
  console.log(`Supabase URL: ${SUPABASE_URL}`)

  for (const admin of admins) {
    await seedAdmin(admin)
  }

  console.log('\n=== Done! ===')
  console.log('\nIMPORTANT: Both admins were created with a temporary password.')
  console.log(`Temporary password: ${TEMP_PASSWORD}`)
  console.log('\nNext steps:')
  console.log('1. Log in to /admin/login with each admin email and the temp password')
  console.log('2. Change the password to something secure immediately')
  console.log('3. Set up security questions for account recovery')
  console.log('\nUser IDs are logged above — save them if needed for debugging.')
}

main().catch((err: unknown) => {
  console.error('\nSeeder failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
