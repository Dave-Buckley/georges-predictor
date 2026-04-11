import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { MemberRow } from '@/lib/supabase/types'
import PendingNotice from '@/components/member/pending-notice'
import DashboardOverview from '@/components/member/dashboard-overview'

// Force dynamic rendering — reads member data on every request
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // Middleware handles this — this is defense in depth
    redirect('/login')
  }

  const { data: member } = await supabase
    .from('members')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!member) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-400">
          Member data not found. Please contact George.
        </p>
      </div>
    )
  }

  const memberRow = member as MemberRow

  // Rejected members should not be here — redirect to home
  if (memberRow.approval_status === 'rejected') {
    redirect('/')
  }

  // Pending members see the approval notice
  if (memberRow.approval_status === 'pending') {
    return <PendingNotice />
  }

  // Approved members see the full dashboard
  return <DashboardOverview member={memberRow} />
}
