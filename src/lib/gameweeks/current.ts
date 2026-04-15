import { createAdminClient } from '@/lib/supabase/admin'

export type CurrentGameweekStatus = 'in_progress' | 'upcoming' | null

export interface CurrentGameweek {
  number: number
  status: CurrentGameweekStatus
}

/**
 * Returns the "current" gameweek for display purposes:
 *  - 'in_progress' when at least one fixture in the earliest unclosed gameweek
 *    has a kickoff_time <= now()
 *  - 'upcoming' when the earliest unclosed gameweek has no kicked-off fixtures yet
 *  - null when every gameweek is closed (end of season)
 *
 * Falls back silently to null on DB errors so callers can render defensively.
 */
export async function getCurrentGameweek(): Promise<CurrentGameweek | null> {
  try {
    const supabase = createAdminClient()

    // "Current" = earliest gameweek that still has at least one non-terminal
    // fixture. Relying on gameweeks.closed_at alone breaks mid-season deploys
    // where admin-close hasn't been run for historical GWs, making GW1 look
    // "in progress" forever.
    const { data: gws } = await supabase
      .from('gameweeks')
      .select('id, number')
      .order('number', { ascending: true })

    for (const gw of (gws ?? []) as Array<{ id: string; number: number }>) {
      const { count: liveCount } = await supabase
        .from('fixtures')
        .select('id', { count: 'exact', head: true })
        .eq('gameweek_id', gw.id)
        .not('status', 'in', '(FINISHED,CANCELLED,POSTPONED)')

      if ((liveCount ?? 0) === 0) continue

      const nowIso = new Date().toISOString()
      const { data: kickedFixtures } = await supabase
        .from('fixtures')
        .select('id')
        .eq('gameweek_id', gw.id)
        .lte('kickoff_time', nowIso)
        .limit(1)

      const hasKickedOff = ((kickedFixtures ?? []) as Array<unknown>).length > 0

      return {
        number: gw.number,
        status: hasKickedOff ? 'in_progress' : 'upcoming',
      }
    }

    return null
  } catch {
    return null
  }
}
