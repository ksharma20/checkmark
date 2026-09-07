import Image from 'next/image';
import Link from 'next/link';
import { marketing } from '@/locales/en/marketing';

const copy = marketing.ctaBand;

export default function CTABandFooter() {
  return (
    <>
      <div className="relative z-10 mx-6 mb-[80px] mt-[80px] overflow-hidden rounded-[24px] border border-[color-mix(in_srgb,var(--checkmark-brand)_30%,transparent)] bg-gradient-to-b from-checkmark-bg-card2 via-checkmark-bg-card to-checkmark-bg-dark px-7 py-12 text-center md:mx-10 md:mb-[100px] md:px-[60px] md:py-[80px]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-[-60%] h-[400px] w-[600px] -translate-x-1/2 rounded-full"
          style={{ background: 'radial-gradient(ellipse, var(--brand-glow) 0%, transparent 70%)' }}
        />

        <div className="reveal relative z-10">
          <h2 className="mb-4 font-dm-sans text-3xl font-black leading-tight tracking-tight md:text-4xl">
            {copy.headingBefore}
            <br />
            <em className="font-syne italic text-checkmark-brand">{copy.headingEmphasis}</em>
          </h2>
          <p className="mb-10 text-base text-checkmark-text-muted md:text-lg">{copy.description}</p>
          <div className="flex flex-wrap items-center justify-center gap-3.5">
            <Link
              href="/login"
              className="rounded-lg bg-checkmark-brand px-9 py-4 text-base font-bold text-white no-underline transition-colors hover:bg-brand-hover"
            >
              {copy.primaryCta}
            </Link>
            <a
              href="mailto:kabir.innovate@gmail.com"
              className="rounded-lg border border-checkmark-border px-7 py-4 text-base font-medium text-checkmark-text no-underline transition-colors hover:border-checkmark-brand hover:text-checkmark-brand"
            >
              {copy.secondaryCta}
            </a>
          </div>
        </div>
      </div>

      <footer className="relative z-10 flex flex-wrap items-center justify-between gap-5 border-t border-checkmark-border px-6 py-10 md:px-[60px]">
        <Link href="/" className="flex items-center no-underline">
          <Image
            src="/logo.png"
            alt={marketing.nav.logoAlt}
            width={117}
            height={66}
            className="h-[66px] w-auto"
          />
        </Link>
        <p className="m-0 text-xs text-checkmark-text-muted">{copy.copyright}</p>
        <ul className="flex list-none gap-6">
          {copy.links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-xs text-checkmark-text-muted no-underline transition-colors hover:text-checkmark-brand"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </footer>
    </>
  );
}
