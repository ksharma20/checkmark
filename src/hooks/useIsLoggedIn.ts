'use client'

import { useSyncExternalStore } from 'react'
import { en } from '@/locales/en'

const COOKIE_PREFIX = en.constants.cookieUI + '='

// `document.cookie` is browser-only, so the server has to answer "logged out"
// and the real value can only be read after hydration. `useSyncExternalStore`
// expresses that as a plain false-on-server / read-on-client snapshot, with no
// setState-in-an-effect cascade. Same pattern as the SSR mount guard in
// `src/components/ui/Modal.tsx`.
//
// Nothing to subscribe to: no browser event fires when a cookie changes, so the
// subscribe callback is a no-op and the snapshot is simply re-read on render.
const subscribeNever = () => () => {}

const getClientSnapshot = () =>
  document.cookie.split(';').some((c) => c.trim().startsWith(COOKIE_PREFIX))

const getServerSnapshot = () => false

export function useIsLoggedIn(): boolean {
  return useSyncExternalStore(subscribeNever, getClientSnapshot, getServerSnapshot)
}
