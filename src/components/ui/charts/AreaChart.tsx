export interface AreaChartPoint {
  /** X-axis tick text. Supplied by the caller - never derived here. */
  label: string
  value: number
}

interface AreaChartProps {
  points: AreaChartPoint[]
  /** Accessible name for the chart. Required - the SVG is `role="img"`. */
  label: string
  /** Rendered pixel height. The viewBox scales to fill the width. */
  height?: number
  /** Top of the value axis. Derived from the data when omitted. */
  yMax?: number
  /** Render an x label every N points. */
  xTickEvery?: number
  /** Stroke colour. The fill is always a 14% tint of `--brand`. */
  color?: string
  className?: string
}

// Fixed user-space geometry - the viewBox scales it to whatever width it gets.
const W = 900
const H = 260
const PAD_L = 30
const PAD_R = 10
const PAD_T = 6
const PAD_B = 26
const X_LABEL_BAND = 22
const GRID_LINES = 5

function formatTick(value: number): string {
  // Evenly-dividing a span of e.g. 3 produces 2.2500000000000004 - round before
  // deciding whether the tick reads as a whole number.
  const rounded = Math.round(value * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

/**
 * Hand-rolled area chart - the "presence by hour" shape from the approved mock.
 *
 * Deliberately no charting library: the project ships none, and every other SVG
 * chart here (see `InsightsClient`) is hand-rolled the same way. Pure render, no
 * state, so it works as a Server Component.
 */
export default function AreaChart({
  points,
  label,
  height = 220,
  yMax,
  xTickEvery = 2,
  color = 'var(--brand)',
  className,
}: AreaChartProps) {
  const peak = points.length > 0 ? Math.max(...points.map((p) => p.value)) : 0
  const top = yMax ?? Math.max(4, Math.ceil(peak) + 1)
  const span = top > 0 ? top : 1

  // A single point would divide by zero; pin it to the left edge instead.
  const lastIndex = Math.max(1, points.length - 1)
  const x = (i: number) => PAD_L + (i / lastIndex) * (W - PAD_L - PAD_R)
  const y = (v: number) => PAD_T + (1 - v / span) * (H - PAD_T - PAD_B)

  const linePoints = points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')
  const areaPoints = points.length > 0
    ? `${x(0)},${y(0)} ${linePoints} ${x(points.length - 1)},${y(0)}`
    : ''

  const gridValues = Array.from({ length: GRID_LINES }, (_, i) => span - (span / (GRID_LINES - 1)) * i)
  const tickEvery = Math.max(1, Math.floor(xTickEvery))
  const classes = ['w-full', className].filter(Boolean).join(' ')

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${W} ${H + X_LABEL_BAND}`}
      height={height}
      className={classes}
    >
      {gridValues.map((g, i) => (
        <g key={`grid-${i}`}>
          <line
            x1={PAD_L} y1={y(g)} x2={W - PAD_R} y2={y(g)}
            stroke="var(--border)" strokeWidth={1} strokeDasharray="4 4"
          />
          <text
            x={PAD_L - 8} y={y(g) + 4}
            textAnchor="end" fontSize={12} fill="var(--text-muted)"
          >
            {formatTick(g)}
          </text>
        </g>
      ))}

      {areaPoints ? (
        <polygon points={areaPoints} fill="color-mix(in srgb, var(--brand) 14%, transparent)" />
      ) : null}

      {linePoints ? (
        <polyline
          points={linePoints}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}

      {points.map((p, i) => (
        i % tickEvery === 0 ? (
          <text
            key={`${p.label}-${i}`}
            x={x(i)} y={H + 16}
            textAnchor="middle" fontSize={12} fill="var(--text-muted)"
          >
            {p.label}
          </text>
        ) : null
      ))}
    </svg>
  )
}
