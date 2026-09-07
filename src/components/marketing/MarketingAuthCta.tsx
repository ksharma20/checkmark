'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { marketing } from '@/locales/en/marketing'

/**
 * The two buttons on the right of the marketing nav.
 *
 * Signed out: Sign in · Get started. Signed in: Sign out · Dashboard.
 *
 * This is the only client component on a marketing page, and it exists so the
 * PAGES CAN STAY STATIC. The session cookie is httpOnly, so the only other way
 * to know who is looking is to read it on the server - which would call
 * `cookies()` and turn all seven statically prerendered marketing pages into
 * per-request renders. One small fetch is the cheaper trade.
 *
 * The accepted cost: a signed-in visitor sees the signed-out pair for one
 * round-trip. `signedIn === null` is that window, and it renders the signed-out
 * buttons rather than nothing - an empty gap that fills in is a worse flicker
 * than two buttons that change, and a visitor who is genuinely signed out (the
 * common case on a landing page) then sees no movement at all.
 */

type Variant = 'light' | 'dark'

const LINK_CLASS: Record<Variant, string> = {
  dark: 'hidden h-11 items-center px-4 text-sm font-medium text-checkmark-text-muted no-underline transition-colors hover:text-checkmark-brand sm:inline-flex',
  light: 'hidden h-11 items-center px-4 text-sm text-text-primary no-underline transition-colors hover:text-brand sm:inline-flex',
}

const CTA_CLASS: Record<Variant, string> = {
  dark: 'inline-flex h-11 items-center rounded-md bg-checkmark-brand px-5 text-sm font-bold text-white no-underline transition-colors hover:bg-brand-hover md:px-6',
  light: 'inline-flex h-11 items-center rounded-md bg-brand px-5 text-sm font-semibold text-white no-underline transition-colors hover:bg-brand-hover',
}

export default function MarketingAuthCta({ variant }: { variant: Variant }) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/session')
      .then((res) => (res.ok ? res.json() : { signedIn: false }))
      .then((data: { signedIn?: boolean }) => {
        if (!cancelled) setSignedIn(!!data.signedIn)
      })
      // A failed probe means we simply do not know, and the signed-out pair is
      // the safe answer: its buttons lead to a login, which recovers either way.
      .catch(() => { if (!cancelled) setSignedIn(false) })
    return () => { cancelled = true }
  }, [])

  async function signOut() {
    setSigningOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      // A hard navigation, not `router.push`: the session cookie has just been
      // cleared, and every cached RSC payload in memory was rendered for the
      // person who is no longer signed in.
      window.location.href = '/'
    }
  }

  if (signedIn) {
    return (
      <div className="flex shrink-0 items-center gap-2.5">
        <button
          type="button"
          onClick={() => void signOut()}
          disabled={signingOut}
          className={`${LINK_CLASS[variant]} cursor-pointer border-0 bg-transparent`}
        >
          {signingOut ? marketing.nav.signingOut : marketing.nav.signOut}
        </button>
        <Link href="/dashboard" className={CTA_CLASS[variant]}>
          {marketing.nav.dashboard}
        </Link>
      </div>
    )
  }

  return (
    <div className="flex shrink-0 items-center gap-2.5">
      <Link href="/login" className={LINK_CLASS[variant]}>
        {marketing.nav.signIn}
      </Link>
      <Link href="/login" className={CTA_CLASS[variant]}>
        {marketing.nav.getStarted}
      </Link>
    </div>
  )
}
