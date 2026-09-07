import type { ComponentPropsWithoutRef, ReactNode } from 'react'

interface EmptyStateProps extends Omit<ComponentPropsWithoutRef<'div'>, 'title'> {
  /** Headline - always passed in, never hardcoded here. */
  title: ReactNode
  /** Optional second line explaining how to fill the empty list. */
  hint?: ReactNode
  /** Optional glyph above the title. */
  icon?: ReactNode
}

/** The `.empty` placeholder shown wherever a list or table has no rows. */
export default function EmptyState({ title, hint, icon, className, ...rest }: EmptyStateProps) {
  const classes = ['empty', className].filter(Boolean).join(' ')

  return (
    <div className={classes} {...rest}>
      {icon && (
        <div style={{ marginBottom: '10px', opacity: 0.7 }} aria-hidden>
          {icon}
        </div>
      )}
      <div className="t-h2" style={{ color: 'var(--text-secondary)' }}>{title}</div>
      {hint && <p className="t-muted" style={{ margin: '6px 0 0' }}>{hint}</p>}
    </div>
  )
}
