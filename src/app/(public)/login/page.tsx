import type { Metadata } from 'next'
import LoginForm from '@/components/auth/login-form'

export const metadata: Metadata = {
  title: "Member Login — George's Predictor",
  description: "Log in to George's Predictor prediction competition.",
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const showAuthError = error === 'auth'

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-16">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-bold text-white">
            Welcome back
          </h1>
          <p className="text-slate-400 text-lg">
            Enter your email — we&apos;ll send you a login code.
          </p>
          <p className="text-slate-500 text-sm">
            No password required. Just type the code from your email.
          </p>
        </div>

        {showAuthError && (
          <div className="rounded-xl bg-amber-900/30 border border-amber-700/50 p-4 text-sm text-amber-200 leading-relaxed space-y-2">
            <p className="font-semibold">That login link didn&apos;t work.</p>
            <p>
              This usually happens because your email provider (Outlook, AOL,
              Yahoo) scanned the link before you tapped it, or because the link
              opened inside your email app instead of your normal browser.
            </p>
            <p>
              <span className="font-semibold">Try this:</span> request a new
              link below, then <span className="font-semibold">long-press</span>{' '}
              it in your email → <span className="font-semibold">Copy link</span>{' '}
              → paste into Safari or Chrome and press Go.
            </p>
          </div>
        )}

        {/* Login form */}
        <LoginForm />
      </div>
    </div>
  )
}
