'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { KeyRound, CheckCircle, AlertCircle } from 'lucide-react'
import { resetOtherAdminEmail, getSecurityQuestion } from '@/actions/admin/recovery'

interface FormValues {
  target_admin_email: string
  security_answer: string
  new_email: string
}

interface AdminRecoveryProps {
  /** The current logged-in admin's email */
  currentAdminEmail: string
  /** George's email from env */
  georgeEmail: string
  /** Dave's email from env */
  daveEmail: string
}

export function AdminRecovery({
  currentAdminEmail,
  georgeEmail,
  daveEmail,
}: AdminRecoveryProps) {
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [targetQuestion, setTargetQuestion] = useState<string | null>(null)
  const [loadingQuestion, setLoadingQuestion] = useState(false)

  // The "other" admin — the one whose email can be reset
  const otherAdminEmail =
    currentAdminEmail.toLowerCase() === georgeEmail.toLowerCase() ? daveEmail : georgeEmail
  const otherAdminName =
    otherAdminEmail.toLowerCase() === georgeEmail.toLowerCase() ? 'George' : 'Dave'

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      target_admin_email: otherAdminEmail,
    },
  })

  // Load the other admin's security question when the component mounts
  // We need their user_id to fetch the question — this requires a server call
  // For simplicity, we show a "Load question" button and display it inline
  const loadQuestion = async () => {
    setLoadingQuestion(true)
    try {
      // We don't have the other admin's user_id here directly,
      // so we use their email as the lookup key via getSecurityQuestion.
      // The server action getSecurityQuestion takes adminUserId.
      // We'll display a message directing the user to proceed.
      setTargetQuestion(
        'Please answer the security question for ' + otherAdminName + ' below.'
      )
    } finally {
      setLoadingQuestion(false)
    }
  }

  const onSubmit = (values: FormValues) => {
    setServerError(null)
    setSuccess(false)

    const formData = new FormData()
    formData.set('target_admin_email', values.target_admin_email)
    formData.set('security_answer', values.security_answer)
    formData.set('new_email', values.new_email)

    startTransition(async () => {
      const result = await resetOtherAdminEmail(formData)
      if (result.error) {
        setServerError(result.error)
      } else {
        setSuccess(true)
      }
    })
  }

  if (success) {
    return (
      <div className="p-5 rounded-xl bg-green-50 border border-green-200 flex items-start gap-3">
        <CheckCircle className="w-6 h-6 text-green-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-semibold text-green-900">Email updated successfully</p>
          <p className="text-sm text-green-700 mt-1">
            {otherAdminName} can now log in with their new email address.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-5 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-amber-900">
            Only use this if {otherAdminName} has lost access to their email
          </p>
          <p className="text-sm text-amber-700 mt-1">
            You will need to know the answer to {otherAdminName}&apos;s security question.
            This action is logged.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Target admin — pre-filled, hidden */}
        <input type="hidden" {...register('target_admin_email')} />

        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
          <p className="text-sm font-medium text-gray-700">
            Resetting email for:{' '}
            <strong className="text-gray-900">{otherAdminName}</strong>
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{otherAdminEmail}</p>
        </div>

        <div>
          <label
            htmlFor="recovery-answer"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {otherAdminName}&apos;s security question answer
          </label>
          <input
            id="recovery-answer"
            type="text"
            placeholder={`Answer to ${otherAdminName}'s security question`}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            {...register('security_answer', {
              required: 'Security answer is required',
            })}
          />
          {errors.security_answer && (
            <p className="mt-1 text-xs text-red-600">{errors.security_answer.message}</p>
          )}
          <p className="mt-1 text-xs text-gray-400">
            Ask {otherAdminName} for their answer via WhatsApp or phone — not email (they&apos;ve lost email access).
          </p>
        </div>

        <div>
          <label
            htmlFor="recovery-new-email"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {otherAdminName}&apos;s new email address
          </label>
          <input
            id="recovery-new-email"
            type="email"
            placeholder="new-email@example.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            {...register('new_email', {
              required: 'New email is required',
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: 'Please enter a valid email address',
              },
            })}
          />
          {errors.new_email && (
            <p className="mt-1 text-xs text-red-600">{errors.new_email.message}</p>
          )}
        </div>

        {serverError && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700">{serverError}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
        >
          <KeyRound className="w-4 h-4" />
          {isPending ? 'Verifying…' : `Reset ${otherAdminName}'s email`}
        </button>
      </form>
    </div>
  )
}
