'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'
import { useFocusTrap } from './use-focus-trap'

// SSR guard: `document` does not exist while the tree renders on the server, so
// the portal must not be created until after hydration. `useSyncExternalStore`
// gives that as a plain false-on-server / true-on-client read, with no
// setState-in-an-effect cascade.
const subscribeNever = () => () => {}
const getClient = () => true
const getServer = () => false

/**
 * The overlay contract shared by `Modal`, `SlideOver` and `BottomSheet`:
 * hydration guard for the portal, Escape to close, body scroll lock, focus into
 * the panel on open and back to the opener on close, and a focus trap for as
 * long as the dialog is on screen.
 *
 * Each component supplies its own markup and design-system block; everything
 * about *behaviour* lives here so the three cannot drift apart again.
 */
export function useOverlay<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const mounted = useSyncExternalStore(subscribeNever, getClient, getServer)
  const panelRef = useRef<T>(null)
  const restoreRef = useRef<HTMLElement | null>(null)

  // Escape to close.
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  // Body scroll lock. The previous value is captured so nested overlays restore
  // to whatever the outer one set rather than blowing the lock away.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [open])

  // Focus the panel on open, hand focus back on close.
  // `mounted` is a dep because the panel does not exist on the first client
  // render (the portal is withheld until after hydration) - without it an
  // overlay that starts open would never receive focus.
  useEffect(() => {
    if (!open || !mounted) return
    restoreRef.current = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    return () => { restoreRef.current?.focus?.() }
  }, [open, mounted])

  // `aria-modal="true"` claims the background is inert; the trap makes that true
  // for keyboard users.
  useFocusTrap(panelRef, open && mounted)

  return { mounted, panelRef }
}
