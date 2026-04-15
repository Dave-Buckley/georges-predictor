'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { requestMagicLink, loginWithPassword } from '@/actions/auth'

type Mode = 'magic' | 'password'

export default function LoginForm() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('magic')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<{
    success?: boolean
    error?: string
  } | null>(null)

  async function handleMagic(e: React.FormEvent) {
    e.preventDefault()
    setResult(null)
    setIsSubmitting(true)
    const fd = new FormData()
    fd.set('email', email)
    const response = await requestMagicLink(fd)
    setResult(response)
    setIsSubmitting(false)
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault()
    setResult(null)
    setIsSubmitting(true)
    const fd = new FormData()
    fd.set('email', email)
    fd.set('password', password)
    const response = await loginWithPassword(fd)
    if (response.success) {
      router.push('/dashboard')
      router.refresh()
      return
    }
    setResult(response)
    setIsSubmitting(false)
  }

  if (result?.success && mode === 'magic') {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="rounded-2xl bg-slate-800 border border-slate-700 p-8 text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white">Check your email!</h2>
          <p className="text-slate-300 text-lg">
            We&apos;ve sent you a magic link to log in.
          </p>
          <p className="text-slate-400 text-sm">
            The link expires in 1 hour. Check your spam folder if you don&apos;t see it.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="mb-6 flex rounded-xl bg-slate-800 border border-slate-700 p-1">
        <button
          type="button"
          onClick={() => { setMode('magic'); setResult(null) }}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
            mode === 'magic' ? 'bg-purple-600 text-white' : 'text-slate-300 hover:text-white'
          }`}
        >
          Magic link
        </button>
        <button
          type="button"
          onClick={() => { setMode('password'); setResult(null) }}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
            mode === 'password' ? 'bg-purple-600 text-white' : 'text-slate-300 hover:text-white'
          }`}
        >
          Password
        </button>
      </div>

      <form
        onSubmit={mode === 'magic' ? handleMagic : handlePassword}
        className="space-y-6"
      >
        {/* Email input */}
        <div className="space-y-2">
          <label
            htmlFor="email"
            className="block text-sm font-medium text-slate-300"
          >
            Your email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            disabled={isSubmitting}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-xl bg-slate-800 border border-slate-600 px-4 py-4 text-white text-lg placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 transition"
          />
        </div>

        {mode === 'password' && (
          <div className="space-y-2">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-300"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              disabled={isSubmitting}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-xl bg-slate-800 border border-slate-600 px-4 py-4 text-white text-lg placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 transition"
            />
          </div>
        )}

        {/* Server error */}
        {result?.error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3">
            <p className="text-red-400 text-sm">{result.error}</p>
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 disabled:cursor-not-allowed px-6 py-4 text-white font-semibold text-lg transition focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-slate-900"
        >
          {isSubmitting
            ? mode === 'magic' ? 'Sending link...' : 'Signing in...'
            : mode === 'magic' ? 'Send me a login link' : 'Sign in'}
        </button>

        {/* Signup link */}
        <p className="text-center text-slate-400 text-sm">
          Don&apos;t have an account?{' '}
          <Link
            href="/signup"
            className="text-purple-400 hover:text-purple-300 font-medium transition"
          >
            Join the competition
          </Link>
        </p>

        {/* How it works link — for prospective members */}
        <p className="text-center text-slate-500 text-xs">
          New here?{' '}
          <Link
            href="/how-it-works"
            className="text-pl-green hover:text-white font-medium transition"
          >
            Learn how it works
          </Link>
        </p>
      </form>
    </div>
  )
}
