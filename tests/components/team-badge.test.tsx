/**
 * TeamBadge smoke test — mounts the component and asserts the team crest
 * <img> renders. Protects the component from silent regressions during the
 * Phase 11 colour-integration work.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import TeamBadge from '@/components/fixtures/team-badge'
import type { TeamRow } from '@/lib/supabase/types'

function makeTeam(overrides: Partial<TeamRow> = {}): TeamRow {
  return {
    id: 't-arsenal',
    external_id: 57,
    name: 'Arsenal FC',
    short_name: 'Arsenal',
    tla: 'ARS',
    crest_url: 'https://crests.football-data.org/57.png',
    updated_at: '2025-08-01T00:00:00Z',
    ...overrides,
  } as TeamRow
}

describe('TeamBadge', () => {
  it('renders the crest <img> with team name as alt text', () => {
    render(<TeamBadge team={makeTeam()} />)
    const img = screen.getByRole('img', { name: 'Arsenal FC' })
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', 'https://crests.football-data.org/57.png')
  })

  it('falls back to a TLA badge when crest_url is null', () => {
    render(<TeamBadge team={makeTeam({ crest_url: null })} />)
    // The fallback uses aria-label=team.name on the coloured circle
    const fallback = screen.getByLabelText('Arsenal FC')
    expect(fallback).toBeInTheDocument()
    expect(fallback.textContent).toBe('ARS')
  })
})
