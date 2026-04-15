/**
 * HomeRankWidget tests.
 *
 * Renders 10 members above viewer + viewer + 2 below, clamped at list
 * bounds. Returns null if viewer is not a member.
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
  it('viewerRank=15 (middle) renders ranks 5..17 (13 rows)', () => {
    const members = buildMembers(30)
    const { container } = render(
      <HomeRankWidget viewerMemberId="m-15" members={members} />,
    )
    const rows = container.querySelectorAll('[data-testid="rank-row"]')
    expect(rows.length).toBe(13)
    const texts = Array.from(rows).map((r) => r.textContent ?? '')
    expect(texts[0]).toContain('Member 5')
    expect(texts[10]).toContain('Member 15')
    expect(texts[12]).toContain('Member 17')
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

  it('viewerRank=20 (bottom) clamps to ranks 10..20 (11 rows)', () => {
    const members = buildMembers(20)
    const { container } = render(
      <HomeRankWidget viewerMemberId="m-20" members={members} />,
    )
    const rows = container.querySelectorAll('[data-testid="rank-row"]')
    expect(rows.length).toBe(11)
    expect(rows[0].textContent).toContain('Member 10')
    expect(rows[10].textContent).toContain('Member 20')
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
