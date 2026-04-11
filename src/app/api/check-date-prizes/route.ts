import { NextResponse, type NextRequest } from 'next/server'
import { checkDatePrizes } from '@/actions/admin/prizes'

// Prevent Next.js from caching this route
export const dynamic = 'force-dynamic'

/**
 * Date-based prize check endpoint.
 *
 * Triggered by:
 *   - Vercel cron (daily at midnight UTC) using Authorization: Bearer {CRON_SECRET}
 *   - Manual admin trigger with ?manual=true (TODO: add admin session auth if needed)
 *
 * NOTE: Vercel Hobby plan supports 2 cron jobs max. If the cron slots are full,
 * this route should be called from within the existing /api/sync-fixtures cron
 * instead of registering a separate cron entry.
 *
 * Checks all additional_prizes where trigger_type='date' against today's date
 * (Europe/London timezone). Creates prize_awards rows for any matches,
 * skipping prizes that have already been triggered today.
 */
export async function GET(request: NextRequest) {
  // ── Auth: CRON_SECRET bearer token ────────────────────────────────────────
  const authHeader = request.headers.get('Authorization')
  const expectedSecret = process.env.CRON_SECRET

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Run date prize check ──────────────────────────────────────────────────
  try {
    const result = await checkDatePrizes()

    return NextResponse.json({
      ok: true,
      triggered: result.triggered,
      count: result.triggered.length,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[check-date-prizes] Unexpected error:', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
