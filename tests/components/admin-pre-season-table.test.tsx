/**
 * AdminPreSeasonTable tests.
 *
 * On 12 Aug 2026 George reported that one member (Barny) had no "Set picks"
 * button while the members either side of him did — leaving no way to enter
 * picks for him at all. The Actions column is the ninth of nine in a table
 * that scrolls sideways on a phone, which is the device George administers
 * from.
 *
 * These assert the invariant that fixes it: EVERY member in the list gets a
 * set/edit control, in both the phone card layout and the desktop table, no
 * matter whether they have submitted.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import {
  AdminPreSeasonTable,
  buildAdminPreSeasonRows,
} from '@/app/(admin)/admin/pre-season/_components/admin-pre-season-table'
import type { PreSeasonExportRow } from '@/lib/pre-season/export'

// The dialog pulls in a server action; stub it down to its trigger so this
// test stays about which members get a control.
vi.mock('@/components/admin/late-joiner-picks-dialog', () => ({
  LateJoinerPicksDialog: ({ trigger }: { trigger: React.ReactNode }) => (
    <>{trigger}</>
  ),
}))

const PL_TEAMS = [{ name: 'Arsenal' }, { name: 'Everton' }]
const CHAMPIONSHIP = ['Middlesbrough', 'Southampton']

const MEMBERS = [
  { id: 'm-barny', display_name: 'Barny' },
  { id: 'm-dan', display_name: 'Dan' },
  { id: 'm-elliott', display_name: 'Elliott' },
  { id: 'm-ben', display_name: 'Ben' },
]

/** Ben is the only one who has submitted — the other three have not. */
const EXPORT_ROWS: PreSeasonExportRow[] = [
  {
    member_id: 'm-ben',
    member_name: 'Ben',
    season: 2026,
    top4: ['Arsenal', 'Everton', 'Arsenal', 'Everton'],
    tenth_place: 'Everton',
    relegated: ['Arsenal', 'Everton', 'Arsenal'],
    promoted: ['Middlesbrough', 'Southampton', 'Middlesbrough'],
    promoted_playoff_winner: 'Middlesbrough',
    calculated_points: null,
    awarded_points: null,
    confirmed: false,
    submitted_by_admin: true,
    submitted_at: '2026-08-12T10:34:56.892+00:00',
  },
]

function renderTable() {
  const rows = buildAdminPreSeasonRows(MEMBERS, EXPORT_ROWS)
  return render(
    <AdminPreSeasonTable
      season={2026}
      plTeams={PL_TEAMS}
      championship={CHAMPIONSHIP}
      rows={rows}
    />,
  )
}

describe('AdminPreSeasonTable', () => {
  it('gives every member a picks control, submitted or not', () => {
    renderTable()

    for (const member of MEMBERS) {
      const label = member.display_name === 'Ben' ? 'Edit picks' : 'Set picks'
      // One control per layout (phone card + desktop table).
      expect(
        screen.getAllByRole('button', {
          name: `${label} for ${member.display_name}`,
        }),
      ).toHaveLength(2)
    }
  })

  it('offers Set picks to a member who has not submitted', () => {
    renderTable()

    const barny = screen.getAllByRole('button', { name: 'Set picks for Barny' })
    expect(barny.length).toBeGreaterThan(0)
    expect(barny[0]).toBeEnabled()
  })

  it('renders one control per member per layout — none dropped', () => {
    renderTable()

    const set = screen.getAllByRole('button', { name: /^Set picks for / })
    const edit = screen.getAllByRole('button', { name: /^Edit picks for / })
    expect(set).toHaveLength(3 * 2) // Barny, Dan, Elliott — two layouts each
    expect(edit).toHaveLength(1 * 2) // Ben
  })

  it('shows the submission count', () => {
    renderTable()
    expect(screen.getByText('1/4 submitted')).toBeInTheDocument()
  })

  it('tells George a member has no picks yet rather than showing blanks', () => {
    renderTable()
    expect(
      screen.getAllByText(/No picks yet/i).length,
    ).toBeGreaterThanOrEqual(3)
  })
})

describe('buildAdminPreSeasonRows', () => {
  it('includes members with no picks row, flagged as not submitted', () => {
    const rows = buildAdminPreSeasonRows(MEMBERS, EXPORT_ROWS)

    expect(rows).toHaveLength(4)
    const barny = rows.find((r) => r.member_id === 'm-barny')
    expect(barny).toBeDefined()
    expect(barny?.submitted).toBe(false)
    expect(barny?.member_name).toBe('Barny')
  })

  it('sorts not-submitted members first, then alphabetically', () => {
    const rows = buildAdminPreSeasonRows(MEMBERS, EXPORT_ROWS)
    expect(rows.map((r) => r.member_name)).toEqual([
      'Barny',
      'Dan',
      'Elliott',
      'Ben',
    ])
  })
})
