/**
 * HomeRankWidget tests — Phase 11 Plan 02 Task 3.
 *
 * Renders viewer's rank plus up to 2 neighbours on each side. Clamps at
 * list bounds. Returns null if viewer is not a member.
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'

import { HomeRankWidget } from '@/components/member/home-rank-widget'

function buildMembers(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    memberId: `m-${i + 1}`,
    displayName: `Member ${i + 1}`,
    rank: i + 1,
    totalPoints: 1000 - i * 50,
  }))
}

describe('HomeRankWidget', () => {
  it('viewerRank=5 (middle) renders 5 rows: ranks 3, 4, 5, 6, 7', () => {
    const members = buildMembers(20)
    const { container } = render(
      <HomeRankWidget viewerMemberId="m-5" members={members} />,
    )
    const rows = container.querySelectorAll('[data-testid="rank-row"]')
    expect(rows.length).toBe(5)
    const texts = Array.from(rows).map((r) => r.textContent ?? '')
    expect(texts[0]).toContain('Member 3')
    expect(texts[2]).toContain('Member 5')
    expect(texts[4]).toContain('Member 7')
  })

  it('viewerRank=1 (top) clamps to ranks 1, 2, 3 (3 rows)', () => {
    const members = buildMembers(20)
    const { container } = render(
      <HomeRankWidget viewerMemberId="m-1" members={members} />,
    )
    const rows = container.querySelectorAll('[data-testid="rank-row"]')
    expect(rows.length).toBe(3)
    expect(rows[0].textContent).toContain('Member 1')
    expect(rows[2].textContent).toContain('Member 3')
  })

  it('viewerRank=20 (bottom) clamps to ranks 18, 19, 20 (3 rows)', () => {
    const members = buildMembers(20)
    const { container } = render(
      <HomeRankWidget viewerMemberId="m-20" members={members} />,
    )
    const rows = container.querySelectorAll('[data-testid="rank-row"]')
    expect(rows.length).toBe(3)
    expect(rows[0].textContent).toContain('Member 18')
    expect(rows[2].textContent).toContain('Member 20')
  })

  it('returns null when viewerMemberId is null', () => {
    const members = buildMembers(10)
    const { container } = render(
      <HomeRankWidget viewerMemberId={null} members={members} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('returns null when viewerMemberId is not in members list (e.g. admin-only user)', () => {
    const members = buildMembers(10)
    const { container } = render(
      <HomeRankWidget viewerMemberId="not-in-list" members={members} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('viewer row carries a highlight class', () => {
    const members = buildMembers(10)
    const { container } = render(
      <HomeRankWidget viewerMemberId="m-5" members={members} />,
    )
    const viewerRow = container.querySelector(
      '[data-row-variant="rank-row-viewer"]',
    )
    expect(viewerRow).not.toBeNull()
    expect(viewerRow?.textContent).toContain('Member 5')
  })

  it('renders a "View full league table" CTA linking to /standings', () => {
    const members = buildMembers(10)
    const { container } = render(
      <HomeRankWidget viewerMemberId="m-5" members={members} />,
    )
    const cta = container.querySelector('a[href="/standings"]')
    expect(cta).not.toBeNull()
  })
})
