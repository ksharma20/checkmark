'use client'

import { useEffect, useRef, useState } from 'react'

export interface AreaChartPoint {
  /** X-axis tick text. Supplied by the caller - never derived here. */
  label: string
  value: number
}

interface AreaChartProps {
  points: AreaChartPoint[]
  /** Accessible name for the chart. Required - the SVG is `role="img"`. */
  label: string
  /** Rendered pixel height, and now also the drawing's own height. */
  height?: number
  /** Top of the value axis. Derived from the data when omitted. */
  yMax?: number
  /** MINIMUM stride between x labels. Widened further on a narrow box. */
  xTickEvery?: number
  /** Stroke colour. The fill is always a 14% tint of `--brand`. */
  color?: string
  className?: string
}

// Geometry in CSS pixels. The viewBox is built from the MEASURED width, so one
// user unit is one pixel and nothing here is scaled by the browser.
const PAD_L = 34
const PAD_R = 12
const PAD_T = 8
const PAD_B = 24
const X_LABEL_BAND = 20
const GRID_LINES = 5
const TICK_FONT = 12
/** Narrowest an x label may sit from its neighbour before ticks are dropped. */
const MIN_TICK_GAP = 46
/** How close to an edge a label must be before it stops being centre-anchored. */
const EDGE_ANCHOR = 22

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
 * chart here (see `InsightsClient`) is hand-rolled the same way.
 *
 * **It measures its own width, and that is the whole point.** It used to draw
 * into a fixed 900x282 viewBox and let the browser scale that down to whatever
 * width it got. A viewBox scales EVERYTHING, text included: in the dashboard's
 * chart card the factor was 0.35 on a phone and 0.57 on a desktop, so axis
 * labels specified at 12 rendered at 4.2px and 6.8px - illegible on both. The
 * same scaling letterboxed a 3.19:1 drawing inside a fixed 220px-tall box and
 * left 122px of dead space in the card on mobile.
 *
 * Building the viewBox from the measured width makes one user unit one pixel:
 * labels are 12px everywhere, strokes are 3px everywhere, and the drawing fills
 * its box exactly. The cost is that this is no longer a pure render - it holds
 * the measured width in state and therefore cannot be a Server Component. That
 * property was documented but unused: the only caller is `TodayClient`, which
 * is `'use client'` already.
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
  const hostRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  // The host div is rendered unconditionally and at full height, so it is the
  // element being observed from the first paint and the card never resizes when
  // the drawing appears.
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.round(entry.contentRect.width))
    })
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  const classes = ['w-full', className].filter(Boolean).join(' ')

  const W = width
  const plotH = height - X_LABEL_BAND
  const peak = points.length > 0 ? Math.max(...points.map((p) => p.value)) : 0
  const top = yMax ?? Math.max(4, Math.ceil(peak) + 1)
  const span = top > 0 ? top : 1

  // A single point would divide by zero; pin it to the left edge instead.
  const lastIndex = Math.max(1, points.length - 1)
  const x = (i: number) => PAD_L + (i / lastIndex) * (W - PAD_L - PAD_R)
  const y = (v: number) => PAD_T + (1 - v / span) * (plotH - PAD_T - PAD_B)

  const linePoints = points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')
  const areaPoints = points.length > 0
    ? `${x(0)},${y(0)} ${linePoints} ${x(points.length - 1)},${y(0)}`
    : ''

  const gridValues = Array.from({ length: GRID_LINES }, (_, i) => span - (span / (GRID_LINES - 1)) * i)

  // The caller's stride is a floor, not the answer: at 12px a label needs real
  // room, and 24 hourly points every 2nd tick would collide on a phone. How
  // many fit is a function of the measured width, so it is decided here.
  const plotW = Math.max(1, W - PAD_L - PAD_R)
  const maxTicks = Math.max(1, Math.floor(plotW / MIN_TICK_GAP))
  const tickEvery = Math.max(
    Math.max(1, Math.floor(xTickEvery)),
    Math.ceil(points.length / maxTicks),
  )

  // Anchoring is geometric, not positional: a centred label within half a word
  // of either edge would hang outside the SVG and be clipped.
  const anchorFor = (px: number): 'start' | 'middle' | 'end' => {
    if (px - PAD_L < EDGE_ANCHOR) return 'start'
    if (W - PAD_R - px < EDGE_ANCHOR) return 'end'
    return 'middle'
  }

  return (
    <div ref={hostRef} className={classes} style={{ height }}>
      {W > 0 && (
        <svg role="img" aria-label={label} viewBox={`0 0 ${W} ${height}`} width={W} height={height}>
          {gridValues.map((g, i) => (
            <g key={`grid-${i}`}>
              <line
                x1={PAD_L} y1={y(g)} x2={W - PAD_R} y2={y(g)}
                stroke="var(--border)" strokeWidth={1} strokeDasharray="4 4"
              />
              <text
                x={PAD_L - 8} y={y(g) + 4}
                textAnchor="end" fontSize={TICK_FONT} fill="var(--text-muted)"
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
                x={x(i)} y={plotH + 14}
                textAnchor={anchorFor(x(i))} fontSize={TICK_FONT} fill="var(--text-muted)"
              >
                {p.label}
              </text>
            ) : null
          ))}
        </svg>
      )}
    </div>
  )
}
