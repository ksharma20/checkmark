'use client'

import type { ComponentPropsWithoutRef } from 'react'

export interface ToggleProps
  extends Omit<ComponentPropsWithoutRef<'button'>, 'onChange' | 'children' | 'type'> {
  checked: boolean
  onChange: (next: boolean) => void
  /** Required — the switch has no visible text, so this is its accessible name. */
  label: string
  disabled?: boolean
}

/**
 * On/off switch. A real <button role="switch"> rather than a styled checkbox:
 * it is keyboard-operable out of the box (Space/Enter) and announces its state
 * through aria-checked.
 */
export default function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
  className,
  onClick,
  ...rest
}: ToggleProps) {
  const cls = ['toggle', checked && 'on', className].filter(Boolean).join(' ')

  return (
    <button
      {...rest}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      className={cls}
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented) return
        onChange(!checked)
      }}
    >
      <span className="knob" aria-hidden="true" />
    </button>
  )
}
