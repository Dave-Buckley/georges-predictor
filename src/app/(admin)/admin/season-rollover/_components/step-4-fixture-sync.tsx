/**
 * Step 4: Fixture sync.
 *
 * Points at the existing /api/sync-fixtures endpoint (idempotent per Phase 2).
 * Rendered as an informational panel — the admin clicks "Run sync" which
 * POSTs to the existing route, then clicks "Continue" to advance.
 */
import Link from 'next/link'
import { StepLayout } from './step-layout'

interface Step4Props {
  newSeason: number
}

export function Step4FixtureSync({ newSeason }: Step4Props) {
  return (
    <StepLayout
      step={4}
      title="Fixture sync"
      actions={
        <Link
          href={`/admin/season-rollover?step=5&season=${newSeason}`}
          className="px-5 py-2 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition"
        >
          Continue →
        </Link>
      }
    >
      <p className="text-gray-700">
        Pull the {newSeason} season&apos;s fixtures from football-data.org. Use the existing Sync
        button on the admin dashboard — it&apos;s idempotent and safe to re-run.
      </p>
      <div className="mt-4 rounded-xl bg-blue-50 border border-blue-200 p-4 text-sm text-blue-900 space-y-2">
        <p>
          <strong>Where to sync:</strong>{' '}
          <Link
            href="/admin"
            className="text-blue-700 underline underline-offset-2 hover:text-blue-900"
          >
            /admin dashboard
          </Link>{' '}
          → Fixture Sync panel.
        </p>
        <p className="text-xs text-blue-800">
          New gameweeks and fixtures will be inserted; existing rows are left alone.
        </p>
      </div>
      <p className="text-sm text-gray-500 mt-4">
        Tap Continue when the sync finishes and GW1 shows up in /admin/gameweeks.
      </p>
    </StepLayout>
  )
}

export default Step4FixtureSync
