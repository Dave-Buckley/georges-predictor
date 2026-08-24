/**
 * ClubBadge — the small square that sits beside a member's name.
 *
 * One component so the three cases stay consistent everywhere they appear
 * (league table, member profile header, profile picker):
 *
 *   1. Club picked, badge image known  → the club badge
 *   2. Club picked, no badge image     → coloured circle with initials,
 *                                        matching the TeamBadge idiom
 *   3. No club picked yet              → the King Predictor logo, so every
 *                                        member has a badge from day one and
 *                                        the table never looks half-filled
 *
 * Always decorative: aria-hidden with the club name in `title`. The
 * accessible name of the surrounding link stays the member's display name.
 */

/** Placeholder shown until a member picks a club on /profile. */
export const DEFAULT_BADGE_SRC = '/king-predictor-logo.jpg'

export interface ClubBadgeClub {
  /** Club badge image. Null falls back to initials. */
  url: string | null
  /** Club name — used for the initials fallback and the tooltip. */
  name: string
}

interface ClubBadgeProps {
  /**
   * The member's club. `null` means they have not picked one, which renders
   * the King Predictor logo rather than an empty gap.
   */
  club: ClubBadgeClub | null
  /** Edge length in px. Defaults to 16 to sit inside a table row. */
  size?: number
  className?: string
}

/** Initials fallback, matching the TeamBadge idiom for a missing crest. */
export function clubInitials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean)
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase()
  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

export function ClubBadge({ club, size = 16, className }: ClubBadgeProps) {
  const box = { width: size, height: size } as const
  const merged = `flex-shrink-0${className ? ` ${className}` : ''}`

  // 3. No club picked yet — house logo.
  if (!club) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={DEFAULT_BADGE_SRC}
        alt=""
        aria-hidden="true"
        title="No club picked yet — choose one on your profile"
        width={size}
        height={size}
        loading="lazy"
        className={`${merged} rounded-full`}
        style={{ ...box, objectFit: 'cover' }}
      />
    )
  }

  // 1. Club badge image.
  if (club.url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={club.url}
        alt=""
        aria-hidden="true"
        title={club.name}
        width={size}
        height={size}
        loading="lazy"
        className={merged}
        style={{ ...box, objectFit: 'contain' }}
      />
    )
  }

  // 2. Known club, no image.
  return (
    <span
      aria-hidden="true"
      title={club.name}
      className={`${merged} inline-flex items-center justify-center rounded-full bg-slate-600 text-white font-bold`}
      style={{ ...box, fontSize: Math.max(7, Math.round(size * 0.38)) }}
    >
      {clubInitials(club.name)}
    </span>
  )
}

export default ClubBadge
