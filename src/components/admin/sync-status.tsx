'use client'

import { useState, useTransition } from 'react'
import { RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react'
import { triggerSync } from '@/actions/admin/fixtures'
import type { SyncLogRow } from '@/lib/supabase/types'

interface SyncStatusProps {
  lastSync: SyncLogRow | null
}

function getRelativeTime(dateStr: string): string {
  const now = new Date()
  const then = new Date(dateStr)
  const diffMs = now.getTime() - then.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSeconds < 60) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

export function SyncStatus({ lastSync }: SyncStatusProps) {
  const [isPending, startTransition] = useTransition()
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSync = () => {
    setSyncMessage(null)
    startTransition(async () => {
      const result = await triggerSync()

      if ('error' in result) {
        setSyncMessage({ type: 'error', text: result.error })
        return
      }

      if (!result.success) {
        const errorText = result.errors.length > 0 ? result.errors[0] : 'Sync failed'
        setSyncMessage({ type: 'error', text: errorText })
        return
      }

      const msg = result.fixtures_updated > 0
        ? `Synced ${result.fixtures_updated} fixture${result.fixtures_updated !== 1 ? 's' : ''}`
        : 'Already up to date'
      const rescheduledNote = result.rescheduled.length > 0
        ? ` — ${result.rescheduled.length} rescheduled`
        : ''

      setSyncMessage({ type: 'success', text: msg + rescheduledNote })

      // Clear success message after 5s
      setTimeout(() => setSyncMessage(null), 5000)
    })
  }

  const hasLastSync = lastSync !== null
  const syncFailed = hasLastSync && !lastSync.success

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-gray-900 text-white rounded-2xl px-5 py-4 shadow-sm">
      {/* Left: sync status info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {syncFailed ? (
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
          )}
          <span className="text-sm font-medium text-white/90">
            {hasLastSync
              ? `Last synced: ${getRelativeTime(lastSync.synced_at)}`
              : 'No syncs yet — click Sync Now to fetch fixtures'}
          </span>
        </div>

        {syncFailed && lastSync.error_message && (
          <p className="mt-1 text-xs text-amber-300 ml-6 truncate" title={lastSync.error_message}>
            Error: {lastSync.error_message}
          </p>
        )}

        {syncMessage && (
          <p
            className={`mt-1 text-xs ml-6 ${
              syncMessage.type === 'success' ? 'text-green-300' : 'text-red-300'
            }`}
          >
            {syncMessage.text}
          </p>
        )}
      </div>

      {/* Right: Sync Now button */}
      <button
        type="button"
        onClick={handleSync}
        disabled={isPending}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-colors disabled:opacity-60 flex-shrink-0"
      >
        <RefreshCw className={`w-4 h-4 ${isPending ? 'animate-spin' : ''}`} />
        {isPending ? 'Syncing…' : 'Sync Now'}
      </button>
    </div>
  )
}
