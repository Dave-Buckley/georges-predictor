'use client'

/**
 * Gameweek navigation for the predictions panel on /members/[slug].
 *
 * Prev / next arrows plus a native <select>, all driving the `gw` search param
 * so each week is a real, linkable, back-button-friendly URL.
 *
 * Only weeks with at least one kicked-off fixture are offered — see
 * getRevealedGameweekNumbers. The arrows step through that list rather than
 * incrementing blindly, so they never land on an empty week.
 *
 * Native <select> for the same reason as the club picker: Radix popups cannot
 * be scrolled past the first screenful on a phone, and this list runs to 38.
 */
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  slug: string
  available: number[]
  selected: number
}

export function PredictionGameweekNav({ slug, available, selected }: Props) {
  const router = useRouter()

  const index = available.indexOf(selected)
  const prev = index > 0 ? available[index - 1] : null
  const next =
    index !== -1 && index < available.length - 1 ? available[index + 1] : null

  const go = (gw: number) => router.push(`/members/${slug}?gw=${gw}`)

  const arrowClasses =
    'inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 transition hover:bg-slate-800 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-slate-900'

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => prev !== null && go(prev)}
        disabled={prev === null}
        aria-label={prev !== null ? `Gameweek ${prev}` : 'No earlier gameweek'}
        className={arrowClasses}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <select
        value={selected}
        onChange={(e) => go(Number(e.target.value))}
        aria-label="Select gameweek"
        className="bg-slate-900 border border-slate-700 text-slate-100 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent cursor-pointer"
      >
        {available.map((gw) => (
          <option key={gw} value={gw}>
            Gameweek {gw}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => next !== null && go(next)}
        disabled={next === null}
        aria-label={next !== null ? `Gameweek ${next}` : 'No later gameweek'}
        className={arrowClasses}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}
