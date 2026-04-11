import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import SignupForm from '@/components/auth/signup-form'

export const metadata: Metadata = {
  title: "Join George's Predictor",
  description: "Sign up to join George's Premier League prediction competition.",
}

/**
 * Fetch pre-imported member names (members without a user_id — imported but not registered yet).
 * These are the WhatsApp display names George added before opening registration.
 */
async function getImportedNames(): Promise<string[]> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('members')
      .select('display_name')
      .is('user_id', null)
      .order('display_name', { ascending: true })

    if (error || !data) return []
    return data.map((row: { display_name: string }) => row.display_name)
  } catch {
    return []
  }
}

export default async function SignupPage() {
  const importedNames = await getImportedNames()

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-16">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-bold text-white">Join the Competition</h1>
          <p className="text-slate-400 text-base leading-relaxed">
            Select your name from the list below, or choose &ldquo;I&apos;m new&rdquo; if
            this is your first season with us.
          </p>
        </div>

        {/* Signup form */}
        <SignupForm importedNames={importedNames} />
      </div>
    </div>
  )
}
