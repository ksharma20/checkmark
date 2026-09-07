'use client'

import { useId, useRef, useState } from 'react'
import type { ComponentPropsWithoutRef, DragEvent } from 'react'

export interface DropzoneProps
  extends Omit<ComponentPropsWithoutRef<'label'>, 'onDrop' | 'children'> {
  onFile: (file: File) => void
  accept?: string
  /** Visible prompt. Also the accessible name of the underlying file input. */
  label: string
  compact?: boolean
  disabled?: boolean
}

/**
 * File picker that also accepts a drag-and-drop.
 *
 * The <label> wraps a visually-hidden (but still focusable) <input type="file">,
 * so clicking the zone, tabbing to it and pressing Enter both open the native
 * file dialog — no synthetic click plumbing, and screen readers see a real input.
 */
export default function Dropzone({
  onFile,
  accept,
  label,
  compact = false,
  disabled = false,
  className,
  ...rest
}: DropzoneProps) {
  const [dragging, setDragging] = useState(false)
  // Depth counter: dragenter/dragleave also fire for child nodes, so a plain
  // boolean flickers as the pointer crosses the label's own text.
  const depth = useRef(0)
  const inputId = useId()

  // The dragging and disabled states are styled off the data attributes below
  // (`.dropzone[data-dragging="true"]` / `[data-disabled="true"]`), so the
  // component only has to report state - it never paints it.
  const cls = ['dropzone', compact && 'compact', className].filter(Boolean).join(' ')

  const reset = () => {
    depth.current = 0
    setDragging(false)
  }

  const handleDragEnter = (event: DragEvent<HTMLLabelElement>) => {
    if (disabled) return
    event.preventDefault()
    depth.current += 1
    setDragging(true)
  }

  const handleDragOver = (event: DragEvent<HTMLLabelElement>) => {
    if (disabled) return
    // Required, otherwise the browser navigates to the dropped file.
    event.preventDefault()
  }

  const handleDragLeave = (event: DragEvent<HTMLLabelElement>) => {
    if (disabled) return
    event.preventDefault()
    depth.current -= 1
    if (depth.current <= 0) reset()
  }

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    reset()
    if (disabled) return
    const file = event.dataTransfer?.files?.[0]
    if (file) onFile(file)
  }

  return (
    <label
      {...rest}
      htmlFor={inputId}
      className={cls}
      aria-disabled={disabled || undefined}
      data-dragging={dragging || undefined}
      data-disabled={disabled || undefined}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        id={inputId}
        type="file"
        accept={accept}
        disabled={disabled}
        className="sr-only"
        aria-label={label}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onFile(file)
          // Reset so picking the same file twice in a row still fires onChange.
          event.target.value = ''
        }}
      />
      <span>{label}</span>
    </label>
  )
}
