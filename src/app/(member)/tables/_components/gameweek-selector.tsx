'use client'

import { useRouter } from 'next/navigation'
import type { GameweekRow } from '@/lib/supabase/types'

interface Props {
  gameweeks: Pick<GameweekRow, 'id' | 'number' | 'status'>[]
  selectedGw: number
}

export function GameweekSelector({ gameweeks, selectedGw }: Props) {
  const router = useRouter()

  return (
    <select
      value={selectedGw}
      onChange={(e) => router.push(`/tables?gw=${e.target.value}`)}
      className="bg-slate-900 border border-slate-700 text-slate-100 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent cursor-pointer"
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
