import { cookies } from 'next/headers'
import { en } from '@/locales/en'

/**
 * Server-side half of the `/me` active-workspace choice.
 *
 * The pill writes `cm_ws` in the browser (see `workspace-scope.tsx`); this is
 * what reads it back. It is never trusted on its own: the caller passes the
 * slugs of the memberships it has already loaded for this user, and anything
 * outside that list - stale after a member was removed, or simply forged -
 * falls back to the first real membership rather than naming someone else's
 * workspace. The workspace-scoped APIs enforce membership independently too;
 * this only stops the UI from *asking* for a workspace that is not the user's.
 */
export async function resolveActiveWorkspaceSlug(
  memberSlugs: readonly string[],
): Promise<string | null> {
  if (memberSlugs.length === 0) return null
  const remembered = (await cookies()).get(en.constants.cookieWorkspace)?.value
  if (remembered && memberSlugs.includes(remembered)) return remembered
  return memberSlugs[0]
}
