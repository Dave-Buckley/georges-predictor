'use client'

import { useRouter } from 'next/navigation'
import type { GameweekRow } from '@/lib/supabase/types'

interface GameweekSelectorProps {
  gameweeks: GameweekRow[]
  selectedGw: number
}

export function GameweekSelector({ gameweeks, selectedGw }: GameweekSelectorProps) {
  const router = useRouter()

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    router.push(`/admin/tables?gw=${e.target.value}`)
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
