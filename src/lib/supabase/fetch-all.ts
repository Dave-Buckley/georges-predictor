/**
 * Paginated, scope-safe table reads.
 *
 * ── The trap this exists to close ─────────────────────────────────────────
 * PostgREST caps EVERY response at 1000 rows. A `.select()` without an
 * explicit `.range()` returns at most 1000 rows and reports **no error** —
 * the rest are silently missing. Totals built from that read look plausible
 * and are wrong.
 *
 * That is not theoretical here. `prediction_scores` grows by one row per
 * member per fixture (~50 rows/fixture, ~500/gameweek), so it crosses 1000
 * rows three gameweeks into a season and reaches ~19,000 by GW38. In
 * September 2026 an unpaginated read of it zeroed 28 members on the
 * standings table while their prediction_scores rows were perfectly correct.
 *
 * ── Capacity: the league runs for years ───────────────────────────────────
 * These tables are never truncated between seasons (members keep 10+ years of
 * history), so a "just paginate it" fix would quietly turn into fetching
 * every season ever played on each page render. Two rules keep the cost flat:
 *
 *   1. Narrow in SQL, not in JS. Filter by the gameweeks/fixtures actually
 *      needed before the rows leave the database.
 *   2. Page through whatever is left, so a scope that legitimately exceeds
 *      1000 rows still comes back whole.
 *
 * `fetchAllRowsIn` does both: it chunks a long `.in()` list (a 380-fixture
 * season would otherwise blow the URL length limit) and paginates each chunk.
 *
 * Reads are ordered by a stable key before paging. Without an ORDER BY,
 * Postgres may return rows in a different order per request, so page 2 can
 * repeat or skip rows from page 1.
 */

/** Max rows PostgREST will return in one response. */
const PAGE_SIZE = 1000

/**
 * How many ids to put in a single `.in(...)` filter. Supabase sends filters in
 * the query string, and a full season of fixture UUIDs (~380 × 37 chars) would
 * exceed the URL limit, so long lists are split.
 */
const IN_CHUNK_SIZE = 100

/**
 * Structural shape of a Supabase select builder — just the two methods we
 * need. Declared structurally so this works with the `SupabaseClient<any>`
 * returned by createAdminClient().
 */
interface PageableQuery<T> {
  order(column: string, options: { ascending: boolean }): PageableQuery<T>
  range(
    from: number,
    to: number,
  ): PromiseLike<{ data: T[] | null; error: { message: string } | null }>
}

export interface FetchAllOptions {
  /**
   * Column to sort by while paging. Must be unique and stable — the default
   * `id` is the primary key on every table this is used with.
   */
  orderBy?: string
  pageSize?: number
  chunkSize?: number
}

/**
 * Reads every row a query matches, following pages until the table is
 * exhausted.
 *
 * Throws on a database error rather than returning a short list. A scoring
 * page that renders wrong totals is worse than one that fails visibly — the
 * silent-truncation bug above is exactly what "fail soft" bought us.
 */
export async function fetchAllRows<T>(
  buildQuery: () => PageableQuery<T>,
  options: FetchAllOptions = {},
): Promise<T[]> {
  const { orderBy = 'id', pageSize = PAGE_SIZE } = options
  const rows: T[] = []

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildQuery()
      .order(orderBy, { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) throw new Error(`fetchAllRows: ${error.message}`)

    const page = data ?? []
    rows.push(...page)
    if (page.length < pageSize) break
  }

  return rows
}

/**
 * Same as fetchAllRows, but for a query filtered by a long list of ids.
 * Splits `values` into URL-safe chunks, pages each one, and concatenates.
 *
 * Returns [] for an empty list — an unfiltered read would otherwise fetch the
 * whole table, which is the failure this module exists to prevent.
 *
 * @example
 *   const scores = await fetchAllRowsIn<ScoreRow>(fixtureIds, (ids) =>
 *     admin.from('prediction_scores').select('member_id, points_awarded').in('fixture_id', ids),
 *   )
 */
export async function fetchAllRowsIn<T>(
  values: readonly string[],
  buildQuery: (chunk: string[]) => PageableQuery<T>,
  options: FetchAllOptions = {},
): Promise<T[]> {
  if (values.length === 0) return []

  const { chunkSize = IN_CHUNK_SIZE } = options
  const rows: T[] = []

  for (let i = 0; i < values.length; i += chunkSize) {
    const chunk = values.slice(i, i + chunkSize)
    rows.push(...(await fetchAllRows<T>(() => buildQuery(chunk), options)))
  }

  return rows
}
