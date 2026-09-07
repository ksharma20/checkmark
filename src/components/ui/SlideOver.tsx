'use client'

import { useId } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { useOverlay } from './use-overlay'

interface SlideOverProps {
  open: boolean
  onClose: () => void
  /** Rendered as the panel heading and wired up via `aria-labelledby`. */
  title?: ReactNode
  children?: ReactNode
  /** Overrides the `.slideover .panel` default of 380px. */
  width?: number | string
  /** Merged onto the `.panel` element. */
  className?: string
}

/**
 * Right-edge drawer built on the `.slideover` > `.scrim` + `.panel` trio.
 *
 * Same portal / Escape / scroll-lock / focus-and-trap contract as `Modal` (all
 * of it in `useOverlay`) - the only difference is which design-system block it
 * renders into.
 */
export default function SlideOver({
  open,
  onClose,
  title,
  children,
  width,
  className,
}: SlideOverProps) {
  const { mounted, panelRef } = useOverlay<HTMLDivElement>(open, onClose)
  const titleId = useId()

  if (!mounted || !open) return null

  const panelClasses = ['panel', className].filter(Boolean).join(' ')

  return createPortal(
    <div className="slideover">
      <div className="scrim" onClick={onClose} />
      <div
        ref={panelRef}
        className={panelClasses}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        style={width === undefined ? undefined : { width }}
      >
        {title ? <p id={titleId} className="t-h2">{title}</p> : null}
        {children}
      </div>
    </div>,
    document.body,
  )
}
