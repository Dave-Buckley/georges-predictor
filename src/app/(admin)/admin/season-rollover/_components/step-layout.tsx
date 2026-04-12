/**
 * Shared layout for all 8 season-rollover wizard steps.
 *
 * Renders title, body, and a consistent action row (Back / Cancel / children).
 * Used by step-1 through step-8 — keeps step files focused on their own body
 * content + action buttons.
 */
import Link from 'next/link'
import type { ReactNode } from 'react'

interface StepLayoutProps {
  step: number // 1..8
  title: string
  children: ReactNode
  /** Slot for submit / next buttons at the footer. */
  actions?: ReactNode
}

export function StepLayout({ step, title, children, actions }: StepLayoutProps) {
  const prevHref = step > 1 ? `/admin/season-rollover?step=${step - 1}` : null

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <header className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-purple-600">
          Step {step} of 8
        </p>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">{title}</h1>
      </header>

      <section className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
        {children}
      </section>

      <footer className="mt-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {prevHref ? (
            <Link
              href={prevHref}
              className="px-4 py-2 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition"
            >
              ← Back
            </Link>
          ) : (
            <span
              aria-disabled
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-300 cursor-not-allowed"
            >
              ← Back
            </span>
          )}
          <Link
            href="/admin"
            className="text-sm text-gray-500 hover:text-gray-900 underline-offset-2 hover:underline"
          >
            Cancel
          </Link>
        </div>

        <div className="flex items-center gap-3">{actions}</div>
      </footer>
    </div>
  )
}

export default StepLayout
