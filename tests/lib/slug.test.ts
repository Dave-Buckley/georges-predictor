/**
 * toSlug pure helper tests — Phase 11 Plan 01 Task 2.
 *
 * The output MUST align with the Postgres functional UNIQUE index created in
 * migration 012 (`lower(btrim(replace(display_name,' ','-')))`). The app-side
 * regex collapses runs of whitespace to a single dash — a minor divergence
 * documented in the migration; the DB uniqueness still holds for any
 * well-formed display_name.
 */
import { describe, it, expect } from 'vitest'

import { toSlug } from '@/lib/members/slug'

describe('toSlug', () => {
  it('lowercases + replaces a single space with a dash', () => {
    expect(toSlug('John Smith')).toBe('john-smith')
  })

  it('trims leading and trailing whitespace before slugging', () => {
    expect(toSlug('  John Smith  ')).toBe('john-smith')
  })

  it('collapses runs of whitespace to a single dash', () => {
    expect(toSlug('John   Smith')).toBe('john-smith')
  })

  it('lowercases uppercase input', () => {
    expect(toSlug('JOHN SMITH')).toBe('john-smith')
  })

  it('returns a single-word slug unchanged apart from case', () => {
    expect(toSlug('Dave')).toBe('dave')
  })

  it('handles mixed whitespace (tab, newline) as a single dash', () => {
    expect(toSlug('John\t\nSmith')).toBe('john-smith')
  })

  it('round-trips back through the Postgres expression for simple names', () => {
    // Simulate what Postgres `lower(btrim(replace(x,' ','-')))` would yield
    // for a cleaned display_name. The app must agree on this path.
    const displayName = 'Jane Doe'
    const pgEquivalent = displayName.trim().toLowerCase().replace(/ /g, '-')
    expect(toSlug(displayName)).toBe(pgEquivalent)
  })
})
