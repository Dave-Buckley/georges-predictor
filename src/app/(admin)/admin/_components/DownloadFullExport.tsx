'use client'

/**
 * Client button for the admin "Download full data export" action.
 *
 * Simple anchor with the `download` attribute — the browser downloads the
 * XLSX directly from /api/reports/full-export (session cookie auth). No
 * fetch+blob dance needed; the route handler sets Content-Disposition so
 * the browser saves rather than navigating.
 */
import Link from 'next/link'

export function DownloadFullExport() {
  return (
    <Link
      href="/api/reports/full-export"
      prefetch={false}
      download
      className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white hover:border-purple-400 hover:bg-purple-50 transition p-5"
    >
      <div className="space-y-1">
        <p className="font-semibold text-gray-900 group-hover:text-purple-900">
          Download full data export
        </p>
        <p className="text-xs text-gray-500 group-hover:text-purple-700">
          Disaster-recovery snapshot — open in Excel to run the competition
          manually if needed.
        </p>
      </div>
      <span className="ml-4 flex-shrink-0 text-sm font-medium text-purple-600 group-hover:text-purple-700">
        Download
        <span className="ml-1">&rarr;</span>
      </span>
    </Link>
  )
}
