'use client'

import { Suspense, useEffect, useSyncExternalStore } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

/* ── Two independent signals, one bar ────────────────────────────────────────
   `imperativeCount` is owned by the 10 balanced startProgress()/stopProgress()
   call sites (login page, CheckinButtons) - real network work of unknown
   duration, always stopped in a `finally`. `navActive` is owned by this file
   and tracks a link click until the URL settles.

   They are deliberately NOT one counter. A shared counter is what let a route
   change decrement - and hide - a login request that was still in flight, and
   let one leaked navigation poison every later imperative call for the whole
   session. The bar renders while EITHER signal is up; neither can zero the
   other. `navActive` is a boolean rather than a count, so two clicks before the
   first resolves still clear on one settle. */

type Listener = () => void

let listeners: Listener[] = []
let imperativeCount = 0
let navActive = false
let navTimer: ReturnType<typeof setTimeout> | null = null

/** Safety net for navigations that never change the URL (in-place error
 *  boundary, notFound(), a redirect back to the same address). Navigation only
 *  - imperative work is intentionally uncapped, see startProgress(). */
const NAV_TIMEOUT_MS = 6000

function emit() {
  listeners.forEach((fn) => fn())
}

/* Subscription plumbing for useSyncExternalStore. Reading the snapshot at
   render time (rather than syncing it into state in an effect) means work that
   started before this component's effects ran is picked up on the first paint,
   with no mount race and no cascading render. */
function subscribe(onStoreChange: Listener) {
  listeners.push(onStoreChange)
  return () => {
    listeners = listeners.filter((fn) => fn !== onStoreChange)
  }
}

function getSnapshot() {
  return imperativeCount > 0 || navActive
}

function getServerSnapshot() {
  return false
}

/** Public API - unchanged semantics. Must always be paired with stopProgress()
 *  in a `finally`. Never capped by a timeout: callers await GPS acquisition
 *  (8s budget) before their request even starts, and this bar is the only
 *  feedback they get - the project forbids spinners. */
export function startProgress() {
  imperativeCount++
  emit()
}

export function stopProgress() {
  imperativeCount = Math.max(0, imperativeCount - 1)
  emit()
}

function startNavProgress() {
  if (navTimer) clearTimeout(navTimer)
  navTimer = setTimeout(clearNavProgress, NAV_TIMEOUT_MS)
  if (navActive) return
  navActive = true
  emit()
}

function clearNavProgress() {
  if (navTimer) {
    clearTimeout(navTimer)
    navTimer = null
  }
  if (!navActive) return
  navActive = false
  emit()
}

/** Does this click actually start a navigation away from the current URL? */
function isNavigatingClick(e: MouseEvent): boolean {
  // Middle click opens a background tab; right click opens a menu. Neither
  // navigates this document.
  if (e.button !== 0) return false
  // Modified clicks open a tab/window or download instead of navigating.
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false

  const target = e.target
  if (!(target instanceof Element)) return false
  const anchor = target.closest('a')
  if (!anchor) return false
  if (anchor.hasAttribute('download')) return false
  const linkTarget = anchor.getAttribute('target')
  if (linkTarget && linkTarget !== '_self') return false

  const href = anchor.getAttribute('href')
  if (!href || href.startsWith('#')) return false

  let url: URL
  try {
    url = new URL(href, window.location.href)
  } catch {
    return false
  }
  // Also rejects mailto:/tel:/javascript: - they resolve to a null origin.
  if (url.origin !== window.location.origin) return false

  // The single highest-value guard. Same path + same query means either the
  // exact current URL (clicking the tab you are already on - the most common
  // leak by far) or a hash-only jump written as an absolute path (`/me#top`).
  // Both are same-document: nothing to wait for, so nothing to show.
  if (
    url.pathname === window.location.pathname &&
    url.search === window.location.search
  ) {
    return false
  }

  return true
}

export default function TopProgressBar() {
  // Self-contained Suspense boundary: useSearchParams() below opts its subtree
  // out of static prerendering, and without a boundary `next build` fails on
  // every statically rendered marketing route. Keeping the boundary here rather
  // than in the root layout means the component carries its own requirement.
  return (
    <Suspense fallback={null}>
      <TopProgressBarInner />
    </Suspense>
  )
}

function TopProgressBarInner() {
  const active = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const search = searchParams.toString()

  // The navigation settled. `search` is watched alongside `pathname` because
  // usePathname() excludes the query string, so a `?ws=` switch would otherwise
  // never clear. Clearing is a no-op when no navigation is in flight, so this
  // can never zero an imperative request (it used to).
  useEffect(() => {
    clearNavProgress()
  }, [pathname, search])

  useEffect(() => {
    function onDocumentClick(e: MouseEvent) {
      if (isNavigatingClick(e)) startNavProgress()
    }

    /* BUBBLE phase, on `document`, is load-bearing - do not "fix" this to
       capture. Next mounts the React root on `document` itself
       (next/dist/client/app-index.js: `const appElement = document`), so
       React's delegated listener is registered on this same node at hydration,
       before this effect runs. A bubble listener added here therefore runs
       AFTER every onClick handler in the app. React's synthetic
       stopPropagation() calls native stopPropagation(), which never silences
       listeners on the same node, so we still see the event - correctly, since
       a handler that stops propagation but allows the default IS navigating.

       What we deliberately do NOT do here is reject `e.defaultPrevented`.
       next/link calls e.preventDefault() unconditionally for every local URL
       (next/dist/client/app-dir/link.js) before dispatching its client-side
       navigation, and every internal link in this app is a <Link>. Rejecting on
       that flag would suppress the bar for 100% of navigations. In capture
       phase the flag is instead always false, i.e. dead code. Either way it
       cannot tell a routed <Link> from an anchor that only preventDefaults; the
       URL guard above and NAV_TIMEOUT_MS cover that case instead. */
    document.addEventListener('click', onDocumentClick)

    /* Concrete failure this prevents: `src/app/me/settings/page.tsx` renders
       plain <a href="/ws/[slug]/people"> links, which do a full document load.
       The old document goes into bfcache with `navActive` true and its 6s timer
       frozen; pressing Back restores React state verbatim with no pathname or
       search change, so nothing would ever clear it. Clearing before the freeze
       means the restored document comes back clean. */
    function onPageHide() {
      clearNavProgress()
    }
    window.addEventListener('pagehide', onPageHide)

    return () => {
      document.removeEventListener('click', onDocumentClick)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [])

  if (!active) return null

  // Styling and the `cm-progress` sweep live in globals.css so the stylesheet's
  // prefers-reduced-motion guard covers them; under that guard the bar stays
  // visible as a static fill rather than disappearing.
  return (
    <div className="top-progress">
      <div className="bar-sweep" />
    </div>
  )
}
