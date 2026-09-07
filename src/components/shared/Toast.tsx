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
          className={`toast kind-${toast.kind}`}
          role={toast.kind === 'error' ? 'alert' : 'status'}
          aria-live={toast.kind === 'error' ? 'assertive' : 'polite'}
        >
          <span className="toast-dot" />
          <span>{toast.message}</span>
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
