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

// ── Workspace-scoped `/me` fetchers ──────────────────────────────────────────
// Same shapes as the unscoped `/me` pair above, but pinned to one workspace, so
// the bell and the `?ws=` view of `/me/notifications` never show another
// workspace's news. The slug is a hint only - the route re-checks membership.

export async function fetchMeWsNotifications(slug: string): Promise<NotificationsResponse | null> {
  const res = await fetch(`/api/me/ws/${encodeURIComponent(slug)}/notifications`)
  if (!res.ok) return null
  return res.json()
}

export async function markMeWsNotificationsRead(slug: string, ids?: string[]): Promise<boolean> {
  const res = await fetch(`/api/me/ws/${encodeURIComponent(slug)}/notifications/read`, {
    method: 'PATCH',
    ...(ids ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) } : {}),
  })
  return res.ok
}

export async function fetchMeWsUnreadCount(slug: string): Promise<number | null> {
  const res = await fetch(`/api/me/ws/${encodeURIComponent(slug)}/notifications/unread-count`)
  if (!res.ok) return null
  const data = await res.json()
  return data.count ?? 0
}
