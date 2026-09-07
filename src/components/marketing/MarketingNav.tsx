import Image from 'next/image'
import Link from 'next/link'
import { marketing } from '@/locales/en/marketing'
import MarketingAuthCta from './MarketingAuthCta'

type NavLink = { readonly label: string; readonly href: string }

export interface MarketingNavProps {
  /**
   * `light` is the token-palette bar used by every content page.
   * `dark` is the landing page's overlay bar - it sits on top of the hero's
   * dark ground, so it is fixed rather than sticky and the hero reserves the
   * space for it with its own top padding.
   */
  variant?: 'light' | 'dark'
  /** Defaults to the cross-page site links; the landing page passes anchors. */
  links?: readonly NavLink[]
}

/**
 * The one marketing nav.
 *
 * This used to be two components - `components/Navigation.tsx` (dark, Tailwind,
 * landing-page anchors) and this one (light, inline styles, site routes). They
 * drifted: only one of them was on the token palette, and only one of them had
 * a "Sign in" link at all. They are now a single component with a `variant`,
 * so a palette or link change lands on all seven public routes at once.
 */
export default function MarketingNav({
  variant = 'light',
  links = marketing.nav.links,
}: MarketingNavProps) {
  const dark = variant === 'dark'

  return (
    <nav
      aria-label={marketing.nav.label}
      className={
        dark
          ? 'fixed inset-x-0 top-0 z-[100] border-b border-checkmark-border bg-[color-mix(in_srgb,var(--bg-dark)_72%,transparent)] backdrop-blur-[16px]'
          : 'sticky top-0 z-50 border-b border-border bg-[color-mix(in_srgb,var(--surface-0)_92%,transparent)] backdrop-blur-[12px]'
      }
    >
      <div
        className={
          dark
            ? 'mx-auto flex h-[76px] w-full max-w-[1400px] items-center justify-between gap-6 px-6 md:px-[60px]'
            : 'mx-auto flex h-[60px] w-full max-w-[1100px] items-center justify-between gap-6 px-6'
        }
      >
        <Link href="/" className="flex shrink-0 items-center no-underline">
          {dark ? (
            <Image
              src="/logo.png"
              alt={marketing.nav.logoAlt}
              width={121}
              height={68}
              className="h-[52px] w-auto md:h-[64px]"
              priority
            />
          ) : (
            <span className="font-heading text-[18px] font-bold tracking-[-0.3px] text-brand">
              checkmark
            </span>
          )}
        </Link>

        <ul
          className={`hidden list-none items-center md:flex ${dark ? 'gap-9' : 'gap-1'}`}
        >
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={
                  dark
                    ? 'text-sm font-medium text-checkmark-text-muted no-underline transition-colors hover:text-checkmark-brand'
                    : 'rounded-sm px-3.5 py-1.5 text-sm text-text-secondary no-underline transition-colors hover:text-brand'
                }
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* The one client component on a marketing page. It decides which two
            buttons to draw by asking the server whether there is a session -
            which is what lets these pages stay statically prerendered. Reading
            the cookie here instead would make all seven render per request. */}
        <MarketingAuthCta variant={variant} />
      </div>
    </nav>
  )
}
