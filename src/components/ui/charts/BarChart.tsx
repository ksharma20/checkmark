export interface BarChartBar {
  /** Tick text for this bar. Supplied by the caller - never derived here. */
  label: string
  value: number
  /** Renders the muted `.bar.weekend` fill - weekends, holidays, no-data days. */
  muted?: boolean
}

interface BarChartProps {
  bars: BarChartBar[]
  /** Accessible name for the chart. Required. */
  label: string
  /** Overrides the `.bar-wrap` default height of 110px. */
  height?: number
  /** Top of the value axis. Derived from the data when omitted. */
  max?: number
  /** Hover text per bar. Defaults to `label: value`. */
  formatTitle?: (bar: BarChartBar) => string
  className?: string
}

/**
 * The 14-day WFO trend strip.
 *
 * CSS-only rather than SVG: `.bar-wrap` / `.bar` / `.bar.weekend` already carry
 * the fills, radii and the grow transition, so bar heights are the one thing
 * left to compute. They are percentages of the wrapper, which keeps the chart
 * correct whatever height the caller (or the stylesheet) settles on.
 */
export default function BarChart({
  bars,
  label,
  height,
  max,
  formatTitle,
  className,
}: BarChartProps) {
  const peak = bars.length > 0 ? Math.max(...bars.map((b) => b.value)) : 0
  const top = max ?? peak
  const span = top > 0 ? top : 1
  // 150px is the named `.bar-wrap-lg` variant; any other height is caller-
  // chosen and stays inline.
  const tall = height === 150
  const classes = ['bar-wrap', tall && 'bar-wrap-lg', className].filter(Boolean).join(' ')

  return (
    <div
      role="img"
      aria-label={label}
      className={classes}
      style={height === undefined || tall ? undefined : { height }}
    >
      {bars.map((b, i) => (
        <div
          key={`${b.label}-${i}`}
          className={b.muted ? 'bar weekend' : 'bar'}
          title={formatTitle ? formatTitle(b) : `${b.label}: ${b.value}`}
          style={{ height: `${Math.max(0, Math.min(100, (b.value / span) * 100))}%` }}
        />
      ))}
    </div>
  )
}
