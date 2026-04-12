/**
 * GET /api/reports/full-export
 *
 * Admin-only full-season XLSX download. Session-scoped auth (not CRON_SECRET)
 * — this endpoint is user-triggered from the admin dashboard, so we check
 * `app_metadata.role === 'admin'` on the JWT.
 *
 * The XLSX buffer is returned directly as a Response (NOT base64-encoded in
 * a server action payload) to sidestep Next.js's 4.5MB action body limit.
 */
import { NextResponse } from 'next/server'

import {
  buildFullExportXlsx,
  gatherFullExportData,
} from '@/lib/reports/full-export-xlsx'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const data = await gatherFullExportData()
  const buf = buildFullExportXlsx(data)

  const filename = `georges-predictor-full-export-${new Date()
    .toISOString()
    .slice(0, 10)}.xlsx`

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
