'use client'

import { useEffect } from 'react'

/**
 * Invisible component - detects the browser's IANA timezone and silently
 * PATCHes /api/me/timezone once per mount. Keeps the server-stored timezone
 * current without any user interaction.
 */
export default function TimezoneReporter() {
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (!tz) return
    fetch('/api/me/timezone', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timezone: tz }),
    }).catch(() => {/* silent - non-critical */})
  }, [])

  return null
}
