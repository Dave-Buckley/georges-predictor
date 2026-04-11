import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { syncFixtures } from '@/lib/fixtures/sync'

// Prevent Next.js from caching this route — must run fresh every time
export const dynamic = 'force-dynamic'

/**
 * Fixture sync endpoint — triggered by:
 *   1. Vercel cron (daily at 7 AM UTC) using Authorization: Bearer {CRON_SECRET}
 *   2. Admin "Sync Now" button using ?manual=true with a valid admin session
 *   3. First-sync-on-deploy: auto-triggers if sync_log is empty (no auth required)
 *
 * Security:
 *   - Cron calls must provide CRON_SECRET bearer token
 *   - Manual calls must come from an authenticated admin session
 *   - First sync runs automatically before auth checks (server-side only, no public trigger)
 */
export async function GET(request: NextRequest) {
  // ── First-sync-on-deploy ──────────────────────────────────────────────────
  // If sync_log is empty, this is a fresh deploy. Trigger sync immediately
  // before any auth checks so the first cron cycle isn't needed.
  try {
    const adminClient = createAdminClient()
    const { count } = await adminClient
      .from('sync_log')
      .select('*', { count: 'exact', head: true })

    if (count === 0) {
      console.log('[sync-fixtures] First-sync-on-deploy detected — running initial sync')
      const result = await syncFixtures()
      return NextResponse.json({ first_sync: true, ...result })
    }
  } catch (err) {
    // If the first-sync check fails (e.g., DB not yet available), fall through to normal auth
    console.warn('[sync-fixtures] First-sync check failed, continuing to normal auth:', err)
  }

  // ── Manual trigger (?manual=true) — requires admin session ───────────────
  const isManual = request.nextUrl.searchParams.get('manual') === 'true'

  if (isManual) {
    try {
      const supabase = await createServerSupabaseClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Verify the user is an admin
      const { data: member, error: memberError } = await supabase
        .from('members')
        .select('role')
        .eq('user_id', user.id)
        .single()

      // Check both app_metadata role (JWT) and members table role
      const isAdmin =
        (user.app_metadata?.role === 'admin') ||
        (!memberError && (member as { role?: string } | null)?.role === 'admin')

      if (!isAdmin) {
        return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error('[sync-fixtures] Manual auth check failed:', message)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else {
    // ── Cron trigger — requires CRON_SECRET bearer token ────────────────────
    const authHeader = request.headers.get('Authorization')
    const expectedSecret = process.env.CRON_SECRET

    if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // ── Run sync ──────────────────────────────────────────────────────────────
  try {
    const result = await syncFixtures()

    return NextResponse.json({
      ok: result.success,
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[sync-fixtures] Unexpected error:', message)
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    )
  }
}
