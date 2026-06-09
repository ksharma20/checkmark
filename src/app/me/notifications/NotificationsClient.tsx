'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import NotificationRow from '@/components/notifications/NotificationRow'
import type { Notification } from '@/lib/db/queries/notifications'
import { fetchMeNotifications, markMeNotificationsRead } from '@/lib/api/notifications'

import { en } from '@/locales/en'

export default function NotificationsClient() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetchMeNotifications()
      .then(data => { if (data) { setNotifications(data.notifications); setUnreadCount(data.unread_count) }; setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const markAll = async () => {
    const ok = await markMeNotificationsRead()
    if (!ok) return
    setNotifications(prev => prev.map(notification => ({ ...notification, read_at: new Date().toISOString() })))
    setUnreadCount(0)
  }

  const handleRow = async (notification: Notification) => {
    if (!notification.read_at) {
      const ok = await markMeNotificationsRead([notification.id])
      if (ok) {
        setNotifications(prev => prev.map(notif => notif.id === notification.id ? { ...notif, read_at: new Date().toISOString() } : notif))
        setUnreadCount(prevCount => Math.max(0, prevCount - 1))
      }
    }
    router.push(`/me/ws/${notification.workspace_slug}`)
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', paddingBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 16px 12px', borderBottom: '1px solid var(--border)' }}>
        <h1 style={{ margin: 0, fontFamily: 'Syne, sans-serif', fontSize: '18px', fontWeight: 700, color: 'var(--navy)' }}>{en.notifications.bellAriaLabel}</h1>
        {unreadCount > 0 && (
          <button type="button" onClick={markAll} style={{ background: 'none', border: 'none', color: 'var(--brand)', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', padding: 0, fontWeight: 500 }}>
            {en.notifications.markAllRead}
          </button>
        )}
      </div>
      {loading ? (
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[1, 2, 3, 4].map(i => <div key={i} style={{ height: '68px', background: 'var(--surface-2)', borderRadius: '8px' }} />)}
        </div>
      ) : notifications.length === 0 ? (
        <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'DM Sans, sans-serif', fontSize: '14px' }}>
          {en.notifications.empty}
        </div>
      ) : (
        <div>{notifications.map(notification => <NotificationRow key={notification.id} notification={notification} onClick={() => handleRow(notification)} />)}</div>
      )}
    </div>
  )
}
