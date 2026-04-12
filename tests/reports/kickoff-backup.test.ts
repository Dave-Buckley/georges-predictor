/**
 * Kickoff backup hook tests — maybeSendKickoffBackup + sendKickoffBackupEmail.
 *
 * Asserts:
 *  1. GW with kickoff_backup_sent_at=NULL AND a non-SCHEDULED fixture →
 *     renders PDF+XLSX, sends one email with BOTH attachments to
 *     [ADMIN_EMAIL_GEORGE, ADMIN_EMAIL_DAVE], updates the flag.
 *  2. GW with flag already set → no-op.
 *  3. GW with all fixtures SCHEDULED → no-op.
 *  4. Multiple GWs iterate independently.
 *  5. Render failure inserts admin_notifications type='kickoff_backup_failed'
 *     and leaves flag NULL (next sync retries).
 *  6. Subject is exactly `Backup — GW{N} all predictions as of kickoff`.
 *  7. Attachments array length === 2 with filenames kickoff-backup-gw{N}.{pdf,xlsx}.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { mockGameweekData } from './fixtures/gameweek-data'

// ─── Mock state ──────────────────────────────────────────────────────────────

interface GwRow {
  id: string
  number: number
  kickoff_backup_sent_at: string | null
}
interface FixRow {
  id: string
  status: string
  gameweek_id: string
}
let gwsState: GwRow[] = []
let fixturesByGw: Record<string, FixRow[]> = {}
let updates: Array<{ table: string; patch: Record<string, unknown>; eqCol?: string; eqVal?: unknown }> = []
let inserts: Array<{ table: string; row: Record<string, unknown> }> = []

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'gameweeks') {
        const selectChain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          then: (r: (v: { data: GwRow[]; error: null }) => unknown) =>
            r({ data: gwsState.filter((g) => g.kickoff_backup_sent_at === null), error: null }),
        }
        return {
          ...selectChain,
          update: vi.fn().mockImplementation((patch: Record<string, unknown>) => {
            const rec = { table: 'gameweeks', patch } as { table: string; patch: Record<string, unknown>; eqCol?: string; eqVal?: unknown }
            return {
              eq: vi.fn().mockImplementation((col: string, val: unknown) => {
                rec.eqCol = col
                rec.eqVal = val
                // Mutate gwsState to reflect the update
                const gw = gwsState.find((g) => g.id === val)
                if (gw && 'kickoff_backup_sent_at' in patch) {
                  gw.kickoff_backup_sent_at = patch.kickoff_backup_sent_at as string | null
                }
                updates.push(rec)
                return Promise.resolve({ data: null, error: null })
              }),
            }
          }),
        }
      }

      if (table === 'fixtures') {
        // Stateful response: track the last .eq('gameweek_id', ...) call
        let gwIdFilter: string | null = null
        const chain: Record<string, unknown> = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockImplementation((col: string, val: unknown) => {
            if (col === 'gameweek_id') gwIdFilter = val as string
            return chain
          }),
          neq: vi.fn().mockImplementation(() => chain),
          limit: vi.fn().mockImplementation(() => chain),
          then: (r: (v: { data: FixRow[]; error: null }) => unknown) => {
            const all = gwIdFilter ? (fixturesByGw[gwIdFilter] ?? []) : []
            // Apply neq('status','SCHEDULED') filter — mock only knows there's a single chain,
            // but since the hook's only query is .eq(gameweek_id).neq(status,'SCHEDULED').limit(1),
            // apply that filter here:
            const nonScheduled = all.filter((f) => f.status !== 'SCHEDULED')
            return r({ data: nonScheduled, error: null })
          },
        }
        return chain
      }

      if (table === 'admin_notifications') {
        return {
          insert: vi.fn().mockImplementation((row: Record<string, unknown>) => {
            inserts.push({ table: 'admin_notifications', row })
            return Promise.resolve({ data: null, error: null })
          }),
        }
      }

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: (r: (v: { data: null; error: null }) => unknown) => r({ data: null, error: null }),
      }
    }),
  })),
}))

vi.mock('@/lib/reports/_data/gather-gameweek-data', () => ({
  gatherGameweekData: vi.fn(async (gwId: string) => {
    const gw = gwsState.find((g) => g.id === gwId)
    return mockGameweekData({ gwId, gwNumber: gw?.number ?? 1 })
  }),
}))

vi.mock('@/lib/reports/kickoff-backup-pdf', () => ({
  renderKickoffBackupPdf: vi.fn(async () => Buffer.from('kickoff-pdf')),
}))
vi.mock('@/lib/reports/kickoff-backup-xlsx', () => ({
  buildKickoffBackupXlsx: vi.fn(() => Buffer.from('kickoff-xlsx')),
}))
vi.mock('@/emails/kickoff-backup', () => ({ default: () => null }))
vi.mock('@react-email/components', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>
  return { ...actual, render: vi.fn(async () => '<html>backup</html>') }
})

// send-attachments recorded via vi.hoisted
const hoistedSend = vi.hoisted(() => {
  const calls: Array<{ to: string | string[]; subject: string; attachments?: Array<{ filename: string; content: unknown }> }> = []
  return { calls }
})
vi.mock('@/lib/email/send-attachments', () => ({
  sendWithAttachments: vi.fn(async (payload: { to: string | string[]; subject: string; attachments?: Array<{ filename: string; content: unknown }> }) => {
    hoistedSend.calls.push(payload)
    return { id: 'mock-id' }
  }),
}))

import { maybeSendKickoffBackup, sendKickoffBackupEmail } from '@/lib/reports/kickoff-backup-hook'
import { sendWithAttachments } from '@/lib/email/send-attachments'

beforeEach(() => {
  vi.clearAllMocks()
  hoistedSend.calls.length = 0
  gwsState = []
  fixturesByGw = {}
  updates = []
  inserts = []
  process.env.ADMIN_EMAIL_GEORGE = 'george@ex.com'
  process.env.ADMIN_EMAIL_DAVE = 'dave@ex.com'
})

describe('maybeSendKickoffBackup', () => {
  it('Test 1: GW with NULL flag + a non-SCHEDULED fixture → renders PDF+XLSX, sends email, sets flag', async () => {
    gwsState = [{ id: 'gw-1', number: 5, kickoff_backup_sent_at: null }]
    fixturesByGw['gw-1'] = [
      { id: 'f-1', status: 'IN_PLAY', gameweek_id: 'gw-1' },
      { id: 'f-2', status: 'SCHEDULED', gameweek_id: 'gw-1' },
    ]

    await maybeSendKickoffBackup()

    expect(sendWithAttachments).toHaveBeenCalledTimes(1)
    const call = hoistedSend.calls[0]
    expect(call.to).toEqual(['george@ex.com', 'dave@ex.com'])
    expect(call.attachments).toHaveLength(2)
    // Flag was updated
    const gwUpdate = updates.find((u) => u.table === 'gameweeks' && u.eqVal === 'gw-1')
    expect(gwUpdate).toBeDefined()
    expect(gwUpdate!.patch).toHaveProperty('kickoff_backup_sent_at')
    expect(gwUpdate!.patch.kickoff_backup_sent_at).not.toBeNull()
  })

  it('Test 2: GW with flag ALREADY set is a no-op (not returned by query)', async () => {
    gwsState = [{ id: 'gw-1', number: 5, kickoff_backup_sent_at: '2025-08-15T12:00:00Z' }]
    fixturesByGw['gw-1'] = [{ id: 'f-1', status: 'IN_PLAY', gameweek_id: 'gw-1' }]

    await maybeSendKickoffBackup()

    expect(sendWithAttachments).not.toHaveBeenCalled()
    expect(updates).toHaveLength(0)
  })

  it('Test 3: GW with all SCHEDULED fixtures is a no-op', async () => {
    gwsState = [{ id: 'gw-1', number: 5, kickoff_backup_sent_at: null }]
    fixturesByGw['gw-1'] = [
      { id: 'f-1', status: 'SCHEDULED', gameweek_id: 'gw-1' },
      { id: 'f-2', status: 'SCHEDULED', gameweek_id: 'gw-1' },
    ]

    await maybeSendKickoffBackup()

    expect(sendWithAttachments).not.toHaveBeenCalled()
    expect(updates).toHaveLength(0)
  })

  it('Test 4: Multiple open-backup GWs — iterates and processes each', async () => {
    gwsState = [
      { id: 'gw-1', number: 5, kickoff_backup_sent_at: null },
      { id: 'gw-2', number: 6, kickoff_backup_sent_at: null },
    ]
    fixturesByGw['gw-1'] = [{ id: 'f-1', status: 'IN_PLAY', gameweek_id: 'gw-1' }]
    fixturesByGw['gw-2'] = [{ id: 'f-2', status: 'FINISHED', gameweek_id: 'gw-2' }]

    await maybeSendKickoffBackup()

    expect(sendWithAttachments).toHaveBeenCalledTimes(2)
    expect(updates.filter((u) => u.table === 'gameweeks')).toHaveLength(2)
  })

  it('Test 5: Render failure → admin_notifications insert + flag LEFT NULL', async () => {
    gwsState = [{ id: 'gw-1', number: 5, kickoff_backup_sent_at: null }]
    fixturesByGw['gw-1'] = [{ id: 'f-1', status: 'IN_PLAY', gameweek_id: 'gw-1' }]

    const { renderKickoffBackupPdf } = await import('@/lib/reports/kickoff-backup-pdf')
    vi.mocked(renderKickoffBackupPdf).mockImplementationOnce(async () => {
      throw new Error('pdf render boom')
    })

    await maybeSendKickoffBackup()

    const notif = inserts.find(
      (i) =>
        i.table === 'admin_notifications'
        && (i.row as Record<string, unknown>).type === 'kickoff_backup_failed',
    )
    expect(notif).toBeDefined()
    // Flag MUST still be null on the mutable state
    expect(gwsState[0].kickoff_backup_sent_at).toBeNull()
  })
})

describe('sendKickoffBackupEmail — payload', () => {
  beforeEach(() => {
    gwsState = [{ id: 'gw-42', number: 7, kickoff_backup_sent_at: null }]
  })

  it('Test 6 + 7: subject is "Backup — GW{N} all predictions as of kickoff"; attachments=2 with correct filenames', async () => {
    await sendKickoffBackupEmail('gw-42')

    expect(hoistedSend.calls).toHaveLength(1)
    const call = hoistedSend.calls[0]
    expect(call.subject).toBe('Backup — GW7 all predictions as of kickoff')
    expect(call.attachments).toHaveLength(2)
    const names = call.attachments!.map((a) => a.filename).sort()
    expect(names).toEqual(['kickoff-backup-gw7.pdf', 'kickoff-backup-gw7.xlsx'])
  })
})
