import Link from 'next/link'
import { marketing } from '@/locales/en/marketing'

/** Shared footer for the light marketing pages. */
export default function MarketingFooter() {
  return (
    <footer
      aria-label={marketing.footer.label}
      className="border-t border-border bg-surface-0 px-6 py-10"
    >
      <div className="mx-auto flex w-full max-w-[1100px] flex-col items-center gap-5">
        <Link href="/" className="no-underline">
          <span className="font-heading text-base font-bold text-brand">{marketing.footer.brand}</span>
        </Link>

        <ul className="flex list-none flex-wrap justify-center gap-x-6 gap-y-2">
          {marketing.footer.links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-[13px] text-text-muted no-underline transition-colors hover:text-brand"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <p className="m-0 text-center text-xs text-text-muted">
          {marketing.footer.tagline(new Date().getFullYear())}
        </p>
      </div>
    </footer>
  )
}
