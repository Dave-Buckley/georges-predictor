import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Prevent Next.js from caching this route — must run fresh every time
export const dynamic = 'force-dynamic'

/**
 * Keep-alive endpoint to prevent Supabase free-tier database from pausing.
 * Called daily by the Vercel cron job configured in vercel.json.
 *
 * Security: Requires Authorization: Bearer {CRON_SECRET} header.
 * Returns 401 if secret doesn't match — prevents abuse from public access.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  const expectedSecret = process.env.CRON_SECRET

  // Verify CRON_SECRET — reject unauthenticated requests
  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const supabase = createAdminClient()

    // Lightweight DB ping — just reads one row to keep the connection alive
    const { error } = await supabase.from('members').select('id').limit(1)

    if (error) {
      console.error('[keep-alive] Database ping failed:', error.message)
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[keep-alive] Unexpected error:', message)
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    )
  }
}
