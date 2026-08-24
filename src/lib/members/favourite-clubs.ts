/**
 * Favourite-club badge lookup (migration 029).
 *
 * Returns member_id → badge, for rendering a club badge beside a member's
 * name via <MemberLink badge={...} />.
 *
 * ─── Degrades to "no badges" rather than throwing ───────────────────────────
 * This is deliberately fail-soft. /standings is the most visible page in the
 * app and is public, and the favourite club is decorative. If migration 029
 * has not been pasted into the SQL editor yet, `members.favourite_club_id` and
 * `public.clubs` do not exist and these queries error — in which case we return
 * an empty map and every name renders exactly as it did before. The league
 * table must never 500 over a cosmetic feature.
 *
 * The queries are kept separate from the main members SELECT for the same
 * reason: a join would take the whole standings query down with it.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export interface FavouriteBadge {
  /** Club badge image URL. Null renders as coloured initials. */
  url: string | null
  /** Club name, used for the initials fallback and the tooltip. */
  name: string
}

/**
 * @param client - Any Supabase client. The admin client is typical, since most
 *                 callers already hold one; the RLS policy on `clubs` allows
 *                 reads either way.
 */
export async function getFavouriteBadges(
  client: SupabaseClient,
): Promise<Map<string, FavouriteBadge>> {
  const badges = new Map<string, FavouriteBadge>()

  // Wrapped whole: any shape surprise (missing column, missing table, a test
  // double that does not implement part of the query builder) degrades to "no
  // badges" rather than taking the caller down with it.
  try {
    // Deliberately a plain select with no filters — the members table is ~50
    // rows, and the narrower the query surface the fewer ways it can fail.
    // Rows without a favourite are dropped below.
    const { data: memberRows, error: memberErr } = await client
      .from('members')
      .select('id, favourite_club_id')

    if (memberErr || !Array.isArray(memberRows)) return badges

    const rows = memberRows as Array<{ id: string; favourite_club_id?: string | null }>
    const wanted = rows.filter((r) => r.favourite_club_id)
    if (wanted.length === 0) return badges

    const { data: clubRows, error: clubErr } = await client
      .from('clubs')
      .select('id, name, badge_url')

    if (clubErr || !Array.isArray(clubRows)) return badges

    const clubById = new Map(
      (clubRows as Array<{ id: string; name: string; badge_url: string | null }>).map(
        (c) => [c.id, c],
      ),
    )

    for (const r of wanted) {
      const club = clubById.get(r.favourite_club_id as string)
      if (!club) continue
      badges.set(r.id, { url: club.badge_url ?? null, name: club.name })
    }
  } catch {
    return badges
  }

  return badges
}
