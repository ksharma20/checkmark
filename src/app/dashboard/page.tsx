import { redirect } from 'next/navigation'
import { getSessionFromCookies } from '@/lib/auth'
import { getAdminWorkspacesForUser } from '@/lib/db/queries/workspaces'
import { getRedirectAfterLogin } from '@/lib/permissions/ranks'

/**
 * "Take me to my dashboard" — resolved on the server, because only the server
 * can answer it.
 *
 * Which surface a person belongs on depends on whether they hold org access
 * anywhere, and that is a permission lookup. Putting that decision in the
 * marketing nav would mean shipping a second API call and the permission model
 * to a public page; putting it here means the nav links to one fixed URL and
 * this route does the thinking.
 *
 * Not a marketing page, so being dynamic costs nothing - it renders no HTML at
 * all, it only redirects.
 */
export default async function DashboardPage() {
  const session = await getSessionFromCookies()
  // Signed out: send them to sign in rather than 404. Someone reaching this URL
  // asked for their dashboard, and the honest next step is a login.
  if (!session) redirect('/login')

  // Any workspace where they hold org access. Empty means they are a plain
  // member everywhere, and `/me` is their whole product.
  //
  // Resolved by the SAME helper login, register, reset-password and reactivate
  // use, so "my dashboard" is the place signing in would have taken them. This
  // used to send everyone with org access to the `/ws` picker, which for the
  // common case - exactly one workspace - was a list of one to click through.
  const orgWorkspaces = await getAdminWorkspacesForUser(session.sub)
  redirect(getRedirectAfterLogin(orgWorkspaces))
}
