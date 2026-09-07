import type { ComponentPropsWithoutRef, ReactNode } from 'react'

export interface FieldProps extends Omit<ComponentPropsWithoutRef<'div'>, 'children'> {
  label: ReactNode
  htmlFor?: string
  required?: boolean
  /** When present the field reads as invalid and the message is announced. */
  error?: ReactNode
  hint?: ReactNode
  full?: boolean
  children: ReactNode
}

/**
 * Label + control wrapper. Owns the label, the hint and the error message so
 * every form in the app lays those out identically.
 *
 * Pass `htmlFor` matching the control's `id` — that is what wires the label,
 * the hint (`${htmlFor}-hint`) and the error (`${htmlFor}-error`) to it.
 */
export default function Field({
  label,
  htmlFor,
  required = false,
  error,
  hint,
  full = false,
  className,
  children,
  ...rest
}: FieldProps) {
  const cls = [full && 'w-full', className].filter(Boolean).join(' ')

  return (
    <div {...rest} className={cls || undefined}>
      <label className="field-label" htmlFor={htmlFor}>
        {label}
        {required ? (
          <span aria-hidden="true" className="text-danger"> *</span>
        ) : null}
      </label>

      {children}

      {hint && !error ? (
        <p id={htmlFor ? `${htmlFor}-hint` : undefined} className="field-hint">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={htmlFor ? `${htmlFor}-error` : undefined} role="alert" className="field-error">
          {error}
        </p>
      ) : null}
    </div>
  )
}
