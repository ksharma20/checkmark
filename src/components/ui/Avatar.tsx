import type { ComponentPropsWithoutRef, CSSProperties } from 'react'

const DEFAULT_SIZE = 34

export interface AvatarProps extends ComponentPropsWithoutRef<'div'> {
  name: string
  /** Diameter in px. Defaults to the 34px baked into `.avatar`. */
  size?: number
  /** Optional tint — background and foreground are derived from it via color-mix. */
  color?: string
  src?: string
}

/** First letter of the first two words, uppercased. "Ada Lovelace" -> "AL". */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
}

/** Circular identity token. Falls back to derived initials when there is no image. */
export default function Avatar({
  name,
  size = DEFAULT_SIZE,
  color,
  src,
  className,
  style,
  ...rest
}: AvatarProps) {
  const cls = ['avatar', className].filter(Boolean).join(' ')

  // Only override what `.avatar` cannot express: a caller-supplied diameter and
  // a caller-supplied tint. Everything else stays in the stylesheet.
  const overrides: CSSProperties = {
    ...(size !== DEFAULT_SIZE
      ? { width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.37)}px` }
      : null),
    ...(color ? { background: `color-mix(in srgb, ${color} 16%, transparent)`, color } : null),
    ...style,
  }

  return (
    <div
      role="img"
      aria-label={name}
      title={name}
      {...rest}
      className={cls}
      style={Object.keys(overrides).length > 0 ? overrides : undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt="" className="h-full w-full rounded-full object-cover" /> : initials(name)}
    </div>
  )
}
