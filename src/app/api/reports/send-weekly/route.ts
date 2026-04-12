/**
 * POST /api/reports/send-weekly
 *
 * Protected by Bearer CRON_SECRET. Accepts `{ gameweek_id }` JSON body.
 * Runs the three weekly senders in parallel (they touch disjoint ledger rows),
 * then marks gameweeks.reports_sent_at once done.
 *
 * Called by:
 *   - closeGameweek (fire-and-forget after successful DB close)
 *   - Admin "Resume report send" button (same contract)
 */
import { NextResponse } from 'next/server'

import {
  sendAdminWeekly,
  sendGroupReports,
  sendPersonalReports,
} from '@/lib/reports/orchestrate'
import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const gameweek_id = (body as { gameweek_id?: unknown })?.gameweek_id
  if (typeof gameweek_id !== 'string' || !gameweek_id) {
    return NextResponse.json(
      { error: 'gameweek_id (string) required' },
      { status: 400 },
    )
  }

  const [groupSummary, personalSummary, adminSummary] = await Promise.all([
    sendGroupReports(gameweek_id),
    sendPersonalReports(gameweek_id),
    sendAdminWeekly(gameweek_id),
  ])

  // Mark reports_sent_at once (admin sender already writes it on success;
  // this second update is a no-op when already set).
  const supabase = createAdminClient()
  await supabase
    .from('gameweeks')
    .update({ reports_sent_at: new Date().toISOString() })
    .eq('id', gameweek_id)
    .is('reports_sent_at', null)

  return NextResponse.json({
    group: groupSummary,
    personal: personalSummary,
    admin: adminSummary,
  })
}
