import PageTransition from '@/components/PageTransition'

/**
 * The passthrough frame for every public route.
 *
 * It sets only a floor height and the page ground; each page paints its own
 * background over it (the landing page is dark, the content pages are white).
 * The ground still has to be declared here so a short page - an expired consent
 * link, say - does not leave the browser's own white showing below the fold.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-shell">
      <PageTransition>{children}</PageTransition>
    </div>
  )
}
