'use client'

import type { ComponentPropsWithoutRef, ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'md' | 'sm'

export interface ButtonProps extends ComponentPropsWithoutRef<'button'> {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
  loading?: boolean
  icon?: ReactNode
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
}

/**
 * The single button primitive for /me and /ws.
 * `loading` disables the button and dims the label — the design system forbids
 * spinners, so busy state is announced with aria-busy instead of an animation.
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  loading = false,
  icon,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  const cls = [
    'btn',
    VARIANT_CLASS[variant],
    size === 'sm' && 'btn-sm',
    block && 'btn-block',
    'pressable',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      {...rest}
      type={type}
      className={cls}
      disabled={loading || disabled}
      aria-busy={loading || undefined}
    >
      {icon ? <span aria-hidden="true" className="inline-flex shrink-0 items-center">{icon}</span> : null}
      <span className={loading ? 'opacity-60' : undefined}>{children}</span>
    </button>
  )
}
