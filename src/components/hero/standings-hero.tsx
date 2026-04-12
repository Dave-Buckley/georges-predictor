/**
 * StandingsHero — compact hero banner for /standings.
 *
 * Pure inline-SVG + CSS gradient. Zero external assets, zero image hosting.
 * PL-purple gradient background, PL-green accent stadium-silhouette strip
 * along the bottom edge.
 */

export function StandingsHero() {
  return (
    <section
      className="relative overflow-hidden rounded-b-2xl bg-gradient-to-br from-pl-purple via-pl-purple-light to-pl-purple-dark text-white px-6 py-8 sm:py-12"
      aria-label="League standings header"
    >
      <div className="relative z-10 max-w-4xl mx-auto">
        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
          League Standings
        </h1>
        <p className="mt-2 text-pl-green text-sm sm:text-base font-medium">
          Live Premier League predictor standings — season 2025/26.
        </p>
      </div>

      {/* Stadium silhouette strip */}
      <svg
        viewBox="0 0 800 80"
        className="absolute inset-x-0 bottom-0 w-full h-12 sm:h-16 pointer-events-none"
        aria-hidden="true"
        preserveAspectRatio="none"
      >
        <path
          d="M 0 80 L 0 55 L 60 50 L 90 40 L 140 45 L 180 30 L 230 35 L 280 20 L 340 25 L 400 15 L 460 25 L 520 20 L 570 30 L 620 35 L 670 25 L 720 35 L 770 40 L 800 50 L 800 80 Z"
          fill="var(--color-pl-green)"
          opacity="0.18"
        />
        <path
          d="M 0 80 L 0 65 L 80 62 L 160 68 L 240 60 L 320 65 L 400 55 L 480 62 L 560 58 L 640 65 L 720 60 L 800 65 L 800 80 Z"
          fill="var(--color-pl-green)"
          opacity="0.12"
        />
      </svg>
    </section>
  )
}
