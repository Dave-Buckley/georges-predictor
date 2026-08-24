/**
 * /members/[slug] — Member profile page.
 *
 * Auth-gated under (member). Uses shared compute helpers from
 * @/lib/profile/compute-season so /compare can reuse the same aggregator.
 */
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { findMemberBySlug, toSlug } from '@/lib/members/slug'
import {
  computeStatsForSeason,
  resolveCurrentSeason,
} from '@/lib/profile/compute-season'
import {
  getRevealedGameweekNumbers,
  getMemberPredictionsForGameweek,
} from '@/lib/profile/get-member-predictions'
import { WeeklyPointsChart } from '@/components/charts/weekly-points-chart'

import { ProfileHeader } from './_components/profile-header'
import { SeasonStatsPanel } from './_components/season-stats-panel'
import { AchievementBadges } from './_components/achievement-badges'
import { MemberPredictions } from './_components/member-predictions'
import {
  SeasonHistoryTable,
  type SeasonHistoryEntry,
} from './_components/season-history-table'

export const dynamic = 'force-dynamic'

export default async function MemberProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  // Optional: Next always supplies this, but defaulting keeps the page
  // callable without it (and keeps the existing page tests honest).
  searchParams?: Promise<{ gw?: string }>
}) {
  const { slug } = await params
  const { gw: gwParam } = (searchParams ? await searchParams : {}) as {
    gw?: string
  }
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const viewerIsAdmin = user.app_metadata?.role === 'admin'

  const admin = createAdminClient()

  const memberRow = await findMemberBySlug(admin, slug)
  if (!memberRow) {
    return (
      <div className="space-y-4 max-w-md mx-auto py-16 text-center">
        <h1 className="text-xl font-bold text-white">Member not found</h1>
        <p className="text-slate-400 text-sm">
          We couldn&apos;t find a member with that link. They may have been
          removed, or the link might have a typo.
        </p>
        <Link
          href="/standings"
          className="inline-block text-sm text-purple-400 hover:text-purple-300"
        >
          Back to the league table
        </Link>
      </div>
    )
  }

  const member = memberRow as unknown as {
    id: string
    display_name: string
    email: string | null
    favourite_club_id: string | null
    created_at: string
    approval_status: string
  }

  const currentSeason = await resolveCurrentSeason(admin)
  const { stats: currentStats, weeklyBreakdown } = await computeStatsForSeason(
    admin,
    member.id,
    currentSeason,
  )

  // Fail-soft: null before migration 029 is applied, which renders the
  // King Predictor logo placeholder rather than breaking the profile.
  let favouriteClub: { name: string; badge_url: string | null } | null = null
  if (member.favourite_club_id) {
    const { data: clubRow } = await admin
      .from('clubs')
      .select('name, badge_url')
      .eq('id', member.favourite_club_id)
      .maybeSingle()
    favouriteClub =
      (clubRow as { name: string; badge_url: string | null } | null) ?? null
  }

  const { data: archivedRaw } = await admin
    .from('seasons')
    .select('season, ended_at')
    .not('ended_at', 'is', null)
    .order('season', { ascending: false })
  const archivedSeasons = ((archivedRaw ?? []) as Array<{
    season: number
    ended_at: string | null
  }>).map((r) => r.season)

  const historyEntries: SeasonHistoryEntry[] = await Promise.all(
    archivedSeasons.map(async (s) => {
      const { stats } = await computeStatsForSeason(admin, member.id, s)
      return {
        season: s,
        rank: stats.rank,
        totalPoints: stats.totalPoints,
        losWins: stats.losWins,
        gwWinnerCount: stats.gwWinnerCount,
      } satisfies SeasonHistoryEntry
    }),
  )

  // Resolve the viewer's own member row so we can pre-fill /compare.
  const { data: viewerMember } = await admin
    .from('members')
    .select('id, display_name')
    .eq('user_id', user.id)
    .maybeSingle()
  const viewerSlug = viewerMember
    ? toSlug((viewerMember as { display_name: string }).display_name)
    : null
  const targetSlug = toSlug(member.display_name)
  const viewerIsTarget = viewerMember
    ? (viewerMember as { id: string }).id === member.id
    : false
  const compareHref =
    viewerSlug && !viewerIsTarget
      ? `/compare?a=${encodeURIComponent(viewerSlug)}&b=${encodeURIComponent(targetSlug)}`
      : `/compare?b=${encodeURIComponent(targetSlug)}`

  // ── Predictions, revealed per fixture at kick-off ───────────────────────
  // Weeks with at least one kicked-off fixture, so the nav never offers a week
  // that would render empty. Viewing your own profile also shows fixtures that
  // have not started, mirroring the predictions_select_member RLS policy.
  const availableGameweeks = await getRevealedGameweekNumbers(admin)
  const requestedGw = Number(gwParam)
  const selectedGw =
    Number.isFinite(requestedGw) && availableGameweeks.includes(requestedGw)
      ? requestedGw
      : (availableGameweeks[availableGameweeks.length - 1] ?? null)

  const predictions =
    selectedGw !== null
      ? await getMemberPredictionsForGameweek(admin, member.id, selectedGw, {
          includeUnplayed: viewerIsTarget,
        })
      : null

  return (
    <div className="space-y-6">
      <ProfileHeader
        member={member}
        favouriteClub={favouriteClub}
        viewerIsAdmin={viewerIsAdmin}
      />
      {!viewerIsTarget ? (
        <div>
          <Link
            href={compareHref}
            className="inline-flex items-center gap-2 rounded-xl border border-purple-500/40 bg-purple-500/10 px-4 py-2 text-sm font-semibold text-purple-200 hover:bg-purple-500/20 transition"
          >
            Compare me vs {member.display_name}
          </Link>
        </div>
      ) : null}
      <SeasonStatsPanel stats={currentStats} />
      <AchievementBadges achievements={currentStats.achievements} />
      <MemberPredictions
        slug={targetSlug}
        memberDisplayName={member.display_name}
        viewerIsTarget={viewerIsTarget}
        available={availableGameweeks}
        data={predictions}
      />
      {weeklyBreakdown.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
            Weekly points trend
          </h2>
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
            <WeeklyPointsChart weeks={weeklyBreakdown} />
          </div>
        </section>
      ) : null}
      <SeasonHistoryTable
        entries={historyEntries}
        memberDisplayName={member.display_name}
      />
    </div>
  )
}
