/**
 * WeeklyPointsChart tests — Phase 11 Plan 02 Task 2.
 *
 * Pure-SVG chart component — no charting lib (CONTEXT.md locked decision).
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'

import { WeeklyPointsChart } from '@/components/charts/weekly-points-chart'

describe('WeeklyPointsChart', () => {
  it('renders null when weeks array is empty', () => {
    const { container } = render(<WeeklyPointsChart weeks={[]} />)
    expect(container.querySelector('svg')).toBeNull()
  })

  it('renders one running-total <path> and one <rect> per week for 10 weeks', () => {
    const weeks = Array.from({ length: 10 }, (_, i) => ({
      gw: i + 1,
      points: (i + 1) * 10,
      runningTotal: ((i + 1) * (i + 2)) / 2 * 10,
    }))

    const { container } = render(<WeeklyPointsChart weeks={weeks} />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()

    const paths = container.querySelectorAll('path')
    expect(paths.length).toBe(1)

    const rects = container.querySelectorAll('rect')
    expect(rects.length).toBe(10)
  })

  it('scales to container (w-full h-auto) via viewBox', () => {
    const weeks = [
      { gw: 1, points: 10, runningTotal: 10 },
      { gw: 2, points: 20, runningTotal: 30 },
    ]
    const { container } = render(<WeeklyPointsChart weeks={weeks} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('viewBox')).toBe('0 0 600 200')
    const cls = svg?.getAttribute('class') ?? ''
    expect(cls).toContain('w-full')
    expect(cls).toContain('h-auto')
  })

  it('path d-attribute starts with M (move) and uses L (line) thereafter', () => {
    const weeks = [
      { gw: 1, points: 10, runningTotal: 10 },
      { gw: 2, points: 10, runningTotal: 20 },
      { gw: 3, points: 10, runningTotal: 30 },
    ]
    const { container } = render(<WeeklyPointsChart weeks={weeks} />)
    const path = container.querySelector('path')
    const d = path?.getAttribute('d') ?? ''
    expect(d.startsWith('M')).toBe(true)
    expect(d.split('L').length).toBeGreaterThanOrEqual(3) // 1 M + 2 L segments
  })
})
