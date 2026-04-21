import webpush from 'web-push'
import { getPushSubscriptionsForUser, deletePushSubscription } from '@/lib/db/queries/push'

function getVapidConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const email = process.env.VAPID_EMAIL ?? 'mailto:kabir.innovate@gmail.com'
  if (!publicKey || !privateKey) throw new Error('VAPID keys not configured')
  return { publicKey, privateKey, email }
}

export interface PushPayload {
  title: string
  body: string
  tag?: string
  requireInteraction?: boolean
  actions?: { action: string; title: string }[]
  data?: Record<string, unknown>
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  const { publicKey, privateKey, email } = getVapidConfig()
  webpush.setVapidDetails(email, publicKey, privateKey)

  const subs = await getPushSubscriptionsForUser(userId)
  const payloadStr = JSON.stringify(payload)

  await Promise.allSettled(
    subs.map((sub) =>
      webpush
        .sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payloadStr
        )
        .catch(async (err: { statusCode?: number }) => {
          if (err.statusCode === 410) {
            await deletePushSubscription(userId, sub.endpoint)
          }
        })
    )
  )
}
