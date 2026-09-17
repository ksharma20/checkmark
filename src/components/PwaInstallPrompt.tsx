'use client'

import { useState, useEffect, useSyncExternalStore } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'pwa_install_dismissed'

/**
 * `unavailable` - already installed, or the user dismissed the banner before.
 * `ios`         - no `beforeinstallprompt` on iOS Safari; the banner is purely
 *                 the "tap Share, then Add to Home Screen" instruction.
 * `generic`     - everywhere else; the banner waits for the browser to offer
 *                 `beforeinstallprompt` before it appears.
 */
type InstallContext = 'unavailable' | 'ios' | 'generic'

// `matchMedia`, `localStorage` and `navigator` are all browser-only, so the
// server can only answer `unavailable` and the real value can only be read
// after hydration. `useSyncExternalStore` expresses that as a plain
// server/client snapshot pair instead of a setState-in-an-effect cascade -
// same pattern as the SSR mount guard in `src/components/ui/Modal.tsx`.
// There is no event to subscribe to, so subscribe is a no-op.
const subscribeNever = () => () => {}

function getInstallContext(): InstallContext {
  // Already installed as PWA - skip
  if (window.matchMedia('(display-mode: standalone)').matches) return 'unavailable'
  // User dismissed before - skip
  try {
    if (localStorage.getItem(DISMISSED_KEY)) return 'unavailable'
  } catch {
    // Storage can throw when site data is blocked; treat as "not dismissed".
  }
  const ua = navigator.userAgent
  const ios = /iPhone|iPad|iPod/.test(ua) && !(window.navigator as Navigator & { standalone?: boolean }).standalone
  return ios ? 'ios' : 'generic'
}

const getServerInstallContext = (): InstallContext => 'unavailable'

export default function PwaInstallPrompt() {
  const [dismissed, setDismissed] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  const context = useSyncExternalStore(subscribeNever, getInstallContext, getServerInstallContext)
  const isIos = context === 'ios'

  useEffect(() => {
    if (context !== 'generic') return
    function handler(e: Event) {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [context])

  // iOS shows as soon as it is eligible; every other platform waits until the
  // browser has actually handed over a deferred prompt. Same visibility rule
  // the two `setShow(true)` calls used to encode.
  const show = !dismissed && (isIos || (context === 'generic' && deferredPrompt !== null))

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setDismissed(true)
  }

  async function install() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setDismissed(true)
    } else {
      dismiss()
    }
    setDeferredPrompt(null)
  }

  if (!show) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 200,
      padding: '12px 16px',
      paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
      background: 'var(--navy)',
      borderTop: '1px solid rgba(255,255,255,0.08)',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    }}>
      {/* Icon */}
      <div style={{
        width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
        background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '16px', color: '#fff',
      }}>
        ✓
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', fontWeight: 700, color: '#fff', margin: 0 }}>
          Add to Home Screen
        </p>
        {isIos ? (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'rgba(255,255,255,0.6)', margin: 0, marginTop: '1px' }}>
            Tap <strong style={{ color: 'rgba(255,255,255,0.85)' }}>Share</strong> then &ldquo;Add to Home Screen&rdquo;
          </p>
        ) : (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'rgba(255,255,255,0.6)', margin: 0, marginTop: '1px' }}>
            Install for the best experience
          </p>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
        {!isIos && (
          <button
            type="button"
            onClick={install}
            style={{
              height: '34px', padding: '0 14px',
              background: 'var(--brand)', color: '#fff',
              border: 'none', borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Install
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          style={{
            height: '34px', padding: '0 10px',
            background: 'transparent', color: 'rgba(255,255,255,0.5)',
            border: '1px solid rgba(255,255,255,0.15)', borderRadius: 'var(--radius-sm)',
            fontFamily: 'var(--font-body)', fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>
    </div>
  )
}
