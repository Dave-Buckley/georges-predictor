/**
 * FixtureCard — stale in-play score handling.
 *
 * fixture.home_score is not a live feed. It holds whatever the score was at
 * the last fixture sync, and the sync only runs every couple of hours, so an
 * IN_PLAY fixture can sit on a long-dead score.
 *
 * On 6 Sep 2026 Arsenal vs Chelsea was synced at 1-1 forty-five minutes in,
 * finished 2-1 at roughly 17:20, and was not re-synced until 18:29. For over
 * an hour the card showed "1 - 1" under a pulsing LIVE badge, which members
 * read as the app getting the result wrong. The points were never affected —
 * scoring only runs on the FINISHED transition — but the display was lying.
 *
 * The card still shows the score (it is the best we have); past the freshness
 * window it just stops calling it live and captions it with the time it was
 * taken.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'

import FixtureCard from '@/components/fixtures/fixture-card'
import type { FixtureWithTeams, TeamRow, GameweekRow } from '@/lib/supabase/types'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const NOW = new Date('2026-09-06T19:00:00Z')

function makeTeam(overrides: Partial<TeamRow> = {}): TeamRow {
  return {
    id: 't-home',
    external_id: 57,
    name: 'Arsenal FC',
    short_name: 'Arsenal',
    tla: 'ARS',
    crest_url: null,
    updated_at: '2026-08-01T00:00:00Z',
    primary_color: null,
    secondary_color: null,
    ...overrides,
  }
}

function makeGameweek(): GameweekRow {
  return {
    id: 'gw-3',
    number: 3,
    season: 2026,
    status: 'active' as GameweekRow['status'],
    double_bubble: false,
    closed_at: null,
    closed_by: null,
    created_at: '2026-08-01T00:00:00Z',
    kickoff_backup_sent_at: null,
    reports_sent_at: null,
  } as GameweekRow
}

/** An IN_PLAY fixture whose score was last checked at `updatedAt`. */
function makeLiveFixture(updatedAt: string): FixtureWithTeams {
  return {
    id: 'fix-ars-che',
    external_id: 560570,
    gameweek_id: 'gw-3',
    home_team_id: 't-home',
    away_team_id: 't-away',
    kickoff_time: '2026-09-06T15:30:00Z',
    status: 'IN_PLAY',
    is_rescheduled: false,
    home_score: 1,
    away_score: 1,
    result_source: 'api',
    created_at: '2026-04-15T00:00:00Z',
    updated_at: updatedAt,
    home_team: makeTeam({ id: 't-home', name: 'Arsenal FC', short_name: 'Arsenal' }),
    away_team: makeTeam({ id: 't-away', name: 'Chelsea FC', short_name: 'Chelsea', tla: 'CHE' }),
    gameweek: makeGameweek(),
  }
}

describe('FixtureCard — in-play score freshness', () => {
  it('shows the pulsing LIVE badge while the synced score is recent', () => {
    vi.setSystemTime(NOW)
    // Checked 5 minutes ago — well inside the 20-minute window.
    const fixture = makeLiveFixture('2026-09-06T18:55:00Z')
    const { container } = render(<FixtureCard fixture={fixture} />)

    expect(container.textContent).toContain('LIVE')
    expect(container.textContent).not.toContain('Score at')
    expect(container.querySelector('.animate-pulse')).toBeTruthy()
  })

  it('drops the LIVE badge and captions the time once the score goes stale', () => {
    vi.setSystemTime(NOW)
    // The real case: last synced 16:15 UTC, rendered at 19:00 UTC.
    const fixture = makeLiveFixture('2026-09-06T16:15:00Z')
    const { container } = render(<FixtureCard fixture={fixture} />)

    // The score itself is still shown — it is the best information we have.
    expect(container.textContent).toContain('1')
    // But it is no longer dressed up as live.
    expect(container.textContent).not.toContain('LIVE')
    expect(container.textContent).toContain('In play')
    // 16:15 UTC renders as 17:15 London time (BST), labelled GMT app-wide.
    expect(container.textContent).toContain('Score at 17:15')
    expect(container.querySelector('.animate-pulse')).toBeNull()
  })

  it('keeps the LIVE badge for a scoreless in-play fixture regardless of age', () => {
    vi.setSystemTime(NOW)
    // No score to be stale about — 0-0 has not been reported yet at all.
    const fixture = makeLiveFixture('2026-09-06T16:15:00Z')
    fixture.home_score = null
    fixture.away_score = null
    const { container } = render(<FixtureCard fixture={fixture} />)

    expect(container.textContent).toContain('LIVE')
    expect(container.textContent).not.toContain('Score at')
  })

  it('leaves FINISHED fixtures alone — a final score never goes stale', () => {
    vi.setSystemTime(NOW)
    const fixture = makeLiveFixture('2026-09-06T16:15:00Z')
    fixture.status = 'FINISHED'
    fixture.home_score = 2
    fixture.away_score = 1
    const { container } = render(<FixtureCard fixture={fixture} />)

    expect(container.textContent).toContain('FT')
    expect(container.textContent).not.toContain('Score at')
    expect(container.textContent).not.toContain('In play')
  })
})
