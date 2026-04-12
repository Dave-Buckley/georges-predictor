/**
 * WeeklyPointsChart — pure SVG weekly-points line chart with running-total overlay.
 * Phase 11 Plan 02 Task 2.
 *
 * Per CONTEXT.md: NO charting library. Pure SVG only.
 * Path geometry follows 11-RESEARCH.md Example 4.
 */

export interface WeeklyPointsChartEntry {
  gw: number
  /** Points scored THIS gameweek alone (for the bars). */
  points: number
  /** Cumulative season total through this gameweek (for the line). */
  runningTotal: number
}

interface WeeklyPointsChartProps {
  weeks: WeeklyPointsChartEntry[]
  width?: number
  height?: number
}

export function WeeklyPointsChart({
  weeks,
  width = 600,
  height = 200,
}: WeeklyPointsChartProps) {
  if (weeks.length === 0) return null

  const maxTotal = Math.max(...weeks.map((w) => w.runningTotal), 1)
  const maxWeekly = Math.max(...weeks.map((w) => w.points), 1)
  const xStep = width / Math.max(weeks.length - 1, 1)

  // Running total line
  const runningPath = weeks
    .map(
      (w, i) =>
        `${i === 0 ? 'M' : 'L'} ${(i * xStep).toFixed(2)} ${(
          height -
          (w.runningTotal / maxTotal) * height
        ).toFixed(2)}`,
    )
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto"
      role="img"
      aria-label="Weekly points with running total"
    >
      {/* Running total line (PL purple) */}
      <path
        d={runningPath}
        fill="none"
        stroke="#37003c"
        strokeWidth={2}
        data-testid="chart-running-line"
      />
      {/* Weekly points bars (PL green), clamped to ~40% of chart height */}
      {weeks.map((w, i) => {
        const barHeight = (w.points / maxWeekly) * height * 0.4
        return (
          <rect
            key={w.gw}
            x={i * xStep - 4}
            y={height - barHeight}
            width={8}
            height={barHeight}
            fill="#00ff85"
            data-testid="chart-week-bar"
          />
        )
      })}
    </svg>
  )
}

export default WeeklyPointsChart
