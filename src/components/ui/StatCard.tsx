import type { ComponentPropsWithoutRef, ReactNode } from 'react'

type Accent = 'brand' | 'amber' | 'danger' | 'default'

/**
 * `.stat-num` already paints `--navy` and `.dash-ic` already paints `--brand`,
 * so only the three off-default accents need a modifier class.
 */
const ACCENT_CLASS: Record<Accent, string | null> = {
  brand: 'accent-brand',
  amber: 'accent-amber',
  danger: 'accent-danger',
  default: null,
}

interface StatCardProps extends Omit<ComponentPropsWithoutRef<'div'>, 'title'> {
  /** Uppercase eyebrow above the number. */
  label: ReactNode
  /** The number itself - ReactNode so callers can append units or a Skeleton. */
  value: ReactNode
  /** Optional muted line under the number. */
  hint?: ReactNode
  /** Optional glyph, rendered in the `.dash-ic` corner badge. */
  icon?: ReactNode
  accent?: Accent
}

/**
 * The dashboard stat tile: `.card` + `.t-eyebrow` + `.stat-num`.
 * `.dash-ic` is absolutely positioned, so the card gets `position: relative`
 * whenever an icon is supplied.
 */
export default function StatCard({
  label,
  value,
  hint,
  icon,
  accent = 'default',
  onClick,
  className,
  style,
  ...rest
}: StatCardProps) {
  const classes = ['card', onClick && 'rowlink', className].filter(Boolean).join(' ')
  const accentClass = ACCENT_CLASS[accent]

  return (
    <div
      className={classes}
      onClick={onClick}
      style={icon ? { position: 'relative', ...style } : style}
      {...rest}
    >
      <div className="t-eyebrow">{label}</div>
      <div className={['stat-num', accentClass].filter(Boolean).join(' ')} style={{ marginTop: '6px' }}>
        {value}
      </div>
      {hint && <div className="t-muted" style={{ marginTop: '4px' }}>{hint}</div>}
      {icon && (
        <span className={['dash-ic', accentClass].filter(Boolean).join(' ')} aria-hidden>
          {icon}
        </span>
      )}
    </div>
  )
}
