import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AdminSidebar } from '@/components/admin/sidebar'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  // Defense in depth — middleware already redirects non-admins
  if (error || !user || user.app_metadata?.role !== 'admin') {
    redirect('/admin/login')
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar adminEmail={user.email ?? ''} />
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  )
}
