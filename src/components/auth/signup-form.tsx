'use client'

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { signupSchema, type SignupInput } from '@/lib/validators/auth'
import { signUpMember } from '@/actions/auth'
import NamePicker from './name-picker'

interface SignupFormProps {
  importedNames: string[]
}

/**
 * Member signup form.
 * Uses react-hook-form + zodResolver with signupSchema.
 * Calls signUpMember server action on submit.
 */
export default function SignupForm({ importedNames }: SignupFormProps) {
  const [serverResult, setServerResult] = useState<{
    success?: boolean
    error?: string
  } | null>(null)

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      display_name: '',
      email: '',
      is_new_member: false,
      email_opt_in: true,
    },
  })

  const isNewMember = watch('is_new_member')

  async function onSubmit(data: SignupInput) {
    setServerResult(null)
    const formData = new FormData()
    formData.set('display_name', data.display_name)
    formData.set('email', data.email)
    formData.set('is_new_member', String(data.is_new_member))
    formData.set('email_opt_in', String(data.email_opt_in))
    const response = await signUpMember(formData)
    setServerResult(response)
  }

  // ── Success state ────────────────────────────────────────────────────────────
  if (serverResult?.success) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="rounded-2xl bg-slate-800 border border-green-500/30 p-8 text-center space-y-5">
          {/* Checkmark icon */}
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
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">You&apos;re registered!</h2>
            <p className="text-slate-300 text-lg leading-relaxed">
              Confirm with George via WhatsApp so he can approve your account.
            </p>
          </div>

          <div className="rounded-xl bg-slate-700/50 border border-slate-600 px-4 py-3 space-y-1">
            <p className="text-slate-400 text-sm">
              Once George approves you, you&apos;ll get an email with a link to log in.
            </p>
            <p className="text-slate-400 text-sm">
              In the meantime, you can{' '}
              <Link
                href="/"
                className="text-purple-400 hover:text-purple-300 underline transition"
              >
                browse the league table
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Form ────────────────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-md mx-auto">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">

        {/* Name picker */}
        <Controller
          name="display_name"
          control={control}
          render={({ field }) => (
            <NamePicker
              importedNames={importedNames}
              value={field.value}
              onChange={(val) => {
                field.onChange(val)
              }}
              isNewMember={isNewMember}
              onIsNewMemberChange={(isNew) => {
                setValue('is_new_member', isNew)
              }}
              error={errors.display_name?.message}
              disabled={isSubmitting}
            />
          )}
        />

        {/* Hidden is_new_member field */}
        <input type="hidden" {...register('is_new_member')} />

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
            {...register('email')}
            className="w-full rounded-xl bg-slate-800 border border-slate-600 px-4 py-4 text-white text-lg placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 transition"
          />
          {errors.email && (
            <p className="text-red-400 text-sm">{errors.email.message}</p>
          )}
        </div>

        {/* Email opt-in checkbox */}
        <div className="flex items-start gap-3">
          <input
            id="email_opt_in"
            type="checkbox"
            disabled={isSubmitting}
            {...register('email_opt_in')}
            className="mt-1 h-5 w-5 rounded border-slate-600 bg-slate-800 text-purple-600 focus:ring-purple-500 focus:ring-offset-slate-950 cursor-pointer disabled:opacity-50"
          />
          <label
            htmlFor="email_opt_in"
            className="text-slate-300 text-base cursor-pointer leading-snug"
          >
            Send me deadline reminders{' '}
            <span className="text-slate-500 text-sm">(recommended)</span>
          </label>
        </div>

        {/* Server error */}
        {serverResult?.error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3">
            <p className="text-red-400 text-sm">{serverResult.error}</p>
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-purple-600 hover:bg-purple-500 active:bg-purple-700 disabled:bg-purple-600/50 disabled:cursor-not-allowed px-6 py-5 text-white font-bold text-xl shadow-lg shadow-purple-500/20 transition-all focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-slate-950"
        >
          {isSubmitting ? 'Submitting...' : 'Join the Competition'}
        </button>

        {/* Login link */}
        <p className="text-center text-slate-400 text-sm">
          Already a member?{' '}
          <Link
            href="/login"
            className="text-purple-400 hover:text-purple-300 font-medium transition"
          >
            Log in here
          </Link>
        </p>
      </form>
    </div>
  )
}
