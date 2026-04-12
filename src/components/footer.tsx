/**
 * Site-wide footer.
 *
 * Rendered from the root `app/layout.tsx` so it appears on public, member,
 * and admin surfaces alike. Minimal by design — links to /how-it-works
 * (the public explainer) plus a copyright line.
 */
import Link from 'next/link'

export function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="mt-auto border-t border-slate-800 bg-slate-950">
      <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-400">
        <nav aria-label="Footer">
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 justify-center">
            <li>
              <Link
                href="/how-it-works"
                className="hover:text-pl-green transition"
              >
                How it works
              </Link>
            </li>
            <li>
              <Link
                href="/standings"
                className="hover:text-pl-green transition"
              >
                Standings
              </Link>
            </li>
            <li>
              <Link href="/login" className="hover:text-pl-green transition">
                Member login
              </Link>
            </li>
          </ul>
        </nav>
        <p className="text-slate-500 text-xs">
          &copy; {year} George&apos;s Predictor. 10 years and counting.
        </p>
      </div>
    </footer>
  )
}
