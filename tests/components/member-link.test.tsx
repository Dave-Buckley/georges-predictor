/**
 * MemberLink component tests — Phase 11 Plan 01 Task 2.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { MemberLink } from '@/components/shared/member-link'

describe('MemberLink', () => {
  it('renders an <a> element with href /members/<slug> and the display name as text', () => {
    render(<MemberLink displayName="John Smith" />)
    const link = screen.getByRole('link', { name: 'John Smith' })
    expect(link).toBeInTheDocument()
    expect(link.getAttribute('href')).toBe('/members/john-smith')
    expect(link.textContent).toBe('John Smith')
  })

  it('merges a caller-supplied className with its own defaults', () => {
    render(
      <MemberLink displayName="Jane Doe" className="extra-caller-class" />,
    )
    const link = screen.getByRole('link', { name: 'Jane Doe' })
    const cls = link.getAttribute('class') ?? ''
    expect(cls).toContain('extra-caller-class')
    // Default hover accent token from the component itself.
    expect(cls).toContain('hover:text-pl-green')
  })

  it('slugs multi-word names with whitespace collapse', () => {
    render(<MemberLink displayName="  Dave   The  Rave  " />)
    const link = screen.getByRole('link', { name: /Dave/ })
    expect(link.getAttribute('href')).toBe('/members/dave-the-rave')
  })
})
