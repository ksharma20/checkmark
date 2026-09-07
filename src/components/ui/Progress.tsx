import type { ComponentPropsWithoutRef } from 'react'

interface ProgressProps extends Omit<ComponentPropsWithoutRef<'div'>, 'color'> {
  /** 0-100; values outside the range are clamped. */
  percent: number
  /** Any CSS color - defaults to the `--brand` fill set by `.progress > div`. */
  color?: string
}

/** Single-value `.progress` bar. The fill animates in via the stylesheet. */
export default function Progress({ percent, color, className, ...rest }: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0))
  const classes = ['progress', className].filter(Boolean).join(' ')

  return (
    <div
      className={classes}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      {...rest}
    >
      <div
        style={{
          width: `${clamped}%`,
          ...(color ? { ['--progress-fill' as string]: color } : null),
        }}
      />
    </div>
  )
}
