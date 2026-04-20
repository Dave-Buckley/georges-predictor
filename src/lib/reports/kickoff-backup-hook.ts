/**
 * Kickoff backup hook.
 *
 * Invariant: for every gameweek where the first fixture has kicked off
 * (status != 'SCHEDULED') AND `kickoff_backup_sent_at IS NULL`, send one
 * email to George + Dave with the full predictions snapshot as PDF + XLSX.
 *
 * Called from the tail of sync.ts so no new cron slot is needed (Vercel
 * Hobby 2-cron limit). Idempotent via the `kickoff_backup_sent_at`
 * sentinel — failures leave the flag NULL so the next sync retries.
 */
import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { gatherGameweekData } from './_data/gather-gameweek-data'
import { renderKickoffBackupPdf } from './kickoff-backup-pdf'
import { buildKickoffBackupXlsx } from './kickoff-backup-xlsx'
import { sendWithAttachments } from '@/lib/email/send-attachments'
import { render as renderEmail } from '@react-email/components'
import KickoffBackupEmail from '@/emails/kickoff-backup'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any

/**
 * Render PDF + XLSX, send one email to admin emails with BOTH attachments.
 * Throws on failure so the caller can decide how to record it (keeping the
 * flag NULL for retry vs. logging + continuing).
 */
export async function sendKickoffBackupEmail(gwId: string): Promise<void> {
  const data = await gatherGameweekData(gwId)

  const [pdf, xlsx] = await Promise.all([
    renderKickoffBackupPdf(data),
    Promise.resolve(buildKickoffBackupXlsx(data)),
  ])

  const admins = [process.env.ADMIN_EMAIL_GEORGE, process.env.ADMIN_EMAIL_DAVE].filter(
    (e): e is string => Boolean(e && e.length),
  )
  if (!admins.length) {
    throw new Error('No admin emails configured for kickoff backup (ADMIN_EMAIL_GEORGE/DAVE)')
  }

  const html = await renderEmail(
    KickoffBackupEmail({
      gwNumber: data.gwNumber,
      memberCount: data.standings.length,
      kickoffIso: data.fixtures[0]?.kickoffIso ?? '',
    }),
  )

  const { error } = await sendWithAttachments({
    to: admins,
    subject: `Backup — GW${data.gwNumber} all predictions as of kickoff`,
    html,
    attachments: [
      { filename: `kickoff-backup-gw${data.gwNumber}.pdf`, content: pdf },
      { filename: `kickoff-backup-gw${data.gwNumber}.xlsx`, content: xlsx },
    ],
  })
  if (error) throw new Error(error)
}

/**
 * Idempotent sync-pipeline hook. For each gameweek with a NULL flag AND a
 * non-SCHEDULED fixture, sends the backup and sets the flag. Failures insert
 * `kickoff_backup_failed` admin notifications and leave the flag NULL so the
 * next sync retries.
 *
 * Accepts an optional admin client so tests and callers inside sync.ts can
 * share a single instance.
 */
export async function maybeSendKickoffBackup(
  supabase: AdminClient = createAdminClient(),
): Promise<void> {
  // 1. Fetch all gameweeks where the backup is still pending.
  const { data: pendingGws } = await supabase
    .from('gameweeks')
    .select('id, number, kickoff_backup_sent_at')
    .is('kickoff_backup_sent_at', null)
    .order('number')

  const gws = (pendingGws ?? []) as Array<{
    id: string
    number: number
    kickoff_backup_sent_at: string | null
  }>

  if (!gws.length) return

  for (const gw of gws) {
    // 2. Has the first fixture kicked off?
    const { data: hasKickedOff } = await supabase
      .from('fixtures')
      .select('id')
      .eq('gameweek_id', gw.id)
      .neq('status', 'SCHEDULED')
      .limit(1)

    const hasKO = ((hasKickedOff ?? []) as Array<{ id: string }>).length > 0
    if (!hasKO) continue

    // 3. Send + set flag — failures keep the flag NULL for retry.
    try {
      await sendKickoffBackupEmail(gw.id)

      await supabase
        .from('gameweeks')
        .update({ kickoff_backup_sent_at: new Date().toISOString() })
        .eq('id', gw.id)
    } catch (err) {
      console.error('[kickoff-backup-hook]', gw.number, err)
      await supabase.from('admin_notifications').insert({
        type: 'kickoff_backup_failed',
        title: `Backup email for Gameweek ${gw.number} didn't send`,
        message: `The backup email with everyone's Gameweek ${gw.number} predictions couldn't be sent out. The app will try again at the next update, and Dave can also resend it manually.`,
      })
      // Flag stays NULL — next sync will retry this GW.
    }
  }
}
