import type { Metadata } from 'next'
import LoginForm from '@/components/auth/login-form'

export const metadata: Metadata = {
  title: "Member Login — George's Predictor",
  description: "Log in to George's Predictor prediction competition.",
}

export default function LoginPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-16">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-bold text-white">
            Welcome back
          </h1>
          <p className="text-slate-400 text-lg">
            Enter your email and we&apos;ll send you a link to log in.
          </p>
          <p className="text-slate-500 text-sm">
            No password needed — just click the link in your email.
          </p>
        </div>

        {/* Login form */}
        <LoginForm />
      </div>
    </div>
  )
}
