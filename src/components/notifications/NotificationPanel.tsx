'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import NotificationRow from './NotificationRow'
import type { Notification } from '@/lib/db/queries/notifications'
import { fetchWsNotifications, markWsNotificationsRead } from '@/lib/api/notifications'
import { en } from '@/locales/en'

export default function NotificationPanel({ slug, onClose }: { slug: string; onClose: () => void }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    fetchWsNotifications(slug)
      .then(d => { if (d) { setNotifications(d.notifications); setUnreadCount(d.unread_count) }; setLoading(false) })
      .catch(() => setLoading(false))
  }, [slug])

  useEffect(() => {
    const handle = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [onClose])

  const markAll = async () => {
    const ok = await markWsNotificationsRead(slug)
    if (!ok) return
    setNotifications(p => p.map(n => ({ ...n, read_at: new Date().toISOString() })))
    setUnreadCount(0)
  }

  const handleRow = async (n: Notification) => {
    if (!n.read_at) {
      const ok = await markWsNotificationsRead(slug, [n.id])
      if (ok) {
        setNotifications(p => p.map(x => x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x))
        setUnreadCount(c => Math.max(0, c - 1))
      }
    }
    onClose()
    router.push(`/ws/${slug}/leaves`)
  }

  return (
    <div ref={ref} style={{
      width: '320px', maxHeight: '440px', background: 'var(--surface-0)',
      border: '1px solid var(--border)', borderRadius: '10px',
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
    }}>
      {/* Sticky header — does not scroll with the list */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ fontFamily: 'Syne, sans-serif', fontSize: '14px', fontWeight: 600, color: 'var(--navy)' }}>{en.notifications.bellAriaLabel}</span>
        {unreadCount > 0 && (
          <button type="button" onClick={markAll} style={{ background: 'none', border: 'none', color: 'var(--brand)', fontSize: '12px', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', padding: 0 }}>
            {en.notifications.markAllRead}
          </button>
        )}
      </div>

      {/* Scrollable notification list */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {loading ? (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[1, 2, 3].map(i => <div key={i} style={{ height: '64px', background: 'var(--surface-2)', borderRadius: '6px' }} />)}
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'DM Sans, sans-serif', fontSize: '13px' }}>
            {en.notifications.empty}
          </div>
        ) : notifications.map(n => <NotificationRow key={n.id} notification={n} onClick={() => handleRow(n)} />)}
      </div>
    </div>
  )
}
