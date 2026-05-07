'use client'

import { useRouter } from 'next/navigation'
import type { GameweekRow } from '@/lib/supabase/types'

interface GameweekSelectorProps {
  gameweeks: GameweekRow[]
  selectedGw: number
}

/**
 * Picks which gameweek's bonus picks to view in the admin bonuses page.
 * Updates ?gw=N — anchored to #awards so the page lands at the awards section.
 */
export function GameweekSelector({ gameweeks, selectedGw }: GameweekSelectorProps) {
  const router = useRouter()

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    router.push(`/admin/bonuses?gw=${e.target.value}#awards`)
  }

  return (
    <select
      value={selectedGw}
      onChange={handleChange}
      className="bg-white border border-gray-300 text-gray-700 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent cursor-pointer"
      aria-label="Select gameweek"
    >
      {gameweeks.map((gw) => (
        <option key={gw.id} value={gw.number}>
          Gameweek {gw.number}
          {gw.status === 'active'
            ? ' (Active)'
            : gw.status === 'complete'
              ? ' (Complete)'
              : ''}
        </option>
      ))}
    </select>
  )
}
