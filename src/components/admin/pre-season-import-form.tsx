'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { parsePreSeasonPicksText } from '@/lib/import/parse'
import { importPreSeasonPicks } from '@/actions/admin/import'
import type { PreSeasonPicksResult, PreSeasonPickRow } from '@/lib/import/parse'

interface PreSeasonImportFormProps {
  importedCount: number
  memberCount: number
}

export function PreSeasonImportForm({ importedCount, memberCount }: PreSeasonImportFormProps) {
  const router = useRouter()
  const currentYear = new Date().getFullYear()
  const [text, setText] = useState('')
  const [season, setSeason] = useState(currentYear)
  const [preview, setPreview] = useState<PreSeasonPicksResult | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  function handlePreview() {
    if (!text.trim()) {
      setPreview(null)
      setMessage({ type: 'error', text: 'Please paste some data first.' })
      return
    }
    const result = parsePreSeasonPicksText(text)
    setPreview(result)
    setMessage(null)
  }

  function handleConfirmImport() {
    if (!preview || preview.rows.length === 0) return

    const rowsWithSeason = preview.rows.map((row) => ({
      ...row,
      season,
    }))

    startTransition(async () => {
      const result = await importPreSeasonPicks(rowsWithSeason)
      if (result.error) {
        setMessage({ type: 'error', text: result.error })
      } else {
        setMessage({
          type: 'success',
          text: `Successfully imported ${result.imported} pre-season pick${result.imported !== 1 ? 's' : ''}.`,
        })
        setText('')
        setPreview(null)
        router.refresh()
      }
    })
  }

  const hasErrors = preview !== null && preview.errors.length > 0
  const canImport = preview !== null && preview.rows.length > 0 && preview.errors.length === 0

  return (
    <div className="space-y-4">
      {/* Current import status */}
      {importedCount > 0 && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5">
          {importedCount} pre-season pick row{importedCount !== 1 ? 's' : ''} already imported
          {memberCount > 0 && ` (${memberCount} total members)`}.
        </div>
      )}

      {/* Season input */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
          Season year
        </label>
        <input
          type="number"
          value={season}
          onChange={(e) => setSeason(Number(e.target.value))}
          min={2020}
          max={2030}
          className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <p className="text-xs text-gray-400">e.g. 2025 for the 2025/26 season</p>
      </div>

      {/* Textarea */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Paste pre-season picks data
        </label>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setPreview(null)
            setMessage(null)
          }}
          rows={6}
          placeholder={`Name, Top1, Top2, Top3, Top4, 10th, Rel1, Rel2, Rel3, Prom1, Prom2, Prom3, PlayoffWinner\nBig Steve, Man City, Arsenal, Liverpool, Chelsea, Wolves, Luton, Burnley, Sheffield Utd, Leeds, Ipswich, Southampton, Southampton`}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 resize-y"
        />
        <p className="text-xs text-gray-400 mt-1">
          13 columns: Name, then Top 4 picks (4), 10th place (1), Relegated (3), Promoted (3), Playoff winner (1)
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handlePreview}
          disabled={!text.trim() || isPending}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Preview
        </button>
        <button
          type="button"
          onClick={handleConfirmImport}
          disabled={!canImport || isPending}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? 'Importing...' : 'Confirm Import'}
        </button>
      </div>

      {/* Status message */}
      {message && (
        <div
          className={`text-sm rounded-lg px-4 py-3 ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Preview table */}
      {preview !== null && (
        <div className="space-y-2">
          {preview.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
              {preview.errors.map((err, i) => (
                <p key={i} className="text-sm text-red-700">
                  {err.line > 0 ? (
                    <span className="font-medium">Line {err.line}: </span>
                  ) : null}
                  {err.message}
                </p>
              ))}
            </div>
          )}

          {preview.rows.length > 0 && (
            <PreSeasonPicksPreviewTable rows={preview.rows} season={season} />
          )}
        </div>
      )}

      {preview !== null && hasErrors && (
        <p className="text-sm text-red-600">Fix the errors above before importing.</p>
      )}
    </div>
  )
}

// ─── Inline preview table for pre-season picks ────────────────────────────────

function PreSeasonPicksPreviewTable({
  rows,
  season,
}: {
  rows: PreSeasonPickRow[]
  season: number
}) {
  return (
    <div className="overflow-x-auto">
      <p className="text-xs text-gray-500 mb-1.5">
        {rows.length} row{rows.length !== 1 ? 's' : ''} ready to import (Season {season})
      </p>
      <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden min-w-[640px]">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-3 py-2 text-left font-semibold text-gray-600">Name</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-600">Top 4</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-600">10th</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-600">Relegated</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-600">Promoted</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-600">Playoff W</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="px-3 py-2 font-medium text-gray-900">{row.member_name}</td>
              <td className="px-3 py-2 text-gray-600">{row.top4.join(', ')}</td>
              <td className="px-3 py-2 text-gray-600">{row.tenth_place}</td>
              <td className="px-3 py-2 text-gray-600">{row.relegated.join(', ')}</td>
              <td className="px-3 py-2 text-gray-600">{row.promoted.join(', ')}</td>
              <td className="px-3 py-2 text-gray-600">{row.promoted_playoff_winner}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
