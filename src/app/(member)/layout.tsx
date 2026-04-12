import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { MemberRow } from '@/lib/supabase/types'

// Force dynamic rendering — authenticated page, no caching
export const dynamic = 'force-dynamic'

interface MemberLayoutProps {
  children: ReactNode
}

async function LogoutButton() {
  return (
    <form
      action={async () => {
        'use server'
        const supabase = await createServerSupabaseClient()
        await supabase.auth.signOut()
        redirect('/')
      }}
    >
      <button
        type="submit"
        className="text-sm text-slate-400 hover:text-white transition px-3 py-2 rounded-lg hover:bg-slate-800"
      >
        Log out
      </button>
    </form>
  )
}

export default async function MemberLayout({ children }: MemberLayoutProps) {
  const supabase = await createServerSupabaseClient()

  // Get current authenticated user (middleware already checked auth, but we need
  // member data here for the layout)
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    // Defense in depth — middleware should catch this first
    redirect('/login')
  }

  // Fetch member row
  const { data: member, error: memberError } = await supabase
    .from('members')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (memberError || !member) {
    // Member row not found — show a clear error state rather than crashing
    return (
      <div className="flex flex-col min-h-screen bg-slate-950">
        <div className="flex items-center justify-center flex-1">
          <div className="text-center space-y-4 max-w-md px-4">
            <h1 className="text-xl font-semibold text-white">Account not found</h1>
            <p className="text-slate-400">
              We couldn&apos;t find your member account. Please contact George for help.
            </p>
            <Link href="/" className="text-purple-400 hover:text-purple-300 text-sm">
              Return to home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const memberRow = member as MemberRow

  return (
    <div className="flex flex-col min-h-screen bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 sticky top-0 z-10 bg-slate-950/95 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="text-white font-bold text-xl tracking-tight hover:text-purple-400 transition"
          >
            George&apos;s Predictor
          </Link>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm hidden sm:block">
              {memberRow.display_name}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="border-b border-slate-800">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto">
            <Link
              href="/dashboard"
              className="px-4 py-3 text-sm font-medium text-slate-300 hover:text-white whitespace-nowrap border-b-2 border-transparent hover:border-purple-500 transition"
            >
              Dashboard
            </Link>
            <span className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap cursor-not-allowed">
              My Predictions
            </span>
            <Link
              href="/bonuses"
              className="px-4 py-3 text-sm font-medium text-slate-300 hover:text-white whitespace-nowrap border-b-2 border-transparent hover:border-purple-500 transition"
            >
              Bonuses &amp; Prizes
            </Link>
            <Link
              href="/los"
              className="px-4 py-3 text-sm font-medium text-slate-300 hover:text-white whitespace-nowrap border-b-2 border-transparent hover:border-purple-500 transition"
            >
              Last One Standing
            </Link>
            <Link
              href="/pre-season"
              className="px-4 py-3 text-sm font-medium text-slate-300 hover:text-white whitespace-nowrap border-b-2 border-transparent hover:border-purple-500 transition"
            >
              Pre-Season
            </Link>
            <span className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap cursor-not-allowed">
              League Table
            </span>
            <Link
              href="/profile"
              className="px-4 py-3 text-sm font-medium text-slate-300 hover:text-white whitespace-nowrap border-b-2 border-transparent hover:border-purple-500 transition"
            >
              Profile
            </Link>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 max-w-5xl mx-auto px-4 py-8 w-full">
        {children}
      </main>
    </div>
  )
}
