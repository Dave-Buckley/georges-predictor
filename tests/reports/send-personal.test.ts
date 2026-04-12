/**
 * Focused tests for sendPersonalReports attachment payload + idempotency.
 *
 * Complements orchestrate.test.ts with narrower surface-area asserts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { mockGameweekData } from './fixtures/gameweek-data'
import { createResendMock } from './fixtures/resend-mock'

// ─── Mock scaffolding (mirrors orchestrate.test.ts, simplified) ──────────────

interface TableState {
  members?: Array<{
    id: string
    display_name: string
    email: string
    email_weekly_personal: boolean
    email_weekly_group: boolean
    user_id: string | null
  }>
  member_report_log?: Array<{
    member_id: string
    gameweek_id: string
    report_type: string
  }>
  admin_settings?: { email_weekly_personal_enabled?: boolean; email_weekly_group_enabled?: boolean }
  gameweeks?: { id: string; reports_sent_at: string | null } | null
}
let tables: TableState = {}
let inserts: Array<{ table: string; row: Record<string, unknown> }> = []

function makeChain(resolved: { data: unknown; error: unknown }) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(resolved),
    maybeSingle: vi.fn().mockResolvedValue(resolved),
    then: (resolve: (v: typeof resolved) => unknown) => resolve(resolved),
  }
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn().mockImplementation((table: string) => {
      let resolved: { data: unknown; error: unknown } = { data: null, error: null }
      if (table === 'members') resolved = { data: tables.members ?? [], error: null }
      else if (table === 'member_report_log')
        resolved = { data: tables.member_report_log ?? [], error: null }
      else if (table === 'admin_settings')
        resolved = { data: tables.admin_settings ?? null, error: null }
      else if (table === 'gameweeks')
        resolved = { data: tables.gameweeks ?? null, error: null }

      const chain = {
        ...makeChain(resolved),
        insert: vi.fn().mockImplementation((row: Record<string, unknown>) => {
          inserts.push({ table, row })
          return Promise.resolve({ data: null, error: null })
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockResolvedValue({ data: null, error: null }),
            then: (r: (v: { data: null; error: null }) => unknown) =>
              r({ data: null, error: null }),
          }),
        }),
      }
      return chain
    }),
  })),
}))

vi.mock('@/lib/reports/_data/gather-gameweek-data', () => ({
  gatherGameweekData: vi.fn(async (gwId: string) =>
    mockGameweekData({ gwId, gwNumber: 7 }),
  ),
}))
vi.mock('@/lib/reports/personal-pdf', () => ({
  renderPersonalWeeklyPdf: vi.fn(async (_d: unknown, memberId: string) =>
    Buffer.from(`pdf-${memberId}`),
  ),
}))
vi.mock('@/lib/reports/group-pdf', () => ({
  renderGroupWeeklyPdf: vi.fn(async () => Buffer.from('group-pdf')),
}))
vi.mock('@/lib/reports/weekly-xlsx', () => ({
  buildWeeklyAdminXlsx: vi.fn(() => Buffer.from('xlsx')),
}))
vi.mock('@/emails/personal-weekly', () => ({ default: () => null }))
vi.mock('@/emails/group-weekly', () => ({ default: () => null }))
vi.mock('@/emails/admin-weekly', () => ({ default: () => null }))
vi.mock('@react-email/components', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>
  return { ...actual, render: vi.fn(async () => '<html>email</html>') }
})

// Override the Resend module directly — exercise the full sendWithAttachments
// path so we can assert the actual base64 payload shape.
const resendMock = createResendMock()
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(function (this: unknown) {
    Object.assign(this as object, resendMock.client)
  }),
}))

import { sendPersonalReports } from '@/lib/reports/orchestrate'

function seed(n: number) {
  tables = {}
  inserts = []
  tables.admin_settings = {
    email_weekly_personal_enabled: true,
    email_weekly_group_enabled: true,
  }
  tables.gameweeks = { id: 'gw-1', reports_sent_at: null }
  tables.members = Array.from({ length: n }, (_, i) => ({
    id: `m-${i + 1}`,
    display_name: `M${i + 1}`,
    email: `m${i + 1}@ex.com`,
    email_weekly_personal: true,
    email_weekly_group: true,
    user_id: `u-${i + 1}`,
  }))
  resendMock.calls.length = 0
  resendMock.client.emails.send.mockClear()
}

describe('sendPersonalReports — payload + idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.RESEND_API_KEY = 'test-key'
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.ex.com'
    seed(2)
  })

  it('Test 9: attachment payload has filename string + base64 content string (post-send-attachments path)', async () => {
    await sendPersonalReports('gw-1')

    expect(resendMock.calls.length).toBeGreaterThanOrEqual(1)
    const first = resendMock.calls[0]
    expect(first.attachments).toHaveLength(1)
    const att = first.attachments![0]
    expect(typeof att.filename).toBe('string')
    expect(typeof att.content).toBe('string')
    // Valid base64
    expect(att.content as string).toMatch(/^[A-Za-z0-9+/=]+$/)
  })

  it('Test 10: second invocation with same (gw, members) produces 0 sends (pre-filter via member_report_log)', async () => {
    // First run: log all members as already sent
    tables.member_report_log = [
      { member_id: 'm-1', gameweek_id: 'gw-1', report_type: 'personal' },
      { member_id: 'm-2', gameweek_id: 'gw-1', report_type: 'personal' },
    ]

    const summary = await sendPersonalReports('gw-1')

    expect(summary.sent).toBe(0)
    expect(summary.skipped).toBe(2)
    expect(resendMock.client.emails.send).not.toHaveBeenCalled()
  })
})
