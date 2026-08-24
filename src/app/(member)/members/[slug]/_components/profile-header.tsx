/**
 * ProfileHeader — Phase 11 Plan 02 Task 2.
 *
 * Member profile header. Admin-only viewers see extra fields (email,
 * registration date, approval history). Regular members see display
 * name and optional favourite-club badge only.
 *
 * The club comes from `members.favourite_club_id` -> `public.clubs`
 * (migration 029), which covers the top four English tiers. It replaces the
 * older `favourite_team_id` -> `teams` link, which only ever offered the 20
 * current Premier League sides and had no picker UI, so no member ever set one.
 */
import { ClubBadge } from '@/components/shared/club-badge'

interface FavouriteClub {
  name: string
  badge_url: string | null
}

interface ProfileHeaderProps {
  member: {
    display_name: string
    email?: string | null
    created_at?: string | null
    approval_status?: string | null
  }
  favouriteClub?: FavouriteClub | null
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
  favouriteClub,
  viewerIsAdmin,
}: ProfileHeaderProps) {
  return (
    <header className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900 p-6">
      <div className="flex items-center gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-white">
          {member.display_name}
        </h1>
        <span className="flex items-center gap-2">
          <span className="text-xs text-slate-500 uppercase tracking-wider">
            Supports
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ClubBadge
              club={
                favouriteClub
                  ? { url: favouriteClub.badge_url, name: favouriteClub.name }
                  : null
              }
              size={20}
            />
            <span className="text-sm font-medium text-slate-200">
              {favouriteClub ? favouriteClub.name : 'No club picked yet'}
            </span>
          </span>
        </span>
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
