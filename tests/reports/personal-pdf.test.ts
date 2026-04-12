/**
 * Personal weekly PDF renderer tests.
 */
import { describe, expect, it } from 'vitest'
import React from 'react'

import {
  PersonalWeeklyReport,
  renderPersonalWeeklyPdf,
} from '@/lib/reports/personal-pdf'
import { mockGameweekData } from './fixtures/gameweek-data'

function extractText(node: React.ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractText).join('\n')
  if (React.isValidElement(node)) {
    const el = node as React.ReactElement<Record<string, unknown>>
    const props = el.props
    const srcText =
      typeof props.src === 'string' ? String(props.src) : ''
    if (typeof el.type === 'function') {
      const fn = el.type as (p: Record<string, unknown>) => React.ReactNode
      const result = fn(props)
      return [extractText(result), srcText].filter(Boolean).join('\n')
    }
    const children = props.children as React.ReactNode
    return [extractText(children), srcText].filter(Boolean).join('\n')
  }
  return ''
}

function renderContent(memberId: string, data = mockGameweekData()) {
  const el = React.createElement(PersonalWeeklyReport, { data, memberId })
  return extractText(el)
}

describe('renderPersonalWeeklyPdf', () => {
  it('returns a valid PDF Buffer', async () => {
    const buf = await renderPersonalWeeklyPdf(mockGameweekData(), 'm-1')
    expect(Buffer.isBuffer(buf)).toBe(true)
    expect(buf.slice(0, 5).toString('ascii')).toBe('%PDF-')
  })
})

describe('PersonalWeeklyReport component', () => {
  it('shows displayName, rank "X / Y", and weekly points', () => {
    const text = renderContent('m-3')
    expect(text).toContain('Member C')
    expect(text).toMatch(/Rank\s*3\s*\/\s*10/)
    // weeklyPoints for m-3 is 30 - 2*2 = 26
    expect(text).toContain('26')
  })

  it('renders a per-fixture row with prediction vs actual and points', () => {
    const data = mockGameweekData()
    const text = renderContent('m-1', data)
    // m-1 has predictions for first 5 fixtures: home=idx (0..4), away=idx+1
    // Fixture 0: pred 0-1, actual 2-1, points=30 (idx===0)
    // Fixture 1: pred 1-2, actual null (SCHEDULED), points=10
    // Fixture 2: pred 2-3, actual 2-1, points=0, isBonus=true
    expect(text).toContain('30')
    expect(text).toContain('10')
  })

  it('shows bonus indicator on bonus fixture row', () => {
    const text = renderContent('m-1')
    // Star / bonus marker present
    expect(text).toMatch(/bonus/i)
  })

  it('renders H2H callout when member is in a steal', () => {
    // m-1 is in the seeded h2h steal (tied with m-2)
    const text = renderContent('m-1')
    expect(text).toMatch(/H2H/i)
  })

  it('shows LOS team + survived/eliminated for the member', () => {
    const text = renderContent('m-1')
    // m-1 → Team1, survived=true
    expect(text).toContain('Team1')
  })

  it('throws when memberId not in standings', async () => {
    expect(() =>
      extractText(
        React.createElement(PersonalWeeklyReport, {
          data: mockGameweekData(),
          memberId: 'does-not-exist',
        }),
      ),
    ).toThrow(/Member does-not-exist not found/)
  })
})
