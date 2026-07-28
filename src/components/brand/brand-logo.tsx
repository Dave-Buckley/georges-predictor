/**
 * BrandLogo — the King Predictor logo mark used consistently across the app.
 *
 * The logo image (`public/king-predictor-logo.jpg`) is a self-contained badge
 * (crown + "KING PREDICTOR" wordmark + ball on a dark purple field). It already
 * reads as a wordmark on its own, so `showWordmark` is optional and off by
 * default for large/standalone uses (e.g. the hero). Small header uses turn it
 * on so the tiny badge is paired with legible text.
 */
import Image from 'next/image'
import Link from 'next/link'

interface BrandLogoProps {
  /** Wrap the logo in a link to this href (e.g. "/" or "/dashboard"). */
  href?: string
  /** Pixel size of the square logo mark. Default 40. */
  size?: number
  /** Render the "King Predictor" text wordmark beside the mark. Default false. */
  showWordmark?: boolean
  /** Prioritise loading (use for above-the-fold marks like headers/hero). */
  priority?: boolean
  className?: string
}

export function BrandLogo({
  href,
  size = 40,
  showWordmark = false,
  priority = false,
  className = '',
}: BrandLogoProps) {
  const content = (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Image
        src="/king-predictor-logo.jpg"
        alt="King Predictor"
        width={size}
        height={size}
        priority={priority}
        className="rounded-lg ring-1 ring-white/10 shadow-lg shadow-purple-900/30"
      />
      {showWordmark && (
        <span className="font-bold text-xl tracking-tight text-white">
          King Predictor
        </span>
      )}
    </span>
  )

  if (href) {
    return (
      <Link
        href={href}
        aria-label="King Predictor — home"
        className="inline-flex items-center hover:opacity-90 transition"
      >
        {content}
      </Link>
    )
  }

  return content
}
