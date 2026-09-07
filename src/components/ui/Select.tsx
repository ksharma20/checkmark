import type { ComponentPropsWithoutRef } from 'react'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps extends ComponentPropsWithoutRef<'select'> {
  options: SelectOption[]
  /** Rendered as a disabled, empty-valued first option. */
  placeholder?: string
  invalid?: boolean
}

/**
 * Native <select> styled by `select.input`; the invalid border comes from
 * `.input[aria-invalid="true"]`.
 * Native is deliberate: it gives correct keyboard and mobile behaviour for free.
 */
export default function Select({
  options,
  placeholder,
  invalid = false,
  className,
  children,
  ...rest
}: SelectProps) {
  const cls = ['input', className].filter(Boolean).join(' ')

  return (
    <select
      {...rest}
      className={cls}
      aria-invalid={invalid || undefined}
    >
      {placeholder ? (
        <option value="" disabled>
          {placeholder}
        </option>
      ) : null}
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
      {children}
    </select>
  )
}
