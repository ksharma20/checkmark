import { getServerUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import NotificationsClient from './NotificationsClient'

export const metadata = { title: 'Notifications' }

export default async function NotificationsPage() {
  const user = await getServerUser()
  if (!user) redirect('/login')
  return <NotificationsClient />
}
