'use client'

import type { ComponentPropsWithoutRef, ReactNode } from 'react'

export type IconButtonVariant = 'approve' | 'decline' | 'plain'

export interface IconButtonProps extends Omit<ComponentPropsWithoutRef<'button'>, 'children'> {
  variant?: IconButtonVariant
  /** Required — icon-only controls have no visible text, so this is the accessible name. */
  label: string
  icon: ReactNode
}

const VARIANT_CLASS: Record<IconButtonVariant, string> = {
  approve: 'icon-btn-approve',
  decline: 'icon-btn-decline',
  plain: 'icon-btn-plain',
}

/** Square icon-only action. `label` becomes both aria-label and the tooltip. */
export default function IconButton({
  variant = 'plain',
  label,
  icon,
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  const cls = ['icon-btn', VARIANT_CLASS[variant], 'pressable', className].filter(Boolean).join(' ')

  return (
    <button {...rest} type={type} className={cls} aria-label={label} title={label}>
      <span aria-hidden="true" className="inline-flex items-center justify-center">{icon}</span>
    </button>
  )
}
