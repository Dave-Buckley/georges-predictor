'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { loginWithLinkToken } from '@/actions/auth'

export default function LinkLoginForm({ tokenHash }: { tokenHash: string | null }) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(
    tokenHash ? null : 'This login link is incomplete. Ask George to send you a new one.',
  )

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!tokenHash) return
    setError(null)
    setIsSubmitting(true)
    const fd = new FormData()
    fd.set('token_hash', tokenHash)
    const response = await loginWithLinkToken(fd)
    if (response.success) {
      router.push('/dashboard')
      router.refresh()
      return
    }
    setIsSubmitting(false)
    setError(response.error ?? 'Something went wrong. Please try again.')
  }

  return (
    <form onSubmit={handleLogin} className="space-y-6">
      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {tokenHash && (
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 disabled:cursor-not-allowed px-6 py-4 text-white font-semibold text-lg transition focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-slate-900"
        >
          {isSubmitting ? 'Logging in...' : 'Log me in'}
        </button>
      )}

      <p className="text-center text-slate-400 text-sm">
        Link not working?{' '}
        <Link
          href="/login"
          className="text-purple-400 hover:text-purple-300 font-medium transition"
        >
          Log in with your email instead
        </Link>
      </p>
    </form>
  )
}
