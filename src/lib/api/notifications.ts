import type { Notification } from '@/lib/db/queries/notifications'

export interface NotificationsResponse {
  notifications: Notification[]
  unread_count: number
}

export async function fetchMeNotifications(): Promise<NotificationsResponse | null> {
  const res = await fetch('/api/me/notifications')
  if (!res.ok) return null
  return res.json()
}

export async function markMeNotificationsRead(ids?: string[]): Promise<boolean> {
  const res = await fetch('/api/me/notifications/read', {
    method: 'PATCH',
    ...(ids ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) } : {}),
  })
  return res.ok
}

export async function fetchWsNotifications(slug: string): Promise<NotificationsResponse | null> {
  const res = await fetch(`/api/ws/${slug}/notifications`)
  if (!res.ok) return null
  return res.json()
}

export async function markWsNotificationsRead(slug: string, ids?: string[]): Promise<boolean> {
  const res = await fetch(`/api/ws/${slug}/notifications/read`, {
    method: 'PATCH',
    ...(ids ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) } : {}),
  })
  return res.ok
}
