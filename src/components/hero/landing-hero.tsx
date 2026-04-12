/**
 * LandingHero — large hero banner for the `/` landing page.
 *
 * Pure inline-SVG + CSS gradient. Wordmark, tagline, and an optional
 * sign-in CTA (rendered when no session is supplied — server component
 * decides whether to pass `showCta`).
 *
 * Zero external assets, zero image hosting.
 */
import Link from 'next/link'

interface LandingHeroProps {
  /** When true, render the "Sign in" CTA button. Default true. */
  showCta?: boolean
}

export function LandingHero({ showCta = true }: LandingHeroProps) {
  return (
    <section
      className="relative overflow-hidden rounded-b-2xl bg-gradient-to-br from-pl-purple via-pl-purple-light to-pl-purple-dark text-white px-6 py-12 sm:py-20"
      aria-label="George's Predictor"
    >
      <div className="relative z-10 max-w-4xl mx-auto text-center sm:text-left space-y-4">
        <h1 className="text-3xl sm:text-6xl font-extrabold tracking-tight text-white">
          George&apos;s Predictor
        </h1>
        <p className="text-pl-green text-base sm:text-xl font-medium max-w-2xl">
          Weekly Premier League predictions with your mates. 10 years strong.
        </p>
        {showCta && (
          <div className="flex flex-wrap justify-center sm:justify-start gap-3 pt-2">
            <Link
              href="/login"
              className="inline-block rounded-xl bg-pl-green px-6 py-3 font-semibold text-pl-purple hover:bg-white transition"
            >
              Sign in
            </Link>
            <Link
              href="/how-it-works"
              className="inline-block rounded-xl border border-pl-green px-6 py-3 font-semibold text-pl-green hover:bg-pl-green/10 transition"
            >
              How it works
            </Link>
          </div>
        )}
      </div>

      {/* Stadium silhouette strip along the bottom */}
      <svg
        viewBox="0 0 800 120"
        className="absolute inset-x-0 bottom-0 w-full h-16 sm:h-24 pointer-events-none"
        aria-hidden="true"
        preserveAspectRatio="none"
      >
        <path
          d="M 0 120 L 0 80 L 40 70 L 80 75 L 120 55 L 180 60 L 240 40 L 300 50 L 360 30 L 420 45 L 480 25 L 540 40 L 600 20 L 660 35 L 720 45 L 760 55 L 800 60 L 800 120 Z"
          fill="var(--color-pl-green)"
          opacity="0.18"
        />
        <path
          d="M 0 120 L 0 95 L 80 92 L 160 98 L 240 88 L 320 95 L 400 82 L 480 92 L 560 86 L 640 95 L 720 88 L 800 92 L 800 120 Z"
          fill="var(--color-pl-green)"
          opacity="0.12"
        />
      </svg>
    </section>
  )
}
