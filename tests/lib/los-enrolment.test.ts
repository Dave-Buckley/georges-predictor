/**
 * Tests for enrolMemberInActiveLos (src/lib/los/enrolment.ts).
 *
 * Regression cover for the bug where members approved after a LOS cycle had
 * already started never got a los_competition_members row — so the shield
 * never rendered on their gameweek page while predictions and bonus worked.
 */
import { describe, it, expect, vi } from 'vitest'
import { enrolMemberInActiveLos } from '@/lib/los/enrolment'

const MEMBER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const COMPETITION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

interface StubOptions {
  activeCompetition?: { id: string } | null
  member?: { approval_status: string; exclude_from_standings: boolean } | null
  existingRow?: { id: string } | null
  insertError?: { message: string } | null
}

/** Minimal chainable Supabase stub covering the calls the helper makes. */
function makeClient(opts: StubOptions) {
  const inserts: Array<Record<string, unknown>> = []

  const client = {
    inserts,
    from(table: string) {
      const result =
        table === 'los_competitions'
          ? (opts.activeCompetition ?? null)
          : table === 'members'
            ? (opts.member ?? null)
            : (opts.existingRow ?? null)

      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: result, error: null }),
        insert: async (row: Record<string, unknown>) => {
          inserts.push(row)
          return { error: opts.insertError ?? null }
        },
      }
      return chain
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any

  return client
}

const APPROVED = { approval_status: 'approved', exclude_from_standings: false }

describe('enrolMemberInActiveLos', () => {
  it('inserts an active row for an approved member with no existing row', async () => {
    const client = makeClient({
      activeCompetition: { id: COMPETITION_ID },
      member: APPROVED,
      existingRow: null,
    })

    const result = await enrolMemberInActiveLos(client, MEMBER_ID)

    expect(result).toEqual({ enrolled: true })
    expect(client.inserts).toEqual([
      { competition_id: COMPETITION_ID, member_id: MEMBER_ID, status: 'active' },
    ])
  })

  it('no-ops when there is no active competition', async () => {
    const client = makeClient({ activeCompetition: null, member: APPROVED })

    const result = await enrolMemberInActiveLos(client, MEMBER_ID)

    expect(result).toEqual({ enrolled: false, reason: 'no-active-competition' })
    expect(client.inserts).toHaveLength(0)
  })

  it('skips members who are not approved', async () => {
    const client = makeClient({
      activeCompetition: { id: COMPETITION_ID },
      member: { approval_status: 'pending', exclude_from_standings: false },
    })

    const result = await enrolMemberInActiveLos(client, MEMBER_ID)

    expect(result).toEqual({ enrolled: false, reason: 'not-eligible' })
    expect(client.inserts).toHaveLength(0)
  })

  it('skips placeholder members hidden from standings', async () => {
    const client = makeClient({
      activeCompetition: { id: COMPETITION_ID },
      member: { approval_status: 'approved', exclude_from_standings: true },
    })

    const result = await enrolMemberInActiveLos(client, MEMBER_ID)

    expect(result).toEqual({ enrolled: false, reason: 'not-eligible' })
    expect(client.inserts).toHaveLength(0)
  })

  it('is idempotent — never overwrites an existing enrolment row', async () => {
    const client = makeClient({
      activeCompetition: { id: COMPETITION_ID },
      member: APPROVED,
      existingRow: { id: 'existing-row-id' },
    })

    const result = await enrolMemberInActiveLos(client, MEMBER_ID)

    expect(result).toEqual({ enrolled: false, reason: 'already-enrolled' })
    expect(client.inserts).toHaveLength(0)
  })

  it('reports insert failures without throwing', async () => {
    const client = makeClient({
      activeCompetition: { id: COMPETITION_ID },
      member: APPROVED,
      existingRow: null,
      insertError: { message: 'duplicate key' },
    })

    const result = await enrolMemberInActiveLos(client, MEMBER_ID)

    expect(result).toEqual({ enrolled: false, reason: 'error', detail: 'duplicate key' })
  })

  it('swallows thrown client errors — approval must never be blocked', async () => {
    const client = {
      from: vi.fn(() => {
        throw new Error('connection lost')
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any

    const result = await enrolMemberInActiveLos(client, MEMBER_ID)

    expect(result).toEqual({ enrolled: false, reason: 'error', detail: 'connection lost' })
  })
})
