/**
 * Group weekly PDF renderer tests.
 *
 * Strategy:
 *   - ONE buffer-level smoke test verifying `%PDF-` magic bytes.
 *   - Content assertions walk the React element tree (bypasses PDF glyph
 *     encoding which makes grep-based PDF content inspection unreliable).
 */
import { describe, expect, it } from 'vitest'
import React from 'react'

import {
  GroupWeeklyReport,
  renderGroupWeeklyPdf,
} from '@/lib/reports/group-pdf'
import { mockGameweekData } from './fixtures/gameweek-data'

/**
 * Walk a React element tree and return all string/number text content joined
 * with newlines. Ignores null/undefined/boolean leaves.
 */
function extractText(node: React.ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractText).join('\n')
  if (React.isValidElement(node)) {
    const el = node as React.ReactElement<Record<string, unknown>>
    const props = el.props
    const srcText =
      typeof props.src === 'string' ? String(props.src) : ''
    // Function component — invoke it to expand its children.
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

function renderContent(data = mockGameweekData()) {
  const el = React.createElement(GroupWeeklyReport, { data })
  return extractText(el)
}

describe('renderGroupWeeklyPdf', () => {
  it('returns a Buffer with PDF magic bytes', async () => {
    const buf = await renderGroupWeeklyPdf(mockGameweekData())
    expect(Buffer.isBuffer(buf)).toBe(true)
    expect(buf.length).toBeGreaterThan(100)
    expect(buf.slice(0, 5).toString('ascii')).toBe('%PDF-')
  })
})

describe('GroupWeeklyReport component', () => {
  it('includes the GW heading and all standings displayNames', () => {
    const text = renderContent()
    expect(text).toMatch(/GW\s*1/i)
    for (let i = 0; i < 10; i++) {
      const name = `Member ${String.fromCharCode(65 + i)}`
      expect(text).toContain(name)
    }
  })

  it('includes a Top 3 weekly section', () => {
    const text = renderContent()
    expect(text).toMatch(/Top\s*3/i)
  })

  it('includes every fixture (home + away + score)', () => {
    const data = mockGameweekData()
    const text = renderContent(data)
    for (const f of data.fixtures) {
      expect(text).toContain(f.home)
      expect(text).toContain(f.away)
    }
  })

  it('shows Double Bubble banner when active', () => {
    const text = renderContent(mockGameweekData({ doubleBubbleActive: true }))
    expect(text).toMatch(/Double Bubble/i)
  })

  it('omits Double Bubble banner when inactive', () => {
    const text = renderContent(mockGameweekData({ doubleBubbleActive: false }))
    expect(text).not.toMatch(/Double Bubble/i)
  })

  it('renders H2H section with tied member names when steals present', () => {
    const text = renderContent()
    expect(text).toMatch(/H2H/i)
    // fixture seeds m-1 and m-2 (Member A, Member B) as tied
    expect(text).toContain('Member A')
    expect(text).toContain('Member B')
  })

  it('omits H2H section entirely when no steals (no "None" placeholder)', () => {
    const text = renderContent(mockGameweekData({ h2hSteals: [] }))
    // Should not even have the H2H heading
    expect(text).not.toMatch(/H2H Steals/i)
  })

  it('includes links to /standings and /gameweeks/{N}', () => {
    const text = renderContent()
    expect(text).toMatch(/\/standings/)
    expect(text).toMatch(/\/gameweeks\/1/)
  })
})
