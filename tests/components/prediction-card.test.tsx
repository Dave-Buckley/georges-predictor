/**
 * FixtureCard (prediction card) colour-accent tests — Phase 11 Plan 01.
 *
 * Asserts the card applies a left-border accent using the home team's
 * `primary_color` hex. Graceful fallback when colour is null.
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'

import FixtureCard from '@/components/fixtures/fixture-card'
import type { FixtureWithTeams, TeamRow, GameweekRow } from '@/lib/supabase/types'

function makeTeam(overrides: Partial<TeamRow> = {}): TeamRow {
  return {
    id: 't-arsenal',
    external_id: 57,
    name: 'Arsenal FC',
    short_name: 'Arsenal',
    tla: 'ARS',
    crest_url: 'https://crests.football-data.org/57.png',
    updated_at: '2025-08-01T00:00:00Z',
    primary_color: null,
    secondary_color: null,
    ...overrides,
  }
}

function makeGameweek(): GameweekRow {
  return {
    id: 'gw-1',
    number: 1,
    season: 2025,
    status: 'active' as GameweekRow['status'],
    double_bubble: false,
    closed_at: null,
    closed_by: null,
    created_at: '2025-08-01T00:00:00Z',
    kickoff_backup_sent_at: null,
    reports_sent_at: null,
  } as GameweekRow
}

function makeFixture(
  homeColor: string | null = null,
  awayColor: string | null = null,
): FixtureWithTeams {
  return {
    id: 'fix-1',
    external_id: 1,
    gameweek_id: 'gw-1',
    home_team_id: 't-home',
    away_team_id: 't-away',
    kickoff_time: '2099-08-16T14:00:00Z', // future → SCHEDULED, not locked
    status: 'SCHEDULED',
    is_rescheduled: false,
    home_score: null,
    away_score: null,
    result_source: null,
    created_at: '2025-08-01T00:00:00Z',
    updated_at: '2025-08-01T00:00:00Z',
    home_team: makeTeam({ id: 't-home', name: 'Arsenal FC', primary_color: homeColor }),
    away_team: makeTeam({ id: 't-away', name: 'Chelsea FC', primary_color: awayColor }),
    gameweek: makeGameweek(),
  }
}

describe('FixtureCard — home team primary_color accent', () => {
  it('applies a left-border style consuming the home team primary_color hex', () => {
    const fixture = makeFixture('#EF0107', '#034694')
    const { container } = render(<FixtureCard fixture={fixture} />)
    // Outermost wrapper is the first div rendered by the component.
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper).toBeTruthy()
    // Border-left must reference the home-team hex. jsdom normalises hex
    // colours to rgb(...) notation when read back from inline styles, so
    // accept either form. #EF0107 → rgb(239, 1, 7).
    const inline = wrapper.getAttribute('style') ?? ''
    const classes = wrapper.getAttribute('class') ?? ''
    const combined = `${inline} ${classes}`.toLowerCase()
    const hasHex = combined.includes('#ef0107')
    const hasRgb = combined.includes('rgb(239, 1, 7)')
    expect(hasHex || hasRgb).toBe(true)
    // And: must be applied as a left-border declaration (not e.g. background)
    expect(inline.toLowerCase()).toContain('border-left')
  })

  it('falls back gracefully when home team has no primary_color (transparent accent)', () => {
    const fixture = makeFixture(null, null)
    const { container } = render(<FixtureCard fixture={fixture} />)
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper).toBeTruthy()
    // Should not throw / still render. The inline style may contain
    // "transparent" or nothing at all — we only care that no crash occurs
    // and the card renders.
    expect(wrapper.tagName).toBe('DIV')
  })
})
