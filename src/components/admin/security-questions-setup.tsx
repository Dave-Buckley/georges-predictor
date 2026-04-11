'use client'

import { useState, useEffect, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { Shield, CheckCircle } from 'lucide-react'
import { setSecurityQuestion, getSecurityQuestion } from '@/actions/admin/recovery'

interface FormValues {
  question: string
  answer: string
}

interface SecurityQuestionsSetupProps {
  adminUserId: string
}

export function SecurityQuestionsSetup({ adminUserId }: SecurityQuestionsSetupProps) {
  const [isPending, startTransition] = useTransition()
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormValues>()

  // Load existing question on mount
  useEffect(() => {
    getSecurityQuestion(adminUserId).then((result) => {
      if (result.question) {
        setCurrentQuestion(result.question)
      }
      setLoading(false)
    })
  }, [adminUserId])

  const onSubmit = (values: FormValues) => {
    setServerError(null)
    setSaved(false)

    const formData = new FormData()
    formData.set('question', values.question)
    formData.set('answer', values.answer)

    startTransition(async () => {
      const result = await setSecurityQuestion(formData)
      if (result.error) {
        setServerError(result.error)
      } else {
        setSaved(true)
        setCurrentQuestion(values.question)
        reset({ question: values.question, answer: '' })
      }
    })
  }

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-48 mb-3" />
        <div className="h-10 bg-gray-200 rounded mb-3" />
        <div className="h-10 bg-gray-200 rounded" />
      </div>
    )
  }

  return (
    <div>
      {currentQuestion && !saved && (
        <div className="mb-4 p-4 rounded-xl bg-blue-50 border border-blue-200 flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-900">Security question already set</p>
            <p className="text-sm text-blue-700 mt-0.5">
              Current question: <em>&ldquo;{currentQuestion}&rdquo;</em>
            </p>
            <p className="text-xs text-blue-500 mt-1">
              Fill in the form below to update it.
            </p>
          </div>
        </div>
      )}

      {saved && (
        <div className="mb-4 p-4 rounded-xl bg-green-50 border border-green-200 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-900">Security question saved</p>
            <p className="text-sm text-green-700 mt-0.5">
              This can be used to recover your account if you lose email access.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label
            htmlFor="security-question"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Security question
          </label>
          <input
            id="security-question"
            type="text"
            placeholder="e.g. What is the name of your first pet?"
            defaultValue={currentQuestion ?? ''}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            {...register('question', {
              required: 'Question is required',
              minLength: { value: 5, message: 'Question must be at least 5 characters' },
              maxLength: { value: 200, message: 'Question must be 200 characters or fewer' },
            })}
          />
          {errors.question && (
            <p className="mt-1 text-xs text-red-600">{errors.question.message}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="security-answer"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Your answer
          </label>
          <input
            id="security-answer"
            type="text"
            placeholder="Your answer (case-insensitive)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            {...register('answer', {
              required: 'Answer is required',
              minLength: { value: 2, message: 'Answer must be at least 2 characters' },
              maxLength: { value: 100, message: 'Answer must be 100 characters or fewer' },
            })}
          />
          {errors.answer && (
            <p className="mt-1 text-xs text-red-600">{errors.answer.message}</p>
          )}
          <p className="mt-1 text-xs text-gray-400">
            Your answer is stored securely — it is not recoverable. The other admin will need to enter this exactly (ignoring capitals and spaces).
          </p>
        </div>

        {serverError && (
          <p className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{serverError}</p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
        >
          {isPending ? 'Saving…' : currentQuestion ? 'Update security question' : 'Save security question'}
        </button>
      </form>
    </div>
  )
}
