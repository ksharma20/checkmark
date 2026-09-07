'use client'

/**
 * The one active-workspace choice for the whole `/me` surface.
 *
 * An account can hold several active memberships, and Leave, Profile,
 * Documents and the roster all read workspace-scoped endpoints
 * (`/api/me/ws/[slug]/...`), so every one of those screens needs to know
 * *which* workspace it is talking about. That used to be a per-screen `?ws=`
 * dropdown living underneath the shell's workspace pill - two selectors, only
 * one of which did anything. Now the pill is the only selector and this module
 * is what it drives.
 *
 * Resolution order, everywhere:
 *
 *   1. `?ws=<slug>` on the URL  - so existing deep links still land right
 *   2. the `cm_ws` cookie      - the remembered choice
 *   3. the first active membership
 *
 * The choice is a cookie rather than `localStorage` because `src/app/me/layout.tsx`
 * is a Server Component: it has to know the active workspace to paint the pill
 * on first render, before any client code runs. It is deliberately not
 * httpOnly - it is a UI preference, not a credential.
 *
 * Nothing here decides what the member may *see*. The layout validates the
 * cookie against the caller's real memberships before seeding `initialSlug`,
 * this provider only ever resolves to a slug in that server-supplied list, and
 * every `/api/me/ws/[slug]/*` route re-resolves the slug through its own
 * membership check regardless - so a hand-edited cookie or `?ws=` still 401s.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Skeleton } from '@/components/ui'
import { en } from '@/locales/en'

export interface MeWorkspaceOption {
  slug: string
  name: string
}

export interface WorkspaceScope {
  workspaces: MeWorkspaceOption[]
  /** The workspace every fetch on the screen should be scoped to. */
  slug: string | null
  select: (slug: string) => void
}

/** One year: this is a preference, and forgetting it is the annoying failure. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

/**
 * Writing the cookie from the browser (rather than through an API route) is
 * deliberate: no identity or authorisation is being decided here, only which of
 * the caller's own workspaces the UI shows first. The server re-validates it on
 * every render before trusting it.
 */
function rememberWorkspace(slug: string): void {
  if (typeof document === 'undefined') return
  const secure = window.location.protocol === 'https:' ? '; secure' : ''
  document.cookie =
    `${en.constants.cookieWorkspace}=${encodeURIComponent(slug)}` +
    `; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax${secure}`
}

const ActiveWorkspaceContext = createContext<WorkspaceScope | null>(null)

interface ProviderProps {
  /** The caller's active memberships, from the server. The only valid slugs. */
  workspaces: MeWorkspaceOption[]
  /** Cookie value already checked against `workspaces`, else the first one. */
  initialSlug: string | null
  children: React.ReactNode
}

export function ActiveWorkspaceProvider({ workspaces, initialSlug, children }: ProviderProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requested = searchParams.get('ws')

  // What the pill picked during this session, remembered alongside the `?ws=`
  // it was picked against. That second half is what keeps the pick from going
  // stale: it applies only while the URL still says what it said at pick time,
  // so the pick wins over the `?ws=` it is *replacing* (no snap-back during the
  // tick before `router.replace` lands) but loses to a genuinely new one
  // arriving from a link - the `/me/ws/[slug]` redirect, a shared URL.
  const [chosen, setChosen] = useState<{ slug: string; against: string | null } | null>(null)

  // Derived, never stored: a slug naming a workspace the user is not in (stale
  // cookie, hand-edited URL) falls back to the first real membership instead of
  // wedging the screen on an empty scope.
  const slug = useMemo(() => {
    if (workspaces.length === 0) return null
    const valid = (candidate: string | null | undefined) =>
      candidate ? workspaces.find((w) => w.slug === candidate)?.slug : undefined
    const live = chosen && chosen.against === requested ? chosen.slug : null
    return valid(live) ?? valid(requested) ?? valid(initialSlug) ?? workspaces[0].slug
  }, [workspaces, chosen, requested, initialSlug])

  // Keeps the cookie in step with however the slug was reached - including a
  // deep link - so the next cold load of any `/me` screen opens on it.
  useEffect(() => {
    if (slug) rememberWorkspace(slug)
  }, [slug])

  const select = useCallback(
    (next: string) => {
      if (!workspaces.some((w) => w.slug === next)) return
      const url = new URL(window.location.href)
      const current = url.searchParams.get('ws')

      rememberWorkspace(next)
      setChosen({ slug: next, against: current })

      // `?ws=` outranks the cookie, so a leftover one would drag the screen
      // back to the old workspace on the next render. Move it instead of
      // dropping it, so the URL stays as shareable as it was.
      if (current !== null) {
        url.searchParams.set('ws', next)
        router.replace(`${url.pathname}${url.search}`, { scroll: false })
      }

      // Server Components on this route (the `/me` home summary) read the
      // cookie, so they have to re-render for the switch to reach them.
      router.refresh()
    },
    [router, workspaces],
  )

  const value = useMemo<WorkspaceScope>(
    () => ({ workspaces, slug, select }),
    [workspaces, slug, select],
  )

  return (
    <ActiveWorkspaceContext.Provider value={value}>{children}</ActiveWorkspaceContext.Provider>
  )
}

/**
 * Read the active workspace. Every `/me` screen is rendered inside the layout's
 * provider, so a missing context is a wiring bug rather than a runtime state to
 * render around.
 */
export function useWorkspaceScope(): WorkspaceScope {
  const ctx = useContext(ActiveWorkspaceContext)
  if (!ctx) throw new Error('useWorkspaceScope must be used inside ActiveWorkspaceProvider')
  return ctx
}

/** Shared placeholder for the page-level Suspense boundaries. */
export function ScopeSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="stack">
      <Skeleton width="45%" height={22} />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={72} radius="var(--radius-lg)" />
      ))}
    </div>
  )
}
