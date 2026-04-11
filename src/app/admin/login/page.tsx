'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { adminLogin, resetAdminPassword } from '@/actions/admin/auth'

interface AdminLoginInput {
  email: string
  password: string
}

export default function AdminLoginPage() {
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const [showReset, setShowReset] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AdminLoginInput>()

  function onSubmit(data: AdminLoginInput) {
    setServerError(null)
    startTransition(async () => {
      try {
        const formData = new FormData()
        formData.set('email', data.email)
        formData.set('password', data.password)
        const result = await adminLogin(formData)
        if (result?.error) setServerError(result.error)
      } catch (err: unknown) {
        if (err instanceof Error && err.message.startsWith('NEXT_REDIRECT')) return
        setServerError('Something went wrong. Please try again.')
      }
    })
  }

  function onReset() {
    setServerError(null)
    startTransition(async () => {
      const formData = new FormData()
      formData.set('email', resetEmail)
      const result = await resetAdminPassword(formData)
      if (result?.error) setServerError(result.error)
      if (result?.success) setResetSent(true)
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            George&apos;s Predictor
          </h1>
          <p className="text-gray-500 text-sm mt-1">Admin</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {!showReset ? (
            <>
              <h2 className="text-xl font-semibold text-gray-800 mb-6">Sign in</h2>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    disabled={isPending}
                    {...register('email')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-50 disabled:opacity-70 transition"
                    placeholder="admin@example.com"
                  />
                  {errors.email && (
                    <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    disabled={isPending}
                    {...register('password')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-50 disabled:opacity-70 transition"
                    placeholder="••••••••"
                  />
                  {errors.password && (
                    <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
                  )}
                </div>

                {serverError && (
                  <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                    <p className="text-red-700 text-sm">{serverError}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-semibold rounded-xl transition focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                >
                  {isPending ? 'Signing in…' : 'Sign in'}
                </button>
              </form>

              <button
                type="button"
                onClick={() => { setShowReset(true); setServerError(null); setResetSent(false) }}
                className="mt-4 w-full text-center text-sm text-purple-600 hover:text-purple-800 transition"
              >
                Forgot password?
              </button>
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Reset password</h2>
              <p className="text-gray-500 text-sm mb-6">
                Enter your admin email and we&apos;ll send you a reset link.
              </p>

              {resetSent ? (
                <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 mb-4">
                  <p className="text-green-700 text-sm">
                    Reset link sent! Check your email inbox.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email address
                    </label>
                    <input
                      id="reset-email"
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      disabled={isPending}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-50 disabled:opacity-70 transition"
                      placeholder="admin@example.com"
                    />
                  </div>

                  {serverError && (
                    <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                      <p className="text-red-700 text-sm">{serverError}</p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={onReset}
                    disabled={isPending || !resetEmail}
                    className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-semibold rounded-xl transition focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                  >
                    {isPending ? 'Sending…' : 'Send reset link'}
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => { setShowReset(false); setServerError(null) }}
                className="mt-4 w-full text-center text-sm text-purple-600 hover:text-purple-800 transition"
              >
                Back to sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
