import { db } from '../index'

export interface PushSubscription {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  created_at: string
}

export async function upsertPushSubscription(params: {
  userId: string
  endpoint: string
  p256dh: string
  auth: string
}): Promise<void> {
  await db.execute(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET
       user_id = excluded.user_id,
       p256dh  = excluded.p256dh,
       auth    = excluded.auth`,
    [params.userId, params.endpoint, params.p256dh, params.auth]
  )
}

export async function deletePushSubscription(userId: string, endpoint: string): Promise<void> {
  await db.execute(
    'DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?',
    [userId, endpoint]
  )
}

export async function getPushSubscriptionsForUser(userId: string): Promise<PushSubscription[]> {
  return db.query<PushSubscription>(
    'SELECT * FROM push_subscriptions WHERE user_id = ?',
    [userId]
  )
}
