'use client'

import { useState, useEffect } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'pwa_install_dismissed'

export default function PwaInstallPrompt() {
  const [show, setShow] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    // Already installed as PWA — skip
    if (window.matchMedia('(display-mode: standalone)').matches) return
    // User dismissed before — skip
    if (localStorage.getItem(DISMISSED_KEY)) return

    const ua = navigator.userAgent
    const ios = /iPhone|iPad|iPod/.test(ua) && !(window.navigator as Navigator & { standalone?: boolean }).standalone

    if (ios) {
      setIsIos(true)
      setShow(true)
      return
    }

    function handler(e: Event) {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setShow(false)
  }

  async function install() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShow(false)
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
        fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '16px', color: '#fff',
      }}>
        ✓
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: 'Syne, sans-serif', fontSize: '13px', fontWeight: 700, color: '#fff', margin: 0 }}>
          Add to Home Screen
        </p>
        {isIos ? (
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: 'rgba(255,255,255,0.6)', margin: 0, marginTop: '1px' }}>
            Tap <strong style={{ color: 'rgba(255,255,255,0.85)' }}>Share</strong> then &ldquo;Add to Home Screen&rdquo;
          </p>
        ) : (
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: 'rgba(255,255,255,0.6)', margin: 0, marginTop: '1px' }}>
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
              fontFamily: 'DM Sans, sans-serif', fontSize: '13px', fontWeight: 500,
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
            fontFamily: 'DM Sans, sans-serif', fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>
    </div>
  )
}
