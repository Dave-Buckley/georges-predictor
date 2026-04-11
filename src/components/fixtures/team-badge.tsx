import type { TeamRow } from '@/lib/supabase/types'

interface TeamBadgeProps {
  team: TeamRow
  size?: 'sm' | 'md' | 'lg'
  showName?: boolean
}

const SIZE_PX: Record<NonNullable<TeamBadgeProps['size']>, number> = {
  sm: 20,
  md: 28,
  lg: 36,
}

/**
 * Reusable team badge component.
 * Renders the team crest image alongside the team name (or TLA for small size).
 * Falls back to a coloured circle with TLA if crest_url is null.
 */
export default function TeamBadge({ team, size = 'md', showName = true }: TeamBadgeProps) {
  const px = SIZE_PX[size]
  const displayName = size === 'sm' ? (team.tla ?? team.short_name ?? team.name) : (team.short_name ?? team.name)

  return (
    <span className="inline-flex items-center gap-1.5">
      {team.crest_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={team.crest_url}
          alt={team.name}
          width={px}
          height={px}
          loading="lazy"
          style={{ width: px, height: px, objectFit: 'contain' }}
        />
      ) : (
        <span
          className="inline-flex items-center justify-center rounded-full bg-slate-600 text-white font-bold flex-shrink-0"
          style={{ width: px, height: px, fontSize: px * 0.35 }}
          aria-label={team.name}
        >
          {team.tla ?? team.name.slice(0, 3).toUpperCase()}
        </span>
      )}
      {showName && (
        <span className="text-sm font-medium text-slate-200">{displayName}</span>
      )}
    </span>
  )
}
