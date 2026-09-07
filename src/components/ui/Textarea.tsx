import type { ComponentPropsWithoutRef } from 'react'

export interface TextareaProps extends ComponentPropsWithoutRef<'textarea'> {
  /** Paints the invalid border and sets aria-invalid for assistive tech. */
  invalid?: boolean
}

/**
 * Multi-line input primitive. Height and resize behaviour come from
 * `textarea.input`; the invalid border comes from `.input[aria-invalid="true"]`.
 */
export default function Textarea({
  invalid = false,
  className,
  rows = 3,
  ...rest
}: TextareaProps) {
  const cls = ['input', className].filter(Boolean).join(' ')

  return (
    <textarea
      {...rest}
      rows={rows}
      className={cls}
      aria-invalid={invalid || undefined}
    />
  )
}
