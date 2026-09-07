'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import NotificationRow from '@/components/notifications/NotificationRow'
import type { Notification } from '@/lib/db/queries/notifications'
import {
  fetchMeNotifications,
  fetchMeWsNotifications,
  markMeNotificationsRead,
  markMeWsNotificationsRead,
} from '@/lib/api/notifications'
import { notificationHref } from '@/lib/client/notification-href'
import { Button, Card, EmptyState, Skeleton } from '@/components/ui'
import { notificationsUi } from '@/locales/en/notifications'

interface Props {
  /**
   * A workspace slug the *server* validated against this user's memberships,
   * or null for the unified view. Never read `?ws=` here - the client is not
   * allowed to decide what it is scoped to.
   */
  scopedSlug: string | null
  /** Display name of that workspace, for the heading. */
  scopedName: string | null
}

export default function NotificationsClient({ scopedSlug, scopedName }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  // Scoped and unified differ only in which endpoint pair they talk to, so the
  // choice is made once here rather than branching through the render.
  const load = useCallback(
    () => (scopedSlug ? fetchMeWsNotifications(scopedSlug) : fetchMeNotifications()),
    [scopedSlug],
  )
  const markRead = useCallback(
    (ids?: string[]) =>
      scopedSlug ? markMeWsNotificationsRead(scopedSlug, ids) : markMeNotificationsRead(ids),
    [scopedSlug],
  )

  useEffect(() => {
    let mounted = true
    load()
      .then(data => {
        if (!mounted) return
        if (data) { setNotifications(data.notifications); setUnreadCount(data.unread_count) }
        setLoading(false)
      })
      .catch(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [load])

  const markAll = async () => {
    const ok = await markRead()
    if (!ok) return
    setNotifications(prev => prev.map(notification => ({ ...notification, read_at: new Date().toISOString() })))
    setUnreadCount(0)
  }

  const handleRow = async (notification: Notification) => {
    if (!notification.read_at) {
      const ok = await markRead([notification.id])
      if (ok) {
        setNotifications(prev => prev.map(notif => notif.id === notification.id ? { ...notif, read_at: new Date().toISOString() } : notif))
        setUnreadCount(prevCount => Math.max(0, prevCount - 1))
      }
    }
    // Every row used to open `/me/ws/:slug` regardless of what it said, and an
    // account-level notification - which has no workspace - navigated to the
    // literal `/me/ws/null`. The resolver picks the screen the notification is
    // actually about and never emits a slug-shaped path without a slug, so the
    // old guard is now structural rather than a special case here.
    router.push(notificationHref(notification, 'me'))
  }

  return (
    <div className="stack">
      <div className="row-between">
        <h1 className="t-h1" style={{ color: 'var(--navy)', margin: 0 }}>
          {scopedSlug ? scopedName ?? notificationsUi.titleWorkspace : notificationsUi.titleAll}
        </h1>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={markAll} style={{ color: 'var(--brand)' }}>
            {notificationsUi.markAllRead}
          </Button>
        )}
      </div>

      {loading ? (
        <Card padded={false} aria-hidden>
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: '10px',
                padding: '12px 16px',
                borderBottom: i < 3 ? '1px solid var(--border)' : 'none',
              }}
            >
              <Skeleton width={15} height={15} radius={999} />
              <div className="stack-sm" style={{ flex: 1 }}>
                <Skeleton width="65%" height={13} />
                <Skeleton width="90%" height={12} />
              </div>
            </div>
          ))}
        </Card>
      ) : notifications.length === 0 ? (
        <EmptyState title={scopedSlug ? notificationsUi.emptyWorkspace : notificationsUi.empty} />
      ) : (
        // Rows carry their own separators, so the card stays unpadded.
        <Card padded={false} style={{ overflow: 'hidden' }}>
          {notifications.map(notification => (
            <NotificationRow
              key={notification.id}
              notification={notification}
              // Badges only in the unified view: in the scoped view the heading
              // already names the workspace, so a per-row badge is repetition.
              showWorkspace={!scopedSlug}
              onClick={() => handleRow(notification)}
            />
          ))}
        </Card>
      )}
    </div>
  )
}
