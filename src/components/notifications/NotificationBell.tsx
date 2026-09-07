'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  pollUrl: string
  href?: string
  onBellClick?: () => void
  isOpen?: boolean
}

export default function NotificationBell({ pollUrl, href, onBellClick, isOpen = false }: Props) {
  const [count, setCount] = useState(0)
  const router = useRouter()

  useEffect(() => {
    let mounted = true
    const fetch_ = () =>
      fetch(pollUrl).then(r => r.ok ? r.json() : null).then(d => { if (mounted && d) setCount(d.count ?? 0) }).catch(() => {})
    fetch_()
    const id = setInterval(fetch_, 30_000)
    return () => { mounted = false; clearInterval(id) }
  }, [pollUrl])

  const display = count > 9 ? '9+' : count > 0 ? String(count) : null

  return (
    <button
      type="button"
      onClick={() => href ? router.push(href) : onBellClick?.()}
      aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ''}`}
      className="icon-btn icon-btn-plain pressable"
      style={{
        position: 'relative', borderRadius: '999px',
        border: '1px solid var(--border)',
        background: isOpen ? 'var(--surface-2)' : 'transparent',
        flexShrink: 0,
      }}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
      {display && (
        <span style={{
          position: 'absolute', top: '-5px', right: '-5px',
          minWidth: '17px', height: '17px', background: 'var(--danger)',
          color: '#fff', fontSize: '10px', fontFamily: 'var(--font-body)',
          fontWeight: 700, borderRadius: '9px', display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: '0 3px',
        }}>
          {display}
        </span>
      )}
    </button>
  )
}
