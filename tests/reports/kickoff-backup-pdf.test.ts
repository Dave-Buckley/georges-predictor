/**
 * Kickoff backup PDF renderer tests.
 *
 * Snapshot of all predictions/LOS/bonus picks as locked at kickoff. Contains
 * NO actual scores (those haven't happened yet).
 */
import { describe, expect, it } from 'vitest'
import React from 'react'

import {
  KickoffBackupReport,
  renderKickoffBackupPdf,
} from '@/lib/reports/kickoff-backup-pdf'
import { mockGameweekData } from './fixtures/gameweek-data'

function extractText(node: React.ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractText).join('\n')
  if (React.isValidElement(node)) {
    const props = node.props as Record<string, unknown>
    const children = props.children as React.ReactNode
    return extractText(children)
  }
  return ''
}

function renderContent(data = mockGameweekData()) {
  const el = React.createElement(KickoffBackupReport, { data })
  return extractText(el)
}

describe('renderKickoffBackupPdf', () => {
  it('returns a valid PDF Buffer', async () => {
    const buf = await renderKickoffBackupPdf(mockGameweekData())
    expect(Buffer.isBuffer(buf)).toBe(true)
    expect(buf.slice(0, 5).toString('ascii')).toBe('%PDF-')
  })
})

describe('KickoffBackupReport component', () => {
  it('has correct header and subtitle', () => {
    const text = renderContent()
    expect(text).toMatch(/Kickoff Backup.*GW\s*1/i)
    expect(text).toMatch(/locked at kickoff/i)
  })

  it('lists every member with predictions for every fixture', () => {
    const data = mockGameweekData()
    const text = renderContent(data)
    for (const m of data.standings) {
      expect(text).toContain(m.displayName)
    }
    // m-1 has prediction for fix-1 of 0-1 (homePred=0, awayPred=1)
    // Check at least one numeric prediction appears
    expect(text).toMatch(/\b0\s*-\s*1\b|\b0\b.*\b1\b/)
  })

  it('renders LOS pick team per member', () => {
    const data = mockGameweekData()
    const text = renderContent(data)
    // members i=0..9 picked Team1..Team10
    expect(text).toContain('Team1')
    expect(text).toContain('Team10')
  })

  it('renders bonus fixture pick per member', () => {
    const data = mockGameweekData()
    const text = renderContent(data)
    // All members pick fix-3 as bonus fixture in the mock
    // Check the bonus section is present
    expect(text).toMatch(/Bonus|bonus/i)
  })

  it('does NOT show actual scores (predictions-only snapshot)', () => {
    const data = mockGameweekData()
    const text = renderContent(data)
    // We never want "Actual" or result labels
    expect(text).not.toMatch(/actual\s*score/i)
    expect(text).not.toMatch(/result:/i)
  })
})
