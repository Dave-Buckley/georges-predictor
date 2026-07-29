/**
 * PreSeasonPicker tests.
 *
 * The 12 team dropdowns were Radix Selects until July 2026, when the same
 * library on the signup name list turned out to be unscrollable on phones.
 * A team list is 20 PL / 24 Championship clubs, so a member who cannot scroll
 * cannot complete their picks at all — and picks close on 1 August.
 *
 * These assert the control is a native <select> holding every option, which is
 * what guarantees the OS scrolls it regardless of list length.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import {
  PreSeasonPicker,
  EMPTY_PICKER_STATE,
  isPickerComplete,
  type PickerState,
} from '@/app/(member)/pre-season/_components/pre-season-picker'

const PL_TEAMS = [
  'Arsenal', 'Aston Villa', 'Bournemouth', 'Brentford', 'Brighton',
  'Chelsea', 'Coventry', 'Crystal Palace', 'Everton', 'Fulham',
  'Hull City', 'Ipswich', 'Leeds United', 'Liverpool', 'Man City',
  'Man United', 'Newcastle', 'Nottingham Forest', 'Sunderland', 'Tottenham',
].map((name) => ({ name }))

const CHAMPIONSHIP = [
  'Birmingham', 'Blackburn', 'Bolton Wanderers', 'Bristol City', 'Cardiff City',
  'Charlton', 'Derby County', 'Lincoln City', 'Middlesbrough', 'Millwall',
  'Norwich', 'Portsmouth', 'Preston', 'QPR', 'Sheffield United',
  'Southampton', 'Stoke City', 'Swansea', 'Watford', 'West Brom',
  'Wrexham', 'Burnley', 'Wolves', 'West Ham',
]

function setup(state: PickerState = EMPTY_PICKER_STATE) {
  const onChange = vi.fn()
  const utils = render(
    <PreSeasonPicker
      state={state}
      onChange={onChange}
      plTeams={PL_TEAMS}
      championship={CHAMPIONSHIP}
    />,
  )
  return { onChange, ...utils }
}

describe('PreSeasonPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all 12 pick slots as native selects', () => {
    setup()
    const selects = screen.getAllByRole('combobox')
    expect(selects).toHaveLength(12)
    for (const el of selects) {
      expect(el.tagName).toBe('SELECT')
    }
  })

  it('offers every PL club in a Top 4 slot, so none is unreachable', () => {
    setup()
    const top4 = screen.getByLabelText('Top 4 — pick 1')
    const values = Array.from((top4 as HTMLSelectElement).options)
      .map((o) => o.value)
      .filter(Boolean)

    expect(values).toHaveLength(PL_TEAMS.length)
    for (const team of PL_TEAMS) {
      expect(values).toContain(team.name)
    }
  })

  it('offers every Championship club in a promoted slot', () => {
    setup()
    const promoted = screen.getByLabelText('Promoted — pick 1')
    const values = Array.from((promoted as HTMLSelectElement).options)
      .map((o) => o.value)
      .filter(Boolean)

    expect(values).toHaveLength(CHAMPIONSHIP.length)
    for (const team of CHAMPIONSHIP) {
      expect(values).toContain(team)
    }
  })

  it('reports a Top 4 selection back to the parent', () => {
    const { onChange } = setup()
    fireEvent.change(screen.getByLabelText('Top 4 — pick 2'), {
      target: { value: 'Liverpool' },
    })

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ top4: [null, 'Liverpool', null, null] }),
    )
  })

  it('reports the playoff winner back to the parent', () => {
    const { onChange } = setup()
    fireEvent.change(screen.getByLabelText('Playoff winner'), {
      target: { value: 'Middlesbrough' },
    })

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ promoted_playoff_winner: 'Middlesbrough' }),
    )
  })

  it('shows the placeholder while a slot is empty and the team once picked', () => {
    const { rerender } = setup()
    const slot = screen.getByLabelText('10th place pick') as HTMLSelectElement
    expect(slot.value).toBe('')

    rerender(
      <PreSeasonPicker
        state={{ ...EMPTY_PICKER_STATE, tenth_place: 'Everton' }}
        onChange={vi.fn()}
        plTeams={PL_TEAMS}
        championship={CHAMPIONSHIP}
      />,
    )
    expect((screen.getByLabelText('10th place pick') as HTMLSelectElement).value).toBe(
      'Everton',
    )
  })

  it('disables every slot when the picker is disabled (past deadline)', () => {
    render(
      <PreSeasonPicker
        state={EMPTY_PICKER_STATE}
        onChange={vi.fn()}
        plTeams={PL_TEAMS}
        championship={CHAMPIONSHIP}
        disabled
      />,
    )
    for (const el of screen.getAllByRole('combobox')) {
      expect((el as HTMLSelectElement).disabled).toBe(true)
    }
  })

  it('isPickerComplete only passes once all 12 slots are filled', () => {
    expect(isPickerComplete(EMPTY_PICKER_STATE)).toBe(false)
    expect(
      isPickerComplete({
        top4: ['Arsenal', 'Liverpool', 'Man City', 'Chelsea'],
        tenth_place: 'Everton',
        relegated: ['Ipswich', 'Hull City', 'Sunderland'],
        promoted: ['Southampton', 'Middlesbrough', 'Millwall'],
        promoted_playoff_winner: 'Middlesbrough',
      }),
    ).toBe(true)
  })
})
