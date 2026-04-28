'use client'

import { useEffect } from 'react'
import { subscribeToPush } from '@/lib/push-client'

export default function SwRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker
      .register('/sw.js')
      .then(() => subscribeToPush())
      .catch(() => { /* silent */ })
  }, [])

  return null
}
