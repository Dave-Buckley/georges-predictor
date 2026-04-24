'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  requestMagicLink,
  verifyLoginCode,
  loginWithPassword,
} from '@/actions/auth'

type Mode = 'magic' | 'password'
type MagicStep = 'enter-email' | 'enter-code'

export default function LoginForm() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('magic')
  const [magicStep, setMagicStep] = useState<MagicStep>('enter-email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<{
    success?: boolean
    error?: string
  } | null>(null)

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault()
    setResult(null)
    setIsSubmitting(true)
    const fd = new FormData()
    fd.set('email', email)
    const response = await requestMagicLink(fd)
    setIsSubmitting(false)
    if (response.success) {
      setMagicStep('enter-code')
      setResult(null)
      return
    }
    setResult(response)
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    setResult(null)
    setIsSubmitting(true)
    const fd = new FormData()
    fd.set('email', email)
    fd.set('token', code.trim())
    const response = await verifyLoginCode(fd)
    if (response.success) {
      router.push('/dashboard')
      router.refresh()
      return
    }
    setIsSubmitting(false)
    setResult(response)
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

  function handleStartOver() {
    setMagicStep('enter-email')
    setCode('')
    setResult(null)
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="mb-6 flex rounded-xl bg-slate-800 border border-slate-700 p-1">
        <button
          type="button"
          onClick={() => {
            setMode('magic')
            setResult(null)
          }}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
            mode === 'magic' ? 'bg-purple-600 text-white' : 'text-slate-300 hover:text-white'
          }`}
        >
          Email code
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('password')
            setResult(null)
          }}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
            mode === 'password' ? 'bg-purple-600 text-white' : 'text-slate-300 hover:text-white'
          }`}
        >
          Password
        </button>
      </div>

      {mode === 'magic' && magicStep === 'enter-email' && (
        <form onSubmit={handleRequestCode} className="space-y-6">
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

          {result?.error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3">
              <p className="text-red-400 text-sm">{result.error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 disabled:cursor-not-allowed px-6 py-4 text-white font-semibold text-lg transition focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-slate-900"
          >
            {isSubmitting ? 'Sending code...' : 'Email me a login code'}
          </button>

          <p className="text-center text-slate-400 text-sm">
            Don&apos;t have an account?{' '}
            <Link
              href="/signup"
              className="text-purple-400 hover:text-purple-300 font-medium transition"
            >
              Join the competition
            </Link>
          </p>

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
      )}

      {mode === 'magic' && magicStep === 'enter-code' && (
        <form onSubmit={handleVerifyCode} className="space-y-6">
          <div className="rounded-xl bg-slate-800 border border-slate-700 p-5 text-center space-y-2">
            <p className="text-white font-semibold">Check your email</p>
            <p className="text-slate-300 text-sm">
              We sent a 6-digit code to{' '}
              <span className="text-white font-medium break-all">{email}</span>
            </p>
            <p className="text-slate-500 text-xs">
              If you also see a login link in the email, that still works too.
            </p>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="code"
              className="block text-sm font-medium text-slate-300"
            >
              Enter the 6-digit code
            </label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              placeholder="123456"
              disabled={isSubmitting}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              className="w-full rounded-xl bg-slate-800 border border-slate-600 px-4 py-4 text-white text-2xl tracking-[0.5em] text-center font-mono placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 transition"
            />
          </div>

          {result?.error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3">
              <p className="text-red-400 text-sm">{result.error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || code.length !== 6}
            className="w-full rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 disabled:cursor-not-allowed px-6 py-4 text-white font-semibold text-lg transition focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-slate-900"
          >
            {isSubmitting ? 'Verifying...' : 'Log in'}
          </button>

          <button
            type="button"
            onClick={handleStartOver}
            className="w-full text-center text-slate-400 hover:text-white text-sm transition"
          >
            ← Use a different email
          </button>
        </form>
      )}

      {mode === 'password' && (
        <form onSubmit={handlePassword} className="space-y-6">
          <div className="space-y-2">
            <label
              htmlFor="email-pw"
              className="block text-sm font-medium text-slate-300"
            >
              Your email address
            </label>
            <input
              id="email-pw"
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

          {result?.error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3">
              <p className="text-red-400 text-sm">{result.error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 disabled:cursor-not-allowed px-6 py-4 text-white font-semibold text-lg transition focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-slate-900"
          >
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>

          <p className="text-center text-slate-400 text-sm">
            Don&apos;t have an account?{' '}
            <Link
              href="/signup"
              className="text-purple-400 hover:text-purple-300 font-medium transition"
            >
              Join the competition
            </Link>
          </p>
        </form>
      )}
    </div>
  )
}
