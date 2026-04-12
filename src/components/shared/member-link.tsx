/**
 * MemberLink — wraps a member display name in a Next.js <Link> pointing at
 * /members/[slug]. Plan 01 ships the link; Plan 02 ships the target page.
 *
 * Until Plan 02 lands the link will 404, which is intentional and safe
 * during Phase 11 mid-development.
 */
import Link from 'next/link'

import { toSlug } from '@/lib/members/slug'

interface MemberLinkProps {
  displayName: string
  /** Optional extra classes merged after the component defaults. */
  className?: string
}

const DEFAULT_CLASSES =
  'text-slate-200 hover:text-pl-green transition-colors underline-offset-2 hover:underline'

export function MemberLink({ displayName, className }: MemberLinkProps) {
  const slug = toSlug(displayName)
  const merged = className
    ? `${DEFAULT_CLASSES} ${className}`
    : DEFAULT_CLASSES
  return (
    <Link href={`/members/${slug}`} className={merged}>
      {displayName}
    </Link>
  )
}

export default MemberLink
