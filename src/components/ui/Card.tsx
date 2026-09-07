import type { ComponentPropsWithoutRef, ReactNode } from 'react'

interface CardProps extends ComponentPropsWithoutRef<'div'> {
  /** When false the `.card` padding is dropped - use for edge-to-edge tables. */
  padded?: boolean
  /** Adds `.card-fixed-h` so the card keeps a stable height with a scrolling body. */
  fixedHeight?: boolean
  children?: ReactNode
}

/**
 * The one surface primitive: `.card` from the design system.
 * Everything else (rows, tables, stats) sits inside one of these.
 */
export default function Card({
  padded = true,
  fixedHeight = false,
  className,
  style,
  children,
  ...rest
}: CardProps) {
  const classes = ['card', fixedHeight && 'card-fixed-h', className].filter(Boolean).join(' ')

  return (
    <div
      className={classes}
      style={padded ? style : { padding: 0, ...style }}
      {...rest}
    >
      {children}
    </div>
  )
}
