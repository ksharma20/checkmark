import { redirect } from 'next/navigation'

/**
 * `/me/ws/[slug]` is now a redirect.
 *
 * This route used to be the whole self-service surface: a seven-panel
 * accordion holding the office/remote/leave roster, the holiday calendar, the
 * member's own leave requests and their correction requests, plus an
 * apply-for-leave modal. Every one of those now has a screen of its own -
 * `/me/workspace` for the roster and `/me/leave` for the rest - so keeping a
 * second implementation would mean two places to fix every leave bug.
 *
 * The slug is preserved as `?ws=`, which is how the new screens choose the
 * workspace they are scoped to (see `me/workspace-scope.tsx`), and the shared
 * scope remembers it in the `cm_ws` cookie - so an old link lands on the right
 * workspace and the rest of `/me` stays on it.
 *
 * The APIs under `/api/me/ws/[slug]/*` are untouched; only this UI moved.
 */

export default async function MeWorkspaceSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  redirect(`/me/workspace?ws=${encodeURIComponent(slug)}`)
}
