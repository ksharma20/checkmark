import type { ComponentPropsWithoutRef } from 'react'

export interface Segment {
  /** Raw value - segments are normalised against the total, not pre-computed %. */
  value: number
  /** Any CSS color. */
  color: string
  /** Optional tooltip text; user-facing, so it comes from the caller. */
  label?: string
}

interface SplitBarProps extends ComponentPropsWithoutRef<'div'> {
  segments: Segment[]
}

/**
 * `.split-bar` - a stacked proportional bar (WFO / WFH / Leave and friends).
 * A zero total leaves the empty track showing rather than dividing by zero.
 */
export default function SplitBar({ segments, className, ...rest }: SplitBarProps) {
  const classes = ['split-bar', className].filter(Boolean).join(' ')
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0)

  return (
    <div className={classes} {...rest}>
      {total > 0 &&
        segments.map((segment, i) => {
          const value = Math.max(0, segment.value)
          if (value === 0) return null
          return (
            <div
              key={i}
              title={segment.label}
              style={{ width: `${(value / total) * 100}%`, background: segment.color }}
            />
          )
        })}
    </div>
  )
}
