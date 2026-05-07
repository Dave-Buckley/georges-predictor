'use client'

/**
 * Inline password set/change form for the /profile page.
 *
 * Members who originally signed in with the email code (OTP) can register a
 * password here without an email round-trip — the active session lets us call
 * `supabase.auth.updateUser({ password })` directly.
 *
 * Same control also doubles as "change password" for members who already
 * have one set.
 */
import { useState, useTransition } from 'react'

import { createClient } from '@/lib/supabase/client'

export function SetPasswordForm() {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

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
        setError(updateError.message)
      } else {
        setSuccess(true)
        setPassword('')
        setConfirm('')
      }
    })
  }

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900 overflow-hidden">
      {!open ? (
        <div className="p-5 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-sm font-medium text-white">
              Set or change your password
            </p>
            <p className="text-xs text-slate-400">
              Sign in with email + password instead of waiting for a code each
              time. You can keep using the email code as well.
            </p>
            {success && (
              <p className="text-xs text-green-400 pt-1">
                Password saved. You can now use it to sign in.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(true)
              setSuccess(false)
              setError(null)
            }}
            className="flex-shrink-0 rounded-lg bg-purple-600 hover:bg-purple-500 px-4 py-2 text-sm font-medium text-white transition"
          >
            {success ? 'Change again' : 'Set password'}
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="p-5 space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="profile-password"
              className="block text-xs font-medium text-slate-300"
            >
              New password
            </label>
            <input
              id="profile-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isPending}
              required
              minLength={6}
              placeholder="At least 6 characters"
              className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 transition"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="profile-password-confirm"
              className="block text-xs font-medium text-slate-300"
            >
              Confirm password
            </label>
            <input
              id="profile-password-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={isPending}
              required
              minLength={6}
              placeholder="Type it again"
              className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 transition"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2">
              <p className="text-red-400 text-xs">{error}</p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 disabled:cursor-not-allowed px-4 py-2 text-sm font-medium text-white transition"
            >
              {isPending ? 'Saving...' : 'Save password'}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setPassword('')
                setConfirm('')
                setError(null)
              }}
              disabled={isPending}
              className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 transition disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
