/**
 * Displayed to members whose account is still awaiting approval.
 * Per CONTEXT.md: "Pending members get read-only access (can browse league table,
 * fixtures) but cannot submit predictions."
 */
export default function PendingNotice() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Notice card */}
      <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className="mt-0.5 flex-shrink-0">
            <svg
              className="w-6 h-6 text-amber-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-amber-300">
              Account Pending Approval
            </h2>
            <p className="text-amber-200/80">
              Your registration is being reviewed. You can browse the site in the
              meantime, but predictions will be available once your account is approved.
            </p>
            <p className="text-amber-200/60 text-sm">
              Please contact George via WhatsApp to confirm your registration if
              you haven&apos;t already.
            </p>
          </div>
        </div>
      </div>

      {/* Read-only info */}
      <div className="rounded-2xl bg-slate-800 border border-slate-700 p-6 space-y-3">
        <h3 className="font-semibold text-slate-300">While you wait...</h3>
        <ul className="space-y-2 text-slate-400 text-sm">
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Browse the league table
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            View upcoming fixtures
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Submit predictions (available once approved)
          </li>
        </ul>
      </div>
    </div>
  )
}
