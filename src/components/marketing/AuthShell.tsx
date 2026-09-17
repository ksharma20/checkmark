import Image from 'next/image'
import Link from 'next/link'
import { access } from '@/locales/en/access'

/**
 * The frame around every pre-product screen: `/login`, `/join/[slug]` and
 * `/consent/[token]`.
 *
 * All three are a brand mark over a single 420px card on the marketing ground.
 * They were three separate hand-rolled copies of that - two of them built out
 * of inline style objects - and they had already drifted: only one had the
 * ambient glow, and the mark appeared on `/login` only inside the first step's
 * heading, so it disappeared the moment somebody typed their email.
 *
 * The mark sits ABOVE the card rather than inside it. It is the same object on
 * every screen and every step, in the same place, and lifting it out of the card
 * is what lets the card be nothing but the decision in front of the reader.
 *
 * Everything visual lives in `.auth-*` in globals.css (invariant 15); this file
 * owns only the structure and the link home.
 */
export default function AuthShell({
  children,
  centered = false,
}: {
  children: React.ReactNode
  /** Result cards read better centred; a form does not. */
  centered?: boolean
}) {
  return (
    <main className="auth-shell">
      <Link href="/" className="auth-brand">
        <Image
          src="/logo.png"
          alt={access.logoAlt}
          width={117}
          height={66}
          className="h-[46px] w-auto"
          priority
        />
      </Link>
      <div className={`auth-card is-standalone${centered ? ' is-centered' : ''}`}>
        {children}
      </div>
    </main>
  )
}
