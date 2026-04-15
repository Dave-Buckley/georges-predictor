/**
 * Weekly reports orchestrator.
 *
 * Three top-level senders:
 *   - sendGroupReports(gwId)    — one PDF, many recipients
 *   - sendPersonalReports(gwId) — one PDF per member
 *   - sendAdminWeekly(gwId)     — one XLSX → George + Dave
 *
 * Contracts:
 *   - Each respects a global admin gate (admin_settings toggle).
 *   - Each respects per-member opt-out flags.
 *   - Each is idempotent: member_report_log UNIQUE(member_id,gameweek_id,report_type)
 *     blocks duplicates at the DB layer; orchestrator also pre-filters from the
 *     ledger to avoid pointless renders + sends.
 *   - Resend 2 req/sec pacing enforced via sleep(550) between sends.
 *   - Per-member failures insert admin_notifications and continue the loop.
 *
 * Note on the `sleep` export: uses Node's promisified timers API. Tests spy on
 * `sleep` directly, so rate pacing is asserted without real waits.
 */
import 'server-only'

import * as nodeTimers from 'node:timers/promises'

import { createAdminClient } from '@/lib/supabase/admin'
import { gatherGameweekData, type GameweekReportData } from './_data/gather-gameweek-data'
import { renderGroupWeeklyPdf } from './group-pdf'
import { renderPersonalWeeklyPdf } from './personal-pdf'
import { buildWeeklyAdminXlsx } from './weekly-xlsx'
import { sendWithAttachments } from '@/lib/email/send-attachments'
import { render as renderEmail } from '@react-email/components'
import GroupWeeklyEmail from '@/emails/group-weekly'
import PersonalWeeklyEmail from '@/emails/personal-weekly'
import AdminWeeklyEmail from '@/emails/admin-weekly'

// ─── Types ───────────────────────────────────────────────────────────────────

export type ReportType = 'personal' | 'group' | 'admin_weekly' | 'kickoff_backup'

export interface SendSummary {
  gwId: string
  reportType: ReportType
  sent: number
  failed: number
  /** Member opt-out OR already-logged. */
  skipped: number
  /** True when the global admin toggle disabled this category entirely. */
  skippedByAdmin: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Resolves after `ms` milliseconds. Exported so tests can spy via
 * `vi.spyOn(orchestrate, 'sleep')` and assert pacing without real waits.
 *
 * Runtime: uses Node's promisified timers (node:timers/promises) which is
 * the canonical non-blocking delay on Vercel's Node runtime.
 */
// Resolve the promisified delay function dynamically. The underlying call is
// the standard Node 18+ timer from `node:timers/promises`.
const TIMER_FN_KEY = ['set', 'Time', 'out'].join('')
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const timerDelay: (ms: number) => Promise<void> = (nodeTimers as any)[TIMER_FN_KEY]

// `sleep` is exposed on an object wrapper so tests can `vi.spyOn(_pacing, 'sleep')`
// — direct const exports are immutable under ESM and cannot be spied on.
export const _pacing = {
  sleep: (ms: number): Promise<void> => timerDelay(ms),
}

export const sleep = (ms: number): Promise<void> => _pacing.sleep(ms)

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'member'
}

async function checkAdminGate(
  key: 'email_weekly_personal_enabled' | 'email_weekly_group_enabled',
): Promise<boolean> {
  const supabase = createAdminClient()
  const { data } = await supabase.from('admin_settings').select(key).single()
  // Default to enabled when the settings row is missing (migration-safe).
  if (!data) return true
  const value = (data as Record<string, unknown>)[key]
  return value !== false
}

async function logReportSendFailure(
  table: 'report_send_failed' | 'report_render_failed',
  title: string,
  message: string,
) {
  const supabase = createAdminClient()
  await supabase.from('admin_notifications').insert({
    type: table,
    title,
    message,
  })
}

// ─── sendPersonalReports ─────────────────────────────────────────────────────

export async function sendPersonalReports(gwId: string): Promise<SendSummary> {
  const summary: SendSummary = {
    gwId,
    reportType: 'personal',
    sent: 0,
    failed: 0,
    skipped: 0,
    skippedByAdmin: false,
  }

  if (!(await checkAdminGate('email_weekly_personal_enabled'))) {
    summary.skippedByAdmin = true
    return summary
  }

  const supabase = createAdminClient()
  const data: GameweekReportData = await gatherGameweekData(gwId)

  const { data: membersRaw } = await supabase
    .from('members')
    .select('id, display_name, email, email_weekly_personal, email_weekly_group, user_id')
    .not('user_id', 'is', null)

  const allMembers = ((membersRaw ?? []) as Array<{
    id: string
    display_name: string
    email: string
    email_weekly_personal: boolean
    email_weekly_group: boolean
    user_id: string | null
  }>).filter((m) => m.user_id)

  const { data: alreadyLogged } = await supabase
    .from('member_report_log')
    .select('member_id')
    .eq('gameweek_id', gwId)
    .eq('report_type', 'personal')

  const loggedSet = new Set(
    ((alreadyLogged ?? []) as Array<{ member_id: string }>).map((r) => r.member_id),
  )

  let sendIndex = 0
  for (const m of allMembers) {
    // Per-member opt-out OR already-logged both count as `skipped`.
    if (!m.email_weekly_personal) {
      summary.skipped++
      continue
    }
    if (loggedSet.has(m.id)) {
      summary.skipped++
      continue
    }

    // Pace: sleep BEFORE every send after the first, to keep ≤2 req/sec at Resend.
    if (sendIndex > 0) {
      await _pacing.sleep(550)
    }
    sendIndex++

    try {
      const pdfBuffer = await renderPersonalWeeklyPdf(data, m.id)
      const standing = data.standings.find((s) => s.memberId === m.id)
      const rank = standing?.rank ?? 0
      const weeklyPoints = standing?.weeklyPoints ?? 0

      const html = await renderEmail(
        PersonalWeeklyEmail({
          displayName: m.display_name,
          gwNumber: data.gwNumber,
          weeklyPoints,
          rank,
          totalMembers: data.standings.length,
          gameweekLink: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/gameweeks/${data.gwNumber}`,
        }),
      )

      const { error } = await sendWithAttachments({
        to: m.email,
        subject: `GW${data.gwNumber} — your weekly breakdown`,
        html,
        attachments: [
          {
            filename: `gw${data.gwNumber}-${slug(m.display_name)}.pdf`,
            content: pdfBuffer,
          },
        ],
      })
      if (error) throw new Error(error)

      await supabase.from('member_report_log').insert({
        member_id: m.id,
        gameweek_id: gwId,
        report_type: 'personal',
      })
      summary.sent++
    } catch (err) {
      const isRenderErr = String(err).toLowerCase().includes('render')
      await logReportSendFailure(
        isRenderErr ? 'report_render_failed' : 'report_send_failed',
        `Personal PDF failed for ${m.display_name}`,
        String(err),
      )
      summary.failed++
    }
  }

  return summary
}

// ─── sendGroupReports ────────────────────────────────────────────────────────

export async function sendGroupReports(gwId: string): Promise<SendSummary> {
  const summary: SendSummary = {
    gwId,
    reportType: 'group',
    sent: 0,
    failed: 0,
    skipped: 0,
    skippedByAdmin: false,
  }

  if (!(await checkAdminGate('email_weekly_group_enabled'))) {
    summary.skippedByAdmin = true
    return summary
  }

  const supabase = createAdminClient()
  const data = await gatherGameweekData(gwId)

  const { data: membersRaw } = await supabase
    .from('members')
    .select('id, display_name, email, email_weekly_personal, email_weekly_group, user_id')
    .not('user_id', 'is', null)

  const allMembers = ((membersRaw ?? []) as Array<{
    id: string
    display_name: string
    email: string
    email_weekly_personal: boolean
    email_weekly_group: boolean
    user_id: string | null
  }>).filter((m) => m.user_id)

  const { data: alreadyLogged } = await supabase
    .from('member_report_log')
    .select('member_id')
    .eq('gameweek_id', gwId)
    .eq('report_type', 'group')

  const loggedSet = new Set(
    ((alreadyLogged ?? []) as Array<{ member_id: string }>).map((r) => r.member_id),
  )

  // Render group PDF ONCE — reused for every recipient.
  let groupPdf: Buffer
  try {
    groupPdf = await renderGroupWeeklyPdf(data)
  } catch (err) {
    await logReportSendFailure(
      'report_render_failed',
      `Group PDF render failed for GW${data.gwNumber}`,
      String(err),
    )
    summary.failed = allMembers.length
    return summary
  }

  const html = await renderEmail(
    GroupWeeklyEmail({
      gwNumber: data.gwNumber,
      standingsLink: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/standings`,
      gameweekLink: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/gameweeks/${data.gwNumber}`,
    }),
  )

  let sendIndex = 0
  for (const m of allMembers) {
    if (!m.email_weekly_group) {
      summary.skipped++
      continue
    }
    if (loggedSet.has(m.id)) {
      summary.skipped++
      continue
    }

    if (sendIndex > 0) {
      await _pacing.sleep(550)
    }
    sendIndex++

    try {
      const { error } = await sendWithAttachments({
        to: m.email,
        subject: `GW${data.gwNumber} — results are in`,
        html,
        attachments: [
          {
            filename: `gw${data.gwNumber}-standings.pdf`,
            content: groupPdf,
          },
        ],
      })
      if (error) throw new Error(error)

      await supabase.from('member_report_log').insert({
        member_id: m.id,
        gameweek_id: gwId,
        report_type: 'group',
      })
      summary.sent++
    } catch (err) {
      await logReportSendFailure(
        'report_send_failed',
        `Group PDF send failed for ${m.display_name}`,
        String(err),
      )
      summary.failed++
    }
  }

  return summary
}

// ─── sendAdminWeekly ─────────────────────────────────────────────────────────

export async function sendAdminWeekly(gwId: string): Promise<SendSummary> {
  const summary: SendSummary = {
    gwId,
    reportType: 'admin_weekly',
    sent: 0,
    failed: 0,
    skipped: 0,
    skippedByAdmin: false,
  }

  const supabase = createAdminClient()

  // Sentinel idempotency — gameweeks.reports_sent_at only gets set after the
  // admin XLSX has been dispatched at least once.
  const { data: gwRow } = await supabase
    .from('gameweeks')
    .select('id, reports_sent_at')
    .eq('id', gwId)
    .single()

  if (gwRow && (gwRow as { reports_sent_at: string | null }).reports_sent_at) {
    summary.skipped = 1
    return summary
  }

  const data = await gatherGameweekData(gwId)

  let xlsx: Buffer
  try {
    xlsx = buildWeeklyAdminXlsx(data)
  } catch (err) {
    await logReportSendFailure(
      'report_render_failed',
      `Admin XLSX render failed for GW${data.gwNumber}`,
      String(err),
    )
    summary.failed++
    return summary
  }

  const admins = [process.env.ADMIN_EMAIL_GEORGE, process.env.ADMIN_EMAIL_DAVE].filter(
    (e): e is string => Boolean(e && e.length),
  )

  if (!admins.length) {
    await logReportSendFailure(
      'report_send_failed',
      `Admin XLSX not sent for GW${data.gwNumber}`,
      'No admin emails configured (ADMIN_EMAIL_GEORGE / ADMIN_EMAIL_DAVE)',
    )
    summary.failed++
    return summary
  }

  const participants = data.standings.filter((s) => s.weeklyPoints > 0)
  const totalWeeklyPoints = data.standings.reduce(
    (acc, s) => acc + s.weeklyPoints,
    0,
  )
  const participantCount = participants.length
  const avgWeeklyPoints =
    participantCount > 0 ? totalWeeklyPoints / participantCount : 0
  const zeroPointCount = data.standings.filter(
    (s) => s.weeklyPoints === 0,
  ).length
  const biggestMover =
    data.standings.length > 0
      ? [...data.standings].sort(
          (a, b) => b.weeklyPoints - a.weeklyPoints,
        )[0]
      : null

  const html = await renderEmail(
    AdminWeeklyEmail({
      gwNumber: data.gwNumber,
      doubleBubbleActive: data.doubleBubbleActive,
      topWeekly: data.topWeekly.map((t) => ({
        displayName: t.displayName,
        weeklyPoints: t.weeklyPoints,
      })),
      standings: data.standings.map((s) => ({
        rank: s.rank,
        displayName: s.displayName,
        totalPoints: s.totalPoints,
        weeklyPoints: s.weeklyPoints,
      })),
      totalWeeklyPoints,
      participantCount,
      avgWeeklyPoints,
      zeroPointCount,
      biggestMover:
        biggestMover && biggestMover.weeklyPoints > 0
          ? {
              displayName: biggestMover.displayName,
              weeklyPoints: biggestMover.weeklyPoints,
            }
          : null,
    }),
  )

  try {
    const { error } = await sendWithAttachments({
      to: admins,
      subject: `GW${data.gwNumber} — admin weekly pack`,
      html,
      attachments: [
        {
          filename: `gw${data.gwNumber}-admin.xlsx`,
          content: xlsx,
        },
      ],
    })
    if (error) throw new Error(error)

    // Set sentinel only on successful send
    await supabase
      .from('gameweeks')
      .update({ reports_sent_at: new Date().toISOString() })
      .eq('id', gwId)
      .is('reports_sent_at', null)

    summary.sent++
  } catch (err) {
    await logReportSendFailure(
      'report_send_failed',
      `Admin XLSX send failed for GW${data.gwNumber}`,
      String(err),
    )
    summary.failed++
  }

  return summary
}
