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

    const { data: openGws } = await supabase
      .from('gameweeks')
      .select('id, number')
      .is('closed_at', null)
      .order('number', { ascending: true })
      .limit(1)

    const openGw = (openGws ?? [])[0] as
      | { id: string; number: number }
      | undefined

    if (!openGw) return null

    const nowIso = new Date().toISOString()
    const { data: kickedFixtures } = await supabase
      .from('fixtures')
      .select('id')
      .eq('gameweek_id', openGw.id)
      .lte('kickoff_time', nowIso)
      .limit(1)

    const hasKickedOff = ((kickedFixtures ?? []) as Array<unknown>).length > 0

    return {
      number: openGw.number,
      status: hasKickedOff ? 'in_progress' : 'upcoming',
    }
  } catch {
    return null
  }
}
