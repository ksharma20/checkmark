'use client'

import type { ReactNode } from 'react'
import Button from './Button'
import Modal from './Modal'

interface ConfirmDialogProps {
  open: boolean
  /** Cancel. Also fired by the scrim and Escape, via `Modal`. */
  onClose: () => void
  onConfirm: () => void
  /** Short verb phrase - "Delete holiday", "Retract announcement". */
  title: string
  /** The one-line explanation. Rendered as `.t-secondary`. */
  body: ReactNode
  /** Optional second line for a consequence worth stating. Rendered as `.field-hint`. */
  note?: ReactNode
  confirmLabel: string
  /** Shown on the confirm button while `loading`. Falls back to `confirmLabel`. */
  busyLabel?: string
  cancelLabel: string
  loading?: boolean
  /**
   * Blocks the confirm action while leaving the dialog open and readable.
   *
   * For a precondition the dialog itself is explaining - a dry run that would
   * change nothing, a form above it that is not yet valid. Distinct from
   * `loading`, which means the request is already in flight.
   */
  confirmDisabled?: boolean
  /** Server-side failure, rendered under the body as `.field-error` with `role="alert"`. */
  error?: string | null
  /** Confirm button variant. Destructive is the common case, so it is the default. */
  tone?: 'danger' | 'primary'
  /** Overrides the `.modal .panel` default of 360px. */
  maxWidth?: number
}

/**
 * The confirmation dialog for every consequential action.
 *
 * Built on `Modal`, so it inherits the whole overlay contract - portal, Escape,
 * body scroll lock, focus-in, focus-restore and the focus trap - rather than
 * re-implementing any of it. That inheritance is the point: before this existed
 * the app had five `window.confirm()` calls, which are unstyled, not
 * theme-aware, block the main thread and sit outside every accessibility and
 * touch-target guarantee the rest of the system makes, plus eight hand-rolled
 * `Modal` confirms that repeated one shape and drifted from each other.
 *
 * The shape is fixed on purpose: title, one `.t-secondary` line, an optional
 * muted caveat, an optional error, then cancel-then-confirm actions. Anything
 * that needs more than that is not a confirmation - use `Modal` directly.
 *
 * While `loading`, cancel is disabled so the dialog cannot be dismissed by
 * clicking it mid-request. Escape and the scrim are deliberately left working:
 * a request that never returns must not trap the user in a dialog with no way
 * out, and the caller already has to tolerate an unmount mid-flight.
 */
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  note,
  confirmLabel,
  busyLabel,
  cancelLabel,
  loading = false,
  confirmDisabled = false,
  error,
  tone = 'danger',
  maxWidth,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      maxWidth={maxWidth}
      footer={
        <>
          <Button variant="secondary" size="sm" disabled={loading} onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button variant={tone} size="sm" loading={loading} disabled={confirmDisabled} onClick={onConfirm}>
            {loading ? (busyLabel ?? confirmLabel) : confirmLabel}
          </Button>
        </>
      }
    >
      <p className="t-secondary">{body}</p>
      {note ? <p className="field-hint">{note}</p> : null}
      {error ? <p className="field-error" role="alert">{error}</p> : null}
    </Modal>
  )
}
