'use client'

import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { useOverlay } from './use-overlay'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  children?: ReactNode
  /** Merged onto the `.panel` element. */
  className?: string
}

/**
 * The `/me` bottom sheet: `.me-sheet` > `.scrim` + `.panel` + `.handle`.
 *
 * Same portal / Escape / scroll-lock / focus-and-trap contract as `Modal` and
 * `SlideOver`, all of it in `useOverlay`. The sheet is unlabelled by design - its content supplies its own
 * heading - so no `title` prop; callers pass whatever heading they need as part
 * of `children`.
 */
export default function BottomSheet({ open, onClose, children, className }: BottomSheetProps) {
  const { mounted, panelRef } = useOverlay<HTMLDivElement>(open, onClose)

  if (!mounted || !open) return null

  const panelClasses = ['panel', className].filter(Boolean).join(' ')

  return createPortal(
    <div className="me-sheet">
      <div className="scrim" onClick={onClose} />
      <div
        ref={panelRef}
        className={panelClasses}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
      >
        <div className="handle" />
        {children}
      </div>
    </div>,
    document.body,
  )
}
