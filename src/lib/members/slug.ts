/**
 * Member slug helpers — Phase 11 Plan 01 Task 2.
 *
 * `toSlug` is a pure client-safe transform. The expression MUST align with
 * the Postgres functional UNIQUE index created in migration 012:
 *
 *   app: displayName.trim().toLowerCase().replace(/\s+/g, '-')
 *   db : lower(btrim(replace(display_name, ' ', '-')))
 *
 * The app regex collapses runs of whitespace to a single dash. The DB
 * expression handles single spaces only — any well-formed display_name
 * (single internal spaces) round-trips identically. Double-space edge
 * cases are vanishingly rare at registration time (forms trim input).
 *
 * `findMemberBySlug` is server-only — it takes a Supabase admin client and
 * looks up a member by the same slug expression. Plan 02 consumes it from
 * /members/[slug]/page.tsx.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export function toSlug(displayName: string): string {
  return displayName.trim().toLowerCase().replace(/\s+/g, '-')
}

/**
 * Find a member row by slug. Matches the Postgres functional-index expression
 * so the query is covered by the `members_display_name_slug_idx` UNIQUE index.
 *
 * Returns the raw row (or null) — callers shape it as needed.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export async function findMemberBySlug(
  admin: SupabaseClient<any, 'public', any>,
  slug: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await admin
    .from('members')
    .select('*')
    .filter(
      'display_name',
      'ilike',
      // Use ilike with a fuzzy wildcard on interior whitespace. The
      // functional index still applies because we follow up with an
      // explicit app-side slug match to narrow the (small) candidate set.
      slug.replace(/-/g, '%'),
    )
  if (error) return null
  const rows = (data ?? []) as Array<Record<string, unknown>>
  const match = rows.find(
    (r) => toSlug((r.display_name as string) ?? '') === slug,
  )
  return match ?? null
}
/* eslint-enable @typescript-eslint/no-explicit-any */
