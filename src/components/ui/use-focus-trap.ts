'use client'

import { useEffect } from 'react'
import type { RefObject } from 'react'

/**
 * Everything the platform treats as tabbable, modulo the extra checks in
 * `tabbable()` below. `[tabindex]` deliberately matches `tabindex="-1"` too so
 * the filter can reject it in one place rather than through selector gymnastics.
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button',
  'input',
  'select',
  'textarea',
  'iframe',
  'object',
  'embed',
  'audio[controls]',
  'video[controls]',
  'summary',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]',
].join(',')

/**
 * Cheap visibility test: an element with no boxes is not rendered, which covers
 * `display: none`, `hidden`, and collapsed ancestors without a `getComputedStyle`
 * call per candidate.
 */
function isRendered(el: HTMLElement): boolean {
  return el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0
}

function tabbable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) =>
      el.tabIndex >= 0 &&
      !el.hasAttribute('disabled') &&
      el.getAttribute('aria-hidden') !== 'true' &&
      isRendered(el),
  )
}

/**
 * Keeps Tab / Shift+Tab inside `ref` while `active` is true.
 *
 * `aria-modal="true"` tells assistive technology the rest of the page is inert;
 * without a trap, Tab walks straight into it and the markup lies. This closes
 * that gap for keyboard users.
 *
 * The candidate list is rebuilt on every keydown rather than cached on mount,
 * because dialog content is dynamic - a form reveals fields, a list finishes
 * loading, a button flips to `disabled` mid-submit. A snapshot taken at open
 * time would send focus to elements that no longer exist.
 *
 * With zero tabbable descendants there is nowhere to cycle, so Tab is swallowed
 * and focus is parked on the panel itself (every caller renders it with
 * `tabIndex={-1}`), which keeps the trap honest instead of throwing or letting
 * focus escape.
 */
export function useFocusTrap<T extends HTMLElement>(
  ref: RefObject<T | null>,
  active: boolean,
): void {
  useEffect(() => {
    if (!active) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab' || e.altKey || e.ctrlKey || e.metaKey) return
      const root = ref.current
      if (!root) return

      const items = tabbable(root)
      if (items.length === 0) {
        e.preventDefault()
        root.focus()
        return
      }

      const first = items[0]
      const last = items[items.length - 1]
      const current = document.activeElement as HTMLElement | null

      // Focus is on the panel itself (the on-open state) or has somehow left the
      // dialog: pull it to whichever end the Tab direction implies.
      if (!current || current === root || !root.contains(current)) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
        return
      }

      if (e.shiftKey && current === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && current === last) {
        e.preventDefault()
        first.focus()
      }
    }

    // Capture phase so the trap sees Tab before any content handler can consume
    // it, and still fires when focus has drifted outside the panel.
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [ref, active])
}
