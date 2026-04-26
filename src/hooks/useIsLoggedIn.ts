'use client'

import { en } from '@/locales/en'
import { useEffect, useState } from 'react'

export function useIsLoggedIn(): boolean {
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    setLoggedIn(document.cookie.split(';').some((c) => c.trim().startsWith(en.constants.cookieUI + '=')))
  }, [])

  return loggedIn
}
