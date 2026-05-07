'use client'

/**
 * Member-side reset / set password page.
 *
 * Reached when a member clicks the link in a password-recovery email
 * (sent by `requestPasswordReset` in src/actions/auth.ts). The Supabase
 * browser client picks up the recovery code from the URL and establishes
 * a temporary recovery session; we then call `updateUser({ password })`
 * to persist the new password.
 *
 * Mirrors the admin variant at /admin/reset-password but uses the member
 * theme (slate/purple on dark) and links back to /login on success.
 */
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function MemberResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    startTransition(async () => {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      })

      if (updateError) {
        setError(
          updateError.message.includes('session')
            ? 'Your reset link has expired. Request a new one from the login page.'
            : updateError.message,
        )
      } else {
        setSuccess(true)
      }
    })
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-16">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-bold text-white">
            {success ? 'Password set' : 'Set your password'}
          </h1>
          {!success && (
            <p className="text-slate-400 text-sm">
              Pick a password you&apos;ll remember. From now on you can sign in
              with your email + password instead of waiting for a code.
            </p>
          )}
        </div>

        <div className="rounded-2xl bg-slate-900 border border-slate-700 p-6">
          {success ? (
            <div className="space-y-5">
              <div className="rounded-xl bg-green-900/30 border border-green-700/50 p-4 text-sm text-green-200">
                Your password has been saved. You can now sign in with email +
                password.
              </div>
              <Link
                href="/login"
                className="block w-full rounded-xl bg-purple-600 hover:bg-purple-500 px-6 py-4 text-white font-semibold text-lg transition text-center"
              >
                Go to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-slate-300"
                >
                  New password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isPending}
                  required
                  minLength={6}
                  placeholder="At least 6 characters"
                  className="w-full rounded-xl bg-slate-800 border border-slate-600 px-4 py-4 text-white text-lg placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 transition"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="confirm"
                  className="block text-sm font-medium text-slate-300"
                >
                  Confirm password
                </label>
                <input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  disabled={isPending}
                  required
                  minLength={6}
                  placeholder="Type it again"
                  className="w-full rounded-xl bg-slate-800 border border-slate-600 px-4 py-4 text-white text-lg placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 transition"
                />
              </div>

              {error && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isPending}
                className="w-full rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 disabled:cursor-not-allowed px-6 py-4 text-white font-semibold text-lg transition focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-slate-900"
              >
                {isPending ? 'Saving...' : 'Save password'}
              </button>

              <Link
                href="/login"
                className="block w-full text-center text-slate-400 hover:text-white text-sm transition"
              >
                ← Back to sign in
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
