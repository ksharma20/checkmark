import type { ComponentPropsWithoutRef } from 'react'

export interface InputProps extends ComponentPropsWithoutRef<'input'> {
  /** Paints the invalid border and sets aria-invalid for assistive tech. */
  invalid?: boolean
}

/**
 * Text input primitive. All visual styling comes from `.input`, including the
 * invalid border - `.input[aria-invalid="true"]` paints it, so setting
 * `aria-invalid` is both the accessible signal and the styling hook.
 */
export default function Input({ invalid = false, className, ...rest }: InputProps) {
  const cls = ['input', className].filter(Boolean).join(' ')

  return (
    <input
      {...rest}
      className={cls}
      aria-invalid={invalid || undefined}
    />
  )
}
