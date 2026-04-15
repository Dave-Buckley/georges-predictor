/**
 * /compare — side-by-side two-member stat comparison for the current season.
 *
 * Query string: ?a=<slug>&b=<slug>. If `a` is missing, defaults to the
 * signed-in viewer's slug. If `b` is missing, page renders just the selector.
 */
import { redirect } from 'next/navigation'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { findMemberBySlug, toSlug } from '@/lib/members/slug'
import {
  computeStatsForSeason,
  resolveCurrentSeason,
} from '@/lib/profile/compute-season'

import { CompareSelector } from './_components/compare-selector'
import { CompareStats } from './_components/compare-stats'
import { DualPointsChart } from './_components/dual-points-chart'

export const dynamic = 'force-dynamic'

const COLOR_A = '#a855f7' // purple-500
const COLOR_B = '#22d3ee' // cyan-400

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>
}) {
  const { a: aSlugParam, b: bSlugParam } = await searchParams
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: viewerMember } = await admin
    .from('members')
    .select('id, display_name')
    .eq('user_id', user.id)
    .maybeSingle()
  const viewerSlug = viewerMember
    ? toSlug((viewerMember as { display_name: string }).display_name)
    : null

  // Default `a` to the viewer when not specified.
  const aSlug = aSlugParam ?? viewerSlug ?? null
  const bSlug = bSlugParam ?? null

  // Member options for the dropdowns.
  const { data: allMembersRaw } = await admin
    .from('members')
    .select('id, display_name, approval_status')
    .eq('approval_status', 'approved')
    .order('display_name', { ascending: true })
  const members = ((allMembersRaw ?? []) as Array<{
    id: string
    display_name: string
  }>).map((m) => ({
    id: m.id,
    displayName: m.display_name,
    slug: toSlug(m.display_name),
  }))

  const currentSeason = await resolveCurrentSeason(admin)

  async function loadMember(slug: string | null) {
    if (!slug) return null
    const row = await findMemberBySlug(admin, slug)
    if (!row) return null
    const r = row as unknown as { id: string; display_name: string }
    const { stats, weeklyBreakdown } = await computeStatsForSeason(
      admin,
      r.id,
      currentSeason,
    )
    return { id: r.id, displayName: r.display_name, stats, weeklyBreakdown }
  }

  const [aMember, bMember] = await Promise.all([
    loadMember(aSlug),
    loadMember(bSlug),
  ])

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-white">Compare</h1>
        <p className="text-sm text-slate-400">
          Pick two people to see stats side-by-side for the current season.
        </p>
      </header>

      <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
        <CompareSelector
          members={members.map((m) => ({
            slug: m.slug,
            displayName: m.displayName,
          }))}
          aSlug={aSlug}
          bSlug={bSlug}
          viewerSlug={viewerSlug}
        />
      </div>

      {aMember && bMember ? (
        <>
          <CompareStats
            a={{ displayName: aMember.displayName, stats: aMember.stats }}
            b={{ displayName: bMember.displayName, stats: bMember.stats }}
          />

          {aMember.weeklyBreakdown.length > 0 ||
          bMember.weeklyBreakdown.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                Running points this season
              </h2>
              <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
                <DualPointsChart
                  a={{
                    label: aMember.displayName,
                    color: COLOR_A,
                    points: aMember.weeklyBreakdown,
                  }}
                  b={{
                    label: bMember.displayName,
                    color: COLOR_B,
                    points: bMember.weeklyBreakdown,
                  }}
                />
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center text-sm text-slate-400">
          Pick two members above to see the comparison.
        </div>
      )}
    </div>
  )
}
