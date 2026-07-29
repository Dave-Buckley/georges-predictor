/**
 * NamePicker (signup name step) tests.
 *
 * Covers the two-path chooser introduced in July 2026 after two live problems:
 *
 *  1. The old combined Radix dropdown could not be scrolled on phones, so
 *     members could not reach their own name. The list is now a native
 *     <select>, which the OS scrolls regardless of length.
 *  2. A single combined list let a brand-new member pick a returning player's
 *     name and silently take over their points. Returning and new are now
 *     explicit, separate paths.
 *
 * The key guarantee asserted here: only one control is ever active, so the
 * unused path can never block signup.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import NamePicker from '@/components/auth/name-picker'

const NAMES = ['Charlie', 'Dan', 'Hugo', 'Jonni', 'Leon', 'Obi', 'Rohan']

function setup(props: Partial<React.ComponentProps<typeof NamePicker>> = {}) {
  const onChange = vi.fn()
  const onIsNewMemberChange = vi.fn()
  const utils = render(
    <NamePicker
      importedNames={NAMES}
      value=""
      onChange={onChange}
      isNewMember={false}
      onIsNewMemberChange={onIsNewMemberChange}
      {...props}
    />,
  )
  return { onChange, onIsNewMemberChange, ...utils }
}

describe('NamePicker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── The chooser ─────────────────────────────────────────────────────────────

  it('starts undecided — neither name control is shown', () => {
    setup()
    expect(screen.getByText('I played last season')).toBeDefined()
    expect(screen.getByText("I'm new")).toBeDefined()
    // Neither input is on screen until a path is chosen.
    expect(screen.queryByLabelText('Select your name')).toBeNull()
    expect(screen.queryByPlaceholderText(/Type your name/)).toBeNull()
  })

  // ── Returning path ──────────────────────────────────────────────────────────

  it('shows the name list, and only the name list, for returning players', () => {
    setup()
    fireEvent.click(screen.getByRole('radio', { name: /I played last season/ }))

    expect(screen.getByLabelText('Select your name')).toBeDefined()
    expect(screen.queryByPlaceholderText(/Type your name/)).toBeNull()
  })

  it('lists every unclaimed name as a native option so the OS can scroll it', () => {
    setup()
    fireEvent.click(screen.getByRole('radio', { name: /I played last season/ }))

    const select = screen.getByLabelText('Select your name') as HTMLSelectElement
    expect(select.tagName).toBe('SELECT')

    // Every name is present — nothing is truncated to a visible window.
    for (const name of NAMES) {
      expect(screen.getByRole('option', { name })).toBeDefined()
    }
  })

  it('reports the selected name and marks the member as returning', () => {
    const { onChange, onIsNewMemberChange } = setup()
    fireEvent.click(screen.getByRole('radio', { name: /I played last season/ }))

    expect(onIsNewMemberChange).toHaveBeenCalledWith(false)

    fireEvent.change(screen.getByLabelText('Select your name'), {
      target: { value: 'Hugo' },
    })
    expect(onChange).toHaveBeenCalledWith('Hugo')
  })

  // ── New path ────────────────────────────────────────────────────────────────

  it('shows a text box, and only a text box, for new members', () => {
    const { onIsNewMemberChange } = setup()
    fireEvent.click(screen.getByRole('radio', { name: /I'm new/ }))

    expect(screen.getByPlaceholderText(/Type your name/)).toBeDefined()
    expect(screen.queryByLabelText('Select your name')).toBeNull()
    expect(onIsNewMemberChange).toHaveBeenCalledWith(true)
  })

  it('reports a typed name for new members', () => {
    const { onChange } = setup()
    fireEvent.click(screen.getByRole('radio', { name: /I'm new/ }))

    fireEvent.change(screen.getByPlaceholderText(/Type your name/), {
      target: { value: 'Daddy Dave' },
    })
    expect(onChange).toHaveBeenCalledWith('Daddy Dave')
  })

  // ── Switching paths ─────────────────────────────────────────────────────────

  it('clears the name when switching paths so the wrong one is never submitted', () => {
    const { onChange, onIsNewMemberChange } = setup({ value: 'Hugo' })
    fireEvent.click(screen.getByRole('radio', { name: /I played last season/ }))
    onChange.mockClear()

    fireEvent.click(screen.getByRole('radio', { name: /I'm new/ }))

    expect(onChange).toHaveBeenCalledWith('')
    expect(onIsNewMemberChange).toHaveBeenLastCalledWith(true)
  })

  // ── No names left to claim ──────────────────────────────────────────────────

  it('skips the chooser and goes straight to the text box when no names remain', () => {
    const { onIsNewMemberChange } = setup({ importedNames: [] })

    expect(screen.queryByText('I played last season')).toBeNull()
    expect(screen.getByPlaceholderText(/Type your name/)).toBeDefined()
    // Must still flag as new so the server-side duplicate-name guard runs.
    expect(onIsNewMemberChange).toHaveBeenCalledWith(true)
  })

  // ── Errors ──────────────────────────────────────────────────────────────────

  it('names the missing step when nothing has been chosen yet', () => {
    setup({ error: 'Display name is required' })
    expect(
      screen.getByText(/choose whether you played last season/i),
    ).toBeDefined()
  })

  it('surfaces the real validation error once a path is chosen', () => {
    setup({ error: 'Display name is required' })
    fireEvent.click(screen.getByRole('radio', { name: /I'm new/ }))
    expect(screen.getByText('Display name is required')).toBeDefined()
  })
})
