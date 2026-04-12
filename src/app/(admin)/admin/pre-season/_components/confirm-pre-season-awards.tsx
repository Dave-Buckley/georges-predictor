'use client'

/**
 * Per-member pre-season award confirmation (Phase 9 Plan 03).
 *
 * Mirrors the confirm-bonus-awards idiom: one row per member with
 * editable awarded_points, per-row "Apply" + bulk "Apply all" actions.
 * Flag chips surface all_top4_correct / all_relegated_correct /
 * all_promoted_correct / all_correct_overall for visual celebration.
 */

import { useState, useTransition } from 'react'
import { CheckCircle, AlertCircle, Trophy } from 'lucide-react'
import {
  confirmPreSeasonAward,
  bulkConfirmPreSeasonAwards,
} from '@/actions/admin/pre-season'
import type { PreSeasonAwardFlags } from '@/lib/supabase/types'

export interface AwardRow {
  member_id: string
  member_name: string
  calculated_points: number
  awarded_points: number
  flags: PreSeasonAwardFlags
  confirmed: boolean
}

interface Props {
  season: number
  awards: AwardRow[]
}

function FlagChips({ flags }: { flags: PreSeasonAwardFlags }) {
  if (flags.all_correct_overall) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
        <Trophy className="w-3 h-3" />
        ALL 12 CORRECT
      </span>
    )
  }
  const chips: string[] = []
  if (flags.all_top4_correct) chips.push('All Top 4')
  if (flags.all_relegated_correct) chips.push('All Relegated')
  if (flags.all_promoted_correct) chips.push('All Promoted')
  if (chips.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1">
      {chips.map((c) => (
        <span
          key={c}
          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700"
        >
          {c} ✓
        </span>
      ))}
    </div>
  )
}

function AwardRowItem({
  season,
  row,
}: {
  season: number
  row: AwardRow
}) {
  const [value, setValue] = useState<number>(row.awarded_points)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [applied, setApplied] = useState(row.confirmed)

  async function handleApply() {
    setBusy(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.set('member_id', row.member_id)
      fd.set('season', String(season))
      if (value !== row.calculated_points) {
        fd.set('override_points', String(value))
      }
      const result = await confirmPreSeasonAward(fd)
      if ('error' in result) {
        setError(result.error)
      } else {
        setApplied(true)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <tr className={applied ? 'bg-green-50' : 'bg-white hover:bg-gray-50'}>
      <td className="px-4 py-3 font-medium text-gray-900">{row.member_name}</td>
      <td className="px-4 py-3 text-sm text-gray-600">
        <span className="font-semibold text-gray-900">{row.calculated_points}</span>
        <span className="text-gray-400 text-xs"> pts calculated</span>
      </td>
      <td className="px-4 py-3">
        <FlagChips flags={row.flags} />
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          disabled={applied || busy}
          min={0}
          className="w-24 px-2 py-1 rounded-lg border border-gray-300 text-sm disabled:bg-gray-100"
        />
      </td>
      <td className="px-4 py-3 text-right">
        {applied ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
            <CheckCircle className="w-3.5 h-3.5" />
            Confirmed
          </span>
        ) : (
          <button
            type="button"
            onClick={handleApply}
            disabled={busy}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 text-xs font-medium disabled:opacity-50"
          >
            {busy ? 'Applying…' : 'Apply'}
          </button>
        )}
        {error && (
          <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {error}
          </p>
        )}
      </td>
    </tr>
  )
}

export function ConfirmPreSeasonAwards({ season, awards }: Props) {
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkError, setBulkError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const unconfirmed = awards.filter((a) => !a.confirmed)

  async function handleBulk() {
    setBulkBusy(true)
    setBulkError(null)
    try {
      const fd = new FormData()
      fd.set('season', String(season))
      const result = await bulkConfirmPreSeasonAwards(fd)
      if ('error' in result) {
        setBulkError(result.error)
      } else {
        // revalidatePath will refresh; trigger a router refresh via transition
        startTransition(() => {
          window.location.reload()
        })
      }
    } finally {
      setBulkBusy(false)
    }
  }

  if (awards.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
        <p className="text-gray-500 font-medium">No pre-season awards yet</p>
        <p className="text-gray-400 text-sm mt-1">
          Run &ldquo;Calculate pre-season awards&rdquo; once actuals are locked.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-900">Pre-season awards</h3>
          {unconfirmed.length > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
              {unconfirmed.length} pending
            </span>
          )}
        </div>
        {unconfirmed.length > 0 && (
          <button
            type="button"
            onClick={handleBulk}
            disabled={bulkBusy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 text-xs font-medium disabled:opacity-50"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            {bulkBusy ? 'Applying…' : `Apply all (${unconfirmed.length})`}
          </button>
        )}
      </div>

      {bulkError && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{bulkError}</span>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Member
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Calculated
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Flags
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Awarded
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {awards.map((row) => (
              <AwardRowItem key={row.member_id} season={season} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
