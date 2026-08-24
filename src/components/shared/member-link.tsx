/**
 * MemberLink — wraps a member display name in a Next.js <Link> pointing at
 * /members/[slug].
 *
 * Optionally renders the member's favourite-club badge immediately before the
 * name (migration 029). Three states, distinguished by the `badge` prop:
 *
 *   badge omitted (undefined) → no badge at all. Every call site that predates
 *                               the feature keeps its exact previous layout.
 *   badge={null}              → member has not picked a club: King Predictor
 *                               logo, so the column never looks half-filled.
 *   badge={{ url, name }}     → the club badge, or initials if url is null.
 *
 * The badge is decorative — aria-hidden, with the accessible name of the link
 * staying the member's display name, so screen reader output is unchanged.
 */
import Link from 'next/link'

import { toSlug } from '@/lib/members/slug'
import { ClubBadge, type ClubBadgeClub } from '@/components/shared/club-badge'

export type MemberBadge = ClubBadgeClub

interface MemberLinkProps {
  displayName: string
  /** Optional extra classes merged after the component defaults. */
  className?: string
  /** Favourite-club badge. Omit for no badge; null for the default logo. */
  badge?: MemberBadge | null
  /** Badge edge length in px. Defaults to 16 to sit inside a table row. */
  badgeSize?: number
}

const DEFAULT_CLASSES =
  'text-slate-200 hover:text-pl-green transition-colors underline-offset-2 hover:underline'

export function MemberLink({
  displayName,
  className,
  badge,
  badgeSize = 16,
}: MemberLinkProps) {
  const slug = toSlug(displayName)
  const merged = className ? `${DEFAULT_CLASSES} ${className}` : DEFAULT_CLASSES

  const link = (
    <Link href={`/members/${slug}`} className={merged}>
      {displayName}
    </Link>
  )

  // Omitted entirely — preserve the pre-feature layout exactly.
  if (badge === undefined) return link

  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <ClubBadge club={badge} size={badgeSize} />
      {link}
    </span>
  )
}

export default MemberLink
