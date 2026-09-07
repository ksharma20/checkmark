export interface DeptBarItem {
  /** Row caption. Supplied by the caller - never derived here. */
  label: string
  /** Value shown on the right of the row. */
  count: number
  /** Bar fill width, 0-100. */
  percent: number
  /** Overrides the `.progress` default `--brand` fill. */
  color?: string
}

interface DeptBarsProps {
  items: DeptBarItem[]
  /** Accessible name for the group. Required. */
  label: string
  className?: string
}

/**
 * Labelled horizontal bars - "headcount by department" and friends.
 *
 * Built on the `.progress` track; only the fill's width and colour are per-item,
 * so those are the only inline values here. The group is `role="group"` rather
 * than `role="img"` on purpose: each row already exposes its caption and count
 * as real text, and `role="img"` would hide that from assistive tech.
 */
export default function DeptBars({ items, label, className }: DeptBarsProps) {
  const classes = ['stack', className].filter(Boolean).join(' ')

  return (
    <div role="group" aria-label={label} className={classes}>
      {items.map((item, i) => (
        <div key={`${item.label}-${i}`}>
          <div className="row-between mb-1.5">
            <span className="t-secondary">{item.label}</span>
            <span className="mono t-secondary">{item.count}</span>
          </div>
          <div className="progress" aria-hidden="true">
            <div
              style={{
                width: `${Math.max(0, Math.min(100, item.percent))}%`,
                ...(item.color ? { ['--progress-fill' as string]: item.color } : null),
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
