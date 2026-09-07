import Image from 'next/image'
import { en } from '@/locales/en'

/**
 * The CheckMark mark.
 *
 * It existed only on the marketing and consent pages until now - neither app
 * shell showed it, so the product a customer signs into carried no brand at all.
 *
 * `next/image` rather than a plain `<img>`, and that is load-bearing:
 * `public/logo.png` is a **6000 x 3375** source of about 866 KB. Shipping it
 * raw into a top bar would be most of a megabyte on every page load. The
 * optimiser resizes and re-encodes it to the rendered size, which is a few KB.
 *
 * Worth fixing properly one day: the source should be an SVG, or a PNG exported
 * at the sizes actually used. Until then the optimiser is doing work on every
 * cold request that an export would have done once.
 */

interface LogoProps {
  /** Rendered height in px. Width follows the 16:9 source. */
  height?: number
  width?: number
  className?: string
  /**
   * Decorative when the logo sits beside the product name that already says
   * "CheckMark" - repeating it makes a screen reader announce the brand twice.
   */
  decorative?: boolean
}

const ASPECT = 6000 / 3375

export default function Logo({ height = 24, className, decorative = false, width = undefined }: LogoProps) {
  width = width ?? Math.round(height * ASPECT)
  return (
    <Image
      src="/logo.png"
      alt={decorative ? '' : en.brand.name}
      aria-hidden={decorative || undefined}
      width={width}
      height={height}
      className={className}
      // The mark is above the fold in both shells, so it should not wait for
      // the lazy-load observer.
      priority
    />
  )
}
