/**
 * Orchestrator tests — sendGroupReports, sendPersonalReports, sendAdminWeekly.
 *
 * Mocks:
 *  - @/lib/supabase/admin → table-keyed stub with insert spies
 *  - @/lib/reports/_data/gather-gameweek-data → mockGameweekData
 *  - @/lib/email/send-attachments → payload-recording spy
 *  - @/lib/reports/personal-pdf / group-pdf / weekly-xlsx → deterministic Buffers
 *  - @/emails/* → simple string returns
 *  - @react-email/components → trivial render passthrough
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { mockGameweekData } from './fixtures/gameweek-data'

// ─── Module-level mock state (re-seeded per test) ────────────────────────────

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
  admin_settings?: {
    email_weekly_personal_enabled?: boolean
    email_weekly_group_enabled?: boolean
  }
  gameweeks?: { id: string; reports_sent_at: string | null } | null
}

let tables: TableState = {}

interface InsertRecord {
  table: string
  row: Record<string, unknown> | Array<Record<string, unknown>>
}
let inserts: InsertRecord[] = []

interface UpdateRecord {
  table: string
  patch: Record<string, unknown>
  eqCol?: string
  eqVal?: unknown
  isCol?: string
  isVal?: unknown
}
let updates: UpdateRecord[] = []

function makeChain(table: string, resolved: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {
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
  return chain
}

function buildAdminClientMock() {
  return {
    from: vi.fn().mockImplementation((table: string) => {
      // INSERT chain — record the insert
      const insertFn = vi
        .fn()
        .mockImplementation((row: Record<string, unknown> | Array<Record<string, unknown>>) => {
          inserts.push({ table, row })
          return Promise.resolve({ data: null, error: null })
        })

      // UPDATE chain — record patch + filters
      const updateFn = vi.fn().mockImplementation((patch: Record<string, unknown>) => {
        const rec: UpdateRecord = { table, patch }
        const returnChain = {
          eq: vi.fn().mockImplementation((col: string, val: unknown) => {
            rec.eqCol = col
            rec.eqVal = val
            const inner = {
              is: vi.fn().mockImplementation((c2: string, v2: unknown) => {
                rec.isCol = c2
                rec.isVal = v2
                updates.push(rec)
                return Promise.resolve({ data: null, error: null })
              }),
              then: (resolve: (v: { data: null; error: null }) => unknown) => {
                updates.push(rec)
                return resolve({ data: null, error: null })
              },
            }
            return inner
          }),
        }
        return returnChain
      })

      // SELECT resolution based on table
      let resolved: { data: unknown; error: unknown } = { data: null, error: null }

      if (table === 'members') {
        const all = tables.members ?? []
        resolved = { data: all, error: null }
      } else if (table === 'member_report_log') {
        resolved = { data: tables.member_report_log ?? [], error: null }
      } else if (table === 'admin_settings') {
        resolved = { data: tables.admin_settings ?? null, error: null }
      } else if (table === 'gameweeks') {
        resolved = { data: tables.gameweeks ?? null, error: null }
      }

      const chain = makeChain(table, resolved)
      chain.insert = insertFn
      chain.update = updateFn
      return chain
    }),
  }
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => buildAdminClientMock()),
}))

// gatherGameweekData — returns fixture data
vi.mock('@/lib/reports/_data/gather-gameweek-data', () => ({
  gatherGameweekData: vi.fn(async (gwId: string) =>
    mockGameweekData({ gwId, gwNumber: 5 }),
  ),
}))

// Renderers — trivial Buffers
vi.mock('@/lib/reports/personal-pdf', () => ({
  renderPersonalWeeklyPdf: vi.fn(async (_d: unknown, memberId: string) =>
    Buffer.from(`personal-pdf:${memberId}`),
  ),
}))
vi.mock('@/lib/reports/group-pdf', () => ({
  renderGroupWeeklyPdf: vi.fn(async () => Buffer.from('group-pdf')),
}))
vi.mock('@/lib/reports/weekly-xlsx', () => ({
  buildWeeklyAdminXlsx: vi.fn(() => Buffer.from('admin-xlsx')),
}))

// Email bodies — trivial renders (not needed for send assertions)
vi.mock('@/emails/personal-weekly', () => ({ default: () => null }))
vi.mock('@/emails/group-weekly', () => ({ default: () => null }))
vi.mock('@/emails/admin-weekly', () => ({ default: () => null }))

vi.mock('@react-email/components', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>
  return {
    ...actual,
    render: vi.fn(async () => '<html>email</html>'),
  }
})

// sendWithAttachments — recorded
interface SendCall {
  to: string | string[]
  subject: string
  attachments?: Array<{ filename: string; content: unknown }>
}
const sendCalls: SendCall[] = []
const sendSpy = vi.fn(async (payload: SendCall) => {
  sendCalls.push(payload)
  return { id: 'mock-id' }
})
vi.mock('@/lib/email/send-attachments', () => ({
  sendWithAttachments: sendSpy,
}))

// ─── Imports under test (after mocks) ────────────────────────────────────────

import {
  sendGroupReports,
  sendPersonalReports,
  sendAdminWeekly,
} from '@/lib/reports/orchestrate'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function seedMembers(n: number, overrides: Partial<TableState['members'][number]> = {}) {
  tables.members = Array.from({ length: n }, (_, i) => ({
    id: `m-${i + 1}`,
    display_name: `Member ${String.fromCharCode(65 + i)}`,
    email: `m${i + 1}@example.com`,
    email_weekly_personal: true,
    email_weekly_group: true,
    user_id: `u-${i + 1}`,
    ...overrides,
  }))
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('sendPersonalReports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sendCalls.length = 0
    tables = {}
    inserts = []
    updates = []
    tables.admin_settings = {
      email_weekly_personal_enabled: true,
      email_weekly_group_enabled: true,
    }
    tables.gameweeks = { id: 'gw-1', reports_sent_at: null }
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com'
    process.env.ADMIN_EMAIL_GEORGE = 'george@example.com'
    process.env.ADMIN_EMAIL_DAVE = 'dave@example.com'
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('Test 1: renders 1 PDF per opted-in member, skips opt-outs, skips already-logged', async () => {
    seedMembers(3)
    tables.members![1].email_weekly_personal = false // Member B opts out
    tables.member_report_log = [
      { member_id: 'm-3', gameweek_id: 'gw-1', report_type: 'personal' },
    ]

    const summary = await sendPersonalReports('gw-1')

    // Only member 1 gets sent (member 2 opted out; member 3 already logged)
    // But note: query filters .eq('email_weekly_personal', true), so member B
    // will be excluded at the query layer as well. Our mock returns ALL members,
    // so the orchestrator itself must also filter in code OR trust the query.
    // Our mock doesn't filter, so we expect orchestrator to either:
    //   - pre-filter members by flag OR
    //   - rely on the .eq chain. Either way, B must not receive.
    // Implementation: query uses .eq(..., true) — mock doesn't honor that, so
    // orchestrator should additionally check the flag. Accept both: 1 send.
    expect(summary.reportType).toBe('personal')
    expect(summary.skippedByAdmin).toBe(false)
    // m-1 sends, m-3 skipped (logged), m-2 either skipped or filtered out
    expect(summary.sent).toBe(1)
    expect(summary.skipped).toBe(2)
  })

  it('Test 2: calls send with attachment filename gw{N}-{slug}.pdf + base64 conversion via sendWithAttachments', async () => {
    seedMembers(1)

    await sendPersonalReports('gw-1')

    expect(sendSpy).toHaveBeenCalledTimes(1)
    const call = sendCalls[0]
    expect(call.to).toBe('m1@example.com')
    expect(call.subject).toMatch(/GW\s*5/i)
    expect(call.attachments).toHaveLength(1)
    expect(call.attachments![0].filename).toMatch(/^gw5-/)
    expect(call.attachments![0].filename).toMatch(/\.pdf$/)
    // Content passes through as Buffer — base64 conversion happens inside sendWithAttachments
    expect(Buffer.isBuffer(call.attachments![0].content)).toBe(true)
  })

  it('Test 3: admin global gate disabled — returns early, no sends', async () => {
    seedMembers(3)
    tables.admin_settings = { email_weekly_personal_enabled: false, email_weekly_group_enabled: true }

    const summary = await sendPersonalReports('gw-1')

    expect(summary.skippedByAdmin).toBe(true)
    expect(summary.sent).toBe(0)
    expect(sendSpy).not.toHaveBeenCalled()
  })

  it('Test 4: render error inserts admin_notifications with report_render_failed type and continues', async () => {
    seedMembers(2)

    // Override the render mock to throw for first member
    const { renderPersonalWeeklyPdf } = await import('@/lib/reports/personal-pdf')
    vi.mocked(renderPersonalWeeklyPdf).mockImplementationOnce(async () => {
      throw new Error('render boom')
    })

    const summary = await sendPersonalReports('gw-1')

    expect(summary.failed).toBe(1)
    expect(summary.sent).toBe(1)
    const notif = inserts.find(
      (i) =>
        i.table === 'admin_notifications'
        && (i.row as Record<string, unknown>).type === 'report_render_failed',
    )
    expect(notif).toBeDefined()
  })

  it('Test 5: sleeps ≥500ms between consecutive sends (spy on orchestrate.sleep)', async () => {
    seedMembers(3)

    // Spy on the orchestrator's exported `sleep` helper and record its arg.
    const mod = await import('@/lib/reports/orchestrate')
    const delays: number[] = []
    const spy = vi.spyOn(mod, 'sleep').mockImplementation(async (ms: number) => {
      delays.push(ms)
    })

    try {
      await sendPersonalReports('gw-1')
    } finally {
      spy.mockRestore()
    }

    // 3 sends → at least 2 inter-send sleeps, each ≥ 500ms
    const longDelays = delays.filter((d) => d >= 500)
    expect(longDelays.length).toBeGreaterThanOrEqual(2)
  })
})

describe('sendGroupReports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sendCalls.length = 0
    tables = {}
    inserts = []
    updates = []
    tables.admin_settings = {
      email_weekly_personal_enabled: true,
      email_weekly_group_enabled: true,
    }
    tables.gameweeks = { id: 'gw-1', reports_sent_at: null }
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com'
  })

  it('Test 7: renders group PDF ONCE, sends to each opted-in member, logs each', async () => {
    seedMembers(3)
    tables.members![2].email_weekly_group = false // member C opts out

    const { renderGroupWeeklyPdf } = await import('@/lib/reports/group-pdf')

    const summary = await sendGroupReports('gw-1')

    expect(summary.reportType).toBe('group')
    expect(summary.skippedByAdmin).toBe(false)
    expect(summary.sent).toBe(2)
    // Group PDF rendered exactly once (shared across sends)
    expect(renderGroupWeeklyPdf).toHaveBeenCalledTimes(1)
    // 2 logs inserted
    const groupLogs = inserts.filter(
      (i) =>
        i.table === 'member_report_log'
        && (i.row as Record<string, unknown>).report_type === 'group',
    )
    expect(groupLogs).toHaveLength(2)
  })

  it('admin global gate for group — returns skippedByAdmin', async () => {
    seedMembers(2)
    tables.admin_settings = { email_weekly_personal_enabled: true, email_weekly_group_enabled: false }

    const summary = await sendGroupReports('gw-1')

    expect(summary.skippedByAdmin).toBe(true)
    expect(sendSpy).not.toHaveBeenCalled()
  })
})

describe('sendAdminWeekly', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sendCalls.length = 0
    tables = {}
    inserts = []
    updates = []
    tables.admin_settings = {
      email_weekly_personal_enabled: true,
      email_weekly_group_enabled: true,
    }
    tables.gameweeks = { id: 'gw-1', reports_sent_at: null }
    process.env.ADMIN_EMAIL_GEORGE = 'george@example.com'
    process.env.ADMIN_EMAIL_DAVE = 'dave@example.com'
  })

  it('Test 8: renders XLSX once, sends to BOTH admin emails', async () => {
    const { buildWeeklyAdminXlsx } = await import('@/lib/reports/weekly-xlsx')

    const summary = await sendAdminWeekly('gw-1')

    expect(summary.reportType).toBe('admin_weekly')
    expect(buildWeeklyAdminXlsx).toHaveBeenCalledTimes(1)
    expect(sendSpy).toHaveBeenCalledTimes(1)
    const call = sendCalls[0]
    expect(call.to).toEqual(['george@example.com', 'dave@example.com'])
    expect(call.attachments![0].filename).toMatch(/\.xlsx$/)
    expect(summary.sent).toBe(1)
  })

  it('Test 6: gameweeks.reports_sent_at is updated when admin XLSX sends (sentinel)', async () => {
    await sendAdminWeekly('gw-1')

    const gwUpdate = updates.find((u) => u.table === 'gameweeks')
    expect(gwUpdate).toBeDefined()
    expect(gwUpdate!.patch).toHaveProperty('reports_sent_at')
  })

  it('admin XLSX idempotent: reports_sent_at already set → no send', async () => {
    tables.gameweeks = { id: 'gw-1', reports_sent_at: '2025-08-25T12:00:00Z' }

    const summary = await sendAdminWeekly('gw-1')

    expect(summary.skipped).toBeGreaterThanOrEqual(1)
    expect(sendSpy).not.toHaveBeenCalled()
  })
})
