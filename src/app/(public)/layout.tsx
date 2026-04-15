import type { ReactNode } from 'react'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const isAdmin = user?.app_metadata?.role === 'admin'

  return (
    <div className="flex flex-col min-h-screen bg-slate-950">
      {/* Minimal header */}
      <header className="border-b border-slate-800">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="text-white font-bold text-xl tracking-tight hover:text-purple-400 transition"
          >
            George&apos;s Predictor
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            {isAdmin && (
              <Link
                href="/admin"
                className="font-semibold text-purple-300 hover:text-white transition px-3 py-2 rounded-lg border border-purple-500/40 hover:bg-purple-500/10"
              >
                Admin
              </Link>
            )}
            <Link
              href={user ? '/dashboard' : '/login'}
              className="text-slate-400 hover:text-white transition"
            >
              {user ? 'Dashboard' : 'Member Login'}
            </Link>
          </nav>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1">{children}</main>
    </div>
  )
}
