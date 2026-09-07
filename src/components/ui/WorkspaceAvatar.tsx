'use client'

import { swatchColor } from '@/lib/workspace-color'
import { initials } from './Avatar'

/**
 * A workspace's mark, wherever a workspace is named.
 *
 * One component so the uploaded logo and the generated swatch cannot drift
 * apart between the `/me` pill, the switcher sheet, the `/ws` top bar and the
 * picker. Before this each of those hand-rolled its own circle, and the `/ws`
 * one painted a flat `var(--brand)` with no initials at all - so the same
 * workspace looked different depending which surface you were on.
 *
 * The logo wins when there is one; otherwise the deterministic swatch, seeded
 * on the workspace **id** and never the slug (a slug can be changed, and the
 * colour someone recognises their workspace by should not move when it is).
 *
 * Always decorative: every call site prints the workspace name next to it, so
 * announcing it again is noise in a screen reader.
 */

interface Props {
  /** Seeds the fallback colour. The id, never the slug. */
  id: string
  /** Addresses the logo route. */
  slug: string
  name: string
  /** `null` when the workspace has no logo. Doubles as the cache-buster. */
  logoUpdatedAt?: string | null
  size?: 'sm' | 'lg'
}

export default function WorkspaceAvatar({ id, slug, name, logoUpdatedAt, size = 'sm' }: Props) {
  const cls = size === 'lg' ? 'ws-avatar is-lg' : 'ws-avatar'

  // A plain <img>, not next/image: the optimiser fetches the source
  // server-side and cannot carry the viewer's session cookie, so it cannot read
  // this authenticated route. The upload caps the bytes at 512 KB and the CSS
  // box is fixed, so there is nothing left for it to save here anyway.
  if (logoUpdatedAt) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className={cls}
        src={`/api/me/ws/${slug}/logo?v=${encodeURIComponent(logoUpdatedAt)}`}
        alt=""
        aria-hidden
      />
    )
  }

  return (
    // A hash-derived colour cannot be a static class, which is the one thing
    // invariant 15 has no answer for. Everything else about the swatch is in
    // `.ws-avatar`.
    <span className={cls} style={{ background: swatchColor(id) }} aria-hidden>
      {initials(name)}
    </span>
  )
}
