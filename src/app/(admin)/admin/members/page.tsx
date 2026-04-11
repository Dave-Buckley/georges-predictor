import { createAdminClient } from '@/lib/supabase/admin'
import type { MemberRow } from '@/lib/supabase/types'
import { MemberTable } from '@/components/admin/member-table'
import { AddMemberDialog } from '@/components/admin/member-actions'

export const dynamic = 'force-dynamic'

async function getMembers(): Promise<MemberRow[]> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .order('created_at', { ascending: false })

    if (error || !data) return []
    return data as MemberRow[]
  } catch {
    return []
  }
}

export default async function MembersPage() {
  const members = await getMembers()

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage Members</h1>
          <p className="text-gray-500 mt-1 text-sm">
            {members.length} member{members.length !== 1 ? 's' : ''} total
          </p>
        </div>
        <AddMemberDialog />
      </div>

      <MemberTable members={members} />
    </div>
  )
}
