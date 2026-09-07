import type { ComponentPropsWithoutRef } from 'react'

type Size = number | string

function size(value: Size): string {
  return typeof value === 'number' ? `${value}px` : value
}

interface SkeletonProps extends Omit<ComponentPropsWithoutRef<'div'>, 'width' | 'height'> {
  /** Number = px, string = any CSS length. Defaults to filling its container. */
  width?: Size
  /** Number = px, string = any CSS length. */
  height?: Size
  /** Overrides the default `--radius-sm` corner. */
  radius?: Size
}

/**
 * Shimmering `.skeleton` block. The project uses these instead of spinners for
 * every async surface, so a skeleton should mirror the shape of the real content.
 */
export default function Skeleton({
  width = '100%',
  height = 14,
  radius,
  className,
  style,
  ...rest
}: SkeletonProps) {
  const classes = ['skeleton', className].filter(Boolean).join(' ')

  return (
    <div
      className={classes}
      aria-hidden
      style={{
        width: size(width),
        height: size(height),
        ...(radius !== undefined ? { borderRadius: size(radius) } : null),
        ...style,
      }}
      {...rest}
    />
  )
}

interface SkeletonTextProps extends Omit<ComponentPropsWithoutRef<'div'>, 'children'> {
  /** How many placeholder lines to stack. */
  lines?: number
}

/** A stack of skeleton lines, with the last one short so it reads as prose. */
export function SkeletonText({ lines = 3, className, ...rest }: SkeletonTextProps) {
  return (
    <div className={['stack-sm', className].filter(Boolean).join(' ')} {...rest}>
      {Array.from({ length: Math.max(0, lines) }, (_, i) => (
        <Skeleton key={i} width={i === lines - 1 && lines > 1 ? '60%' : '100%'} />
      ))}
    </div>
  )
}
