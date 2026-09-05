/**
 * Regression tests for the 1000-row silent-truncation bug.
 *
 * September 2026: the standings table showed 28 members on zero points while
 * their prediction_scores rows were perfectly correct. The cause was a
 * `.select()` with no `.range()` — PostgREST returns at most 1000 rows and
 * sets no error, so every total built from that read was quietly short.
 *
 * These tests pin the two properties that stop it recurring:
 *   - a read spanning more than one page comes back whole
 *   - a filtered read never silently degrades into a whole-table read
 */
import { describe, it, expect, vi } from 'vitest'

import { fetchAllRows, fetchAllRowsIn } from '@/lib/supabase/fetch-all'

/**
 * Stub that behaves like PostgREST: honours range(), and never returns more
 * than 1000 rows in one response no matter what was asked for.
 */
function pagedTable(rowCount: number, opts: { hardCap?: number } = {}) {
  const hardCap = opts.hardCap ?? 1000
  const rows = Array.from({ length: rowCount }, (_, i) => ({ id: `row-${i}` }))
  const rangeCalls: Array<[number, number]> = []

  const build = () => ({
    order: () => ({
      range: (from: number, to: number) => {
        rangeCalls.push([from, to])
        const size = Math.min(to - from + 1, hardCap)
        return Promise.resolve({ data: rows.slice(from, from + size), error: null })
      },
    }),
  })

  return { build, rangeCalls, rows }
}

describe('fetchAllRows', () => {
  it('returns every row when the table is larger than one page', async () => {
    const table = pagedTable(1393) // the exact size that broke the standings

    const result = await fetchAllRows<{ id: string }>(table.build)

    expect(result).toHaveLength(1393)
    expect(result[1392].id).toBe('row-1392')
  })

  it('stops paging once a short page comes back', async () => {
    const table = pagedTable(1393)

    await fetchAllRows<{ id: string }>(table.build)

    // 1000 + 393 — two requests, no wasted third round-trip.
    expect(table.rangeCalls).toEqual([
      [0, 999],
      [1000, 1999],
    ])
  })

  it('handles an exact multiple of the page size without dropping rows', async () => {
    const table = pagedTable(2000)

    const result = await fetchAllRows<{ id: string }>(table.build)

    expect(result).toHaveLength(2000)
  })

  it('returns an empty array for an empty table', async () => {
    const table = pagedTable(0)

    await expect(fetchAllRows<{ id: string }>(table.build)).resolves.toEqual([])
  })

  it('throws rather than returning a short list when the read fails', async () => {
    // Failing soft here is what let wrong totals reach the league table.
    const build = () => ({
      order: () => ({
        range: () => Promise.resolve({ data: null, error: { message: 'boom' } }),
      }),
    })

    await expect(fetchAllRows<{ id: string }>(build)).rejects.toThrow('boom')
  })

  it('orders by a stable key so pages cannot repeat or skip rows', async () => {
    const order = vi.fn().mockReturnValue({
      range: () => Promise.resolve({ data: [], error: null }),
    })

    await fetchAllRows(() => ({ order }))

    expect(order).toHaveBeenCalledWith('id', { ascending: true })
  })
})

describe('fetchAllRowsIn', () => {
  it('splits a long id list into URL-safe chunks and returns all rows', async () => {
    // A full season is ~380 fixtures; inlining that many UUIDs in one query
    // string overflows the URL limit.
    const seasonFixtureIds = Array.from({ length: 380 }, (_, i) => `fix-${i}`)
    const chunks: string[][] = []

    const result = await fetchAllRowsIn<{ id: string }>(
      seasonFixtureIds,
      (chunk) => {
        chunks.push(chunk)
        return {
          order: () => ({
            range: (from: number) =>
              Promise.resolve({
                data: from === 0 ? chunk.map((id) => ({ id })) : [],
                error: null,
              }),
          }),
        }
      },
    )

    expect(chunks).toHaveLength(4) // 100 + 100 + 100 + 80
    expect(chunks.every((c) => c.length <= 100)).toBe(true)
    expect(result).toHaveLength(380)
  })

  it('returns nothing for an empty id list instead of reading the whole table', async () => {
    const build = vi.fn()

    await expect(fetchAllRowsIn<{ id: string }>([], build)).resolves.toEqual([])
    expect(build).not.toHaveBeenCalled()
  })

  it('pages within a single chunk when one chunk exceeds the row cap', async () => {
    // 100 fixtures × 50 members = 5000 score rows for one chunk.
    const ids = Array.from({ length: 100 }, (_, i) => `fix-${i}`)
    const rows = Array.from({ length: 5000 }, (_, i) => ({ id: `s-${i}` }))

    const result = await fetchAllRowsIn<{ id: string }>(ids, () => ({
      order: () => ({
        range: (from: number, to: number) =>
          Promise.resolve({
            data: rows.slice(from, from + Math.min(to - from + 1, 1000)),
            error: null,
          }),
      }),
    }))

    expect(result).toHaveLength(5000)
  })
})
