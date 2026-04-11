'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react'
import type { GameweekStatus } from '@/lib/supabase/types'

interface GameweekNavProps {
  currentGw: number
  totalGw?: number
  gameweeks: { number: number; status: GameweekStatus }[]
}

/**
 * Gameweek navigation bar with prev/next arrows and a dropdown picker.
 * Uses client-side router navigation so no full page reload.
 */
export default function GameweekNav({ currentGw, totalGw = 38, gameweeks }: GameweekNavProps) {
  const router = useRouter()

  function navigate(gw: number) {
    router.push(`/gameweeks/${gw}`)
  }

  const canPrev = currentGw > 1
  const canNext = currentGw < totalGw

  return (
    <div className="flex items-center gap-2 justify-between bg-slate-800 border border-slate-700 rounded-xl px-4 py-3">
      {/* Prev arrow */}
      <button
        onClick={() => navigate(currentGw - 1)}
        disabled={!canPrev}
        aria-label="Previous gameweek"
        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      {/* Dropdown picker */}
      <div className="flex-1 flex justify-center">
        <select
          value={currentGw}
          onChange={(e) => navigate(Number(e.target.value))}
          className="bg-slate-700 text-white text-sm font-medium rounded-lg px-3 py-1.5 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
          aria-label="Select gameweek"
        >
          {gameweeks.map((gw) => (
            <option key={gw.number} value={gw.number}>
              {gw.status === 'complete' ? '✓ ' : ''}Gameweek {gw.number}
            </option>
          ))}
        </select>
      </div>

      {/* Next arrow */}
      <button
        onClick={() => navigate(currentGw + 1)}
        disabled={!canNext}
        aria-label="Next gameweek"
        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  )
}

// Re-export CheckCircle2 so consumers don't need to import lucide-react directly
// (not needed here — exported for potential future use in status badges)
export { CheckCircle2 }
