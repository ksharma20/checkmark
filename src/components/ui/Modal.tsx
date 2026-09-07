'use client'

import { useId } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { useOverlay } from './use-overlay'

interface ModalProps {
  open: boolean
  onClose: () => void
  /** Rendered as the panel heading and wired up via `aria-labelledby`. */
  title?: ReactNode
  children?: ReactNode
  /** Actions row pinned under the body - typically cancel + confirm buttons. */
  footer?: ReactNode
  /** Overrides the `.modal .panel` default of 360px. */
  maxWidth?: number | string
  /** Merged onto the `.panel` element. */
  className?: string
}

/**
 * Centred dialog built on the `.modal` > `.scrim` + `.panel` design-system trio.
 *
 * Portalled into `document.body` so it escapes any transformed/overflow-hidden
 * ancestor. Closes on scrim click and Escape, locks body scroll while open, and
 * moves focus into the panel on open - trapping Tab inside it, as
 * `aria-modal="true"` promises - restoring focus to the previously focused
 * element on close. That whole contract lives in `useOverlay`.
 */
export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidth,
  className,
}: ModalProps) {
  const { mounted, panelRef } = useOverlay<HTMLDivElement>(open, onClose)
  const titleId = useId()

  if (!mounted || !open) return null

  const panelClasses = ['panel', className].filter(Boolean).join(' ')

  return createPortal(
    <div className="modal">
      <div className="scrim" onClick={onClose} />
      <div
        ref={panelRef}
        className={panelClasses}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        style={maxWidth === undefined ? undefined : { maxWidth }}
      >
        {title ? <p id={titleId} className="panel-title">{title}</p> : null}
        {children}
        {footer ? <div className="panel-actions">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  )
}
