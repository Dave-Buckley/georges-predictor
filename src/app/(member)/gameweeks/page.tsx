import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// Force dynamic rendering — redirect depends on current fixture state
export const dynamic = 'force-dynamic'

/**
 * Smart redirect to the current active gameweek.
 *
 * Redirect logic:
 *   1. Find the earliest gameweek with at least one SCHEDULED or TIMED fixture
 *   2. If none, redirect to the highest-numbered completed gameweek
 *   3. If no gameweeks exist at all, show a placeholder message
 */
export default async function GameweeksIndexPage() {
  const supabase = await createServerSupabaseClient()

  // Fetch all gameweeks ordered by number
  const { data: gameweeks } = await supabase
    .from('gameweeks')
    .select('id, number, status')
    .order('number')

  if (!gameweeks || gameweeks.length === 0) {
    return (
      <div className="text-center py-16 space-y-2">
        <p className="text-slate-300 font-semibold">Fixtures haven&apos;t been loaded yet.</p>
        <p className="text-slate-500 text-sm">Check back soon — George will sync fixtures before the season starts.</p>
      </div>
    )
  }

  // Find the earliest gameweek with a SCHEDULED or TIMED fixture
  const { data: upcomingRows } = await supabase
    .from('fixtures')
    .select('gameweek_id')
    .in('status', ['SCHEDULED', 'TIMED'])
    .limit(1)
    .order('kickoff_time')

  if (upcomingRows && upcomingRows.length > 0) {
    const gwId = upcomingRows[0].gameweek_id
    const gw = gameweeks.find((g) => g.id === gwId)
    if (gw) {
      redirect(`/gameweeks/${gw.number}`)
    }
  }

  // Fall back to the latest completed gameweek
  const latest = [...gameweeks].reverse().find((g) => g.status === 'complete')
  if (latest) {
    redirect(`/gameweeks/${latest.number}`)
  }

  // Last resort: first gameweek
  redirect(`/gameweeks/${gameweeks[0].number}`)
}
