import type { CurrentGameweek } from '@/lib/gameweeks/current'

interface CurrentGameweekBannerProps {
  current: CurrentGameweek | null
}

export function CurrentGameweekBanner({ current }: CurrentGameweekBannerProps) {
  if (!current) return null

  const label =
    current.status === 'in_progress'
      ? `Gameweek ${current.number} in progress`
      : `Gameweek ${current.number} coming up`

  const dotClass =
    current.status === 'in_progress'
      ? 'bg-pl-green animate-pulse'
      : 'bg-slate-400'

  return (
    <div
      role="status"
      className="mx-auto max-w-4xl px-4 pt-6"
      aria-label={label}
    >
      <div className="flex items-center gap-3 rounded-full border border-pl-green/40 bg-pl-purple/30 backdrop-blur px-4 py-2 text-sm text-white w-fit mx-auto sm:mx-0">
        <span
          className={`inline-block w-2 h-2 rounded-full ${dotClass}`}
          aria-hidden="true"
        />
        <span className="font-semibold tracking-wide">{label}</span>
      </div>
    </div>
  )
}
