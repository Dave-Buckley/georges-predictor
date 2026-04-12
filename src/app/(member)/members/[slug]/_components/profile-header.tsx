/**
 * ProfileHeader — Phase 11 Plan 02 Task 2.
 *
 * Member profile header. Admin-only viewers see extra fields (email,
 * registration date, approval history). Regular members see display
 * name and optional favourite-team crest only.
 */
import TeamBadge from '@/components/fixtures/team-badge'
import type { TeamRow } from '@/lib/supabase/types'

interface ProfileHeaderProps {
  member: {
    display_name: string
    email?: string | null
    favourite_team_id?: string | null
    created_at?: string | null
    approval_status?: string | null
  }
  favouriteTeam?: TeamRow | null
  viewerIsAdmin: boolean
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

export function ProfileHeader({
  member,
  favouriteTeam,
  viewerIsAdmin,
}: ProfileHeaderProps) {
  return (
    <header className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900 p-6">
      <div className="flex items-center gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-white">
          {member.display_name}
        </h1>
        {favouriteTeam ? (
          <span className="flex items-center gap-2">
            <span className="text-xs text-slate-500 uppercase tracking-wider">
              Supports
            </span>
            <TeamBadge team={favouriteTeam} size="sm" />
          </span>
        ) : null}
      </div>

      {viewerIsAdmin ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-800 text-sm">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider">
              Email
            </p>
            <p className="text-slate-200 mt-1 break-all">
              {member.email ?? '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider">
              Registered
            </p>
            <p className="text-slate-200 mt-1">
              {formatDate(member.created_at)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider">
              Status
            </p>
            <p className="text-slate-200 mt-1 capitalize">
              {member.approval_status ?? '—'}
            </p>
          </div>
        </div>
      ) : null}
    </header>
  )
}

export default ProfileHeader
