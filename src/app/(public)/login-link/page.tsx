import type { Metadata } from 'next'
import LinkLoginForm from '@/components/auth/link-login-form'
import { BrandLogo } from '@/components/brand/brand-logo'

export const metadata: Metadata = {
  title: 'Log in — King Predictor',
  description: 'Log in to King Predictor with the link George sent you.',
  robots: { index: false, follow: false },
}

/**
 * Landing page for the one-time login links George sends on WhatsApp
 * (Admin → Members → Actions → Login link). Deliberately does NOT log in on
 * load — WhatsApp fetches links to build previews, which would use the link up.
 * The member taps "Log me in" instead.
 */
export default async function LoginLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string }>
}) {
  const { token_hash } = await searchParams

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-16">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <BrandLogo size={96} priority />
          </div>
          <h1 className="text-3xl font-bold text-white">Welcome back</h1>
          <p className="text-slate-400 text-lg">
            Tap the button below to log in.
          </p>
        </div>

        <LinkLoginForm tokenHash={token_hash ?? null} />
      </div>
    </div>
  )
}
