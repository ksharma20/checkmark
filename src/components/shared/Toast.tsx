'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'

type ToastKind = 'success' | 'error' | 'info'

interface ToastState {
  id: number
  message: string
  kind: ToastKind
}

interface ToastContextValue {
  show: (message: string, kind?: ToastKind) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const KIND_COLOR: Record<ToastKind, string> = {
  success: 'var(--teal)',
  error: 'var(--danger)',
  info: 'var(--brand)',
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback((message: string, kind: ToastKind = 'info') => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    const id = Date.now()
    setToast({ id, message, kind })
    timeoutRef.current = setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current))
    }, 3200)
  }, [])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && (
        <div
          role={toast.kind === 'error' ? 'alert' : 'status'}
          aria-live={toast.kind === 'error' ? 'assertive' : 'polite'}
          style={{
            position: 'fixed', bottom: '24px', right: '24px', zIndex: 2000,
            display: 'flex', alignItems: 'center', gap: '10px',
            background: 'var(--header-bg)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '11px', padding: '13px 18px',
            boxShadow: '0 12px 40px rgba(13,27,42,0.4)',
            animation: 'vzToastIn 0.28s cubic-bezier(0.22,1,0.36,1) both',
          }}
        >
          <span
            style={{
              width: '9px', height: '9px', borderRadius: '50%',
              background: KIND_COLOR[toast.kind], flexShrink: 0,
              boxShadow: `0 0 0 3px color-mix(in srgb, ${KIND_COLOR[toast.kind]} 30%, transparent)`,
            }}
          />
          <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', fontWeight: 600, color: 'var(--checkmark-text)' }}>
            {toast.message}
          </span>
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
