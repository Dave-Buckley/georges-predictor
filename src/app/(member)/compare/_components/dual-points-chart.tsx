/**
 * DualPointsChart — running-total lines for two members overlaid on one SVG.
 * Pure SVG; follows the same no-dependencies approach as WeeklyPointsChart.
 */

export interface DualSeries {
  label: string
  color: string
  points: Array<{ gw: number; runningTotal: number }>
}

interface DualPointsChartProps {
  a: DualSeries
  b: DualSeries
  width?: number
  height?: number
}

export function DualPointsChart({
  a,
  b,
  width = 600,
  height = 220,
}: DualPointsChartProps) {
  const gwCount = Math.max(a.points.length, b.points.length)
  if (gwCount === 0) return null

  const maxTotal = Math.max(
    ...a.points.map((p) => p.runningTotal),
    ...b.points.map((p) => p.runningTotal),
    1,
  )
  const xStep = width / Math.max(gwCount - 1, 1)

  function pathFor(points: DualSeries['points']): string {
    return points
      .map(
        (p, i) =>
          `${i === 0 ? 'M' : 'L'} ${(i * xStep).toFixed(2)} ${(
            height -
            (p.runningTotal / maxTotal) * height
          ).toFixed(2)}`,
      )
      .join(' ')
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-xs">
        <span className="flex items-center gap-2 text-slate-200">
          <span
            className="inline-block w-3 h-3 rounded-sm"
            style={{ background: a.color }}
          />
          {a.label}
        </span>
        <span className="flex items-center gap-2 text-slate-200">
          <span
            className="inline-block w-3 h-3 rounded-sm"
            style={{ background: b.color }}
          />
          {b.label}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Running points: ${a.label} vs ${b.label}`}
      >
        <path
          d={pathFor(a.points)}
          fill="none"
          stroke={a.color}
          strokeWidth={2.5}
        />
        <path
          d={pathFor(b.points)}
          fill="none"
          stroke={b.color}
          strokeWidth={2.5}
        />
      </svg>
    </div>
  )
}

export default DualPointsChart
