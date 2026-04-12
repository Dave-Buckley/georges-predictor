'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { parseImportText } from '@/lib/import/parse'
import { importMembers, clearImportedMembers } from '@/actions/admin/import'
import { ImportPreviewTable } from '@/components/admin/import-preview-table'
import type { ImportResult } from '@/lib/import/parse'

interface ImportFormProps {
  importedCount: number
  registeredCount: number
}

export function ImportForm({ importedCount, registeredCount }: ImportFormProps) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<ImportResult | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showClearDialog, setShowClearDialog] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handlePreview() {
    if (!text.trim()) {
      setPreview(null)
      setMessage({ type: 'error', text: 'Please paste some data first.' })
      return
    }
    const result = parseImportText(text)
    setPreview(result)
    setMessage(null)
  }

  function handleConfirmImport() {
    if (!preview || preview.rows.length === 0) return

    startTransition(async () => {
      const result = await importMembers(preview.rows)
      if (result.error) {
        setMessage({ type: 'error', text: result.error })
      } else {
        setMessage({
          type: 'success',
          text: `Successfully imported ${result.imported} member${result.imported !== 1 ? 's' : ''}.`,
        })
        setText('')
        setPreview(null)
        router.refresh()
      }
    })
  }

  function handleClearConfirm() {
    setShowClearDialog(false)
    startTransition(async () => {
      const result = await clearImportedMembers()
      if (result.error) {
        setMessage({ type: 'error', text: result.error })
      } else {
        setMessage({
          type: 'success',
          text: `Cleared ${result.deleted} unregistered placeholder${result.deleted !== 1 ? 's' : ''}.`,
        })
        router.refresh()
      }
    })
  }

  const hasErrors = preview !== null && preview.errors.length > 0
  const canImport = preview !== null && preview.rows.length > 0 && preview.errors.length === 0

  return (
    <div className="space-y-4">
      {/* Textarea */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Paste member data
        </label>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setPreview(null)
            setMessage(null)
          }}
          rows={8}
          placeholder={`Paste member data here (one per line):\nBig Steve, 340\nDan The Man, 280\nSarah, 150`}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 resize-y"
        />
        <p className="text-xs text-gray-400 mt-1">
          Format: Name, Points (comma or tab separated)
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
        {importedCount > 0 && (
          <button
            type="button"
            onClick={() => setShowClearDialog(true)}
            disabled={isPending}
            className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Clear Import ({importedCount})
          </button>
        )}
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
        <ImportPreviewTable rows={preview.rows} errors={preview.errors} />
      )}

      {preview !== null && hasErrors && (
        <p className="text-sm text-red-600">Fix the errors above before importing.</p>
      )}

      {/* Clear confirmation dialog */}
      {showClearDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowClearDialog(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Clear imported members?</h3>
            <p className="text-sm text-gray-600 mb-1">
              This will remove{' '}
              <span className="font-semibold text-red-600">{importedCount}</span>{' '}
              unregistered placeholder{importedCount !== 1 ? 's' : ''}.
            </p>
            {registeredCount > 0 && (
              <p className="text-sm text-gray-500 mb-4">
                <span className="font-medium text-green-700">{registeredCount} member{registeredCount !== 1 ? 's' : ''}</span>{' '}
                who {registeredCount !== 1 ? 'have' : 'has'} already signed up will NOT be affected.
              </p>
            )}
            <div className="flex gap-3 justify-end mt-4">
              <button
                type="button"
                onClick={() => setShowClearDialog(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearConfirm}
                className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
