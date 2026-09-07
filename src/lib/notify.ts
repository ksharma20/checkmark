import { createNotification, type NotificationType } from '@/lib/db/queries/notifications'
import { getWorkspaceById } from '@/lib/db/queries/workspaces'
import {
  getMutedCategories,
  mutedUserIdsFor,
} from '@/lib/db/queries/notification-prefs'
import { notificationHref, type NotificationSurface } from '@/lib/client/notification-href'
import { sendPushToUser, type PushPayload } from '@/lib/push'
import { CATEGORY_DEFS, CATEGORY_OF, parseCategoriesOff } from '@/lib/notifications/categories'

/**
 * The one way a notification leaves this system.
 *
 * Before this existed, `createNotification()` and `sendPushToUser()` were called
 * side by side at seven places, each building its own `data.url` - and one of
 * them (the announcement fan-out) had already drifted, hardcoding a URL instead
 * of using the shared resolver. Adding a preference check to seven call sites
 * means seven chances to forget it, and forgetting it is invisible: the
 * notification simply arrives for somebody who asked not to receive it.
 *
 * The order of operations below IS the correctness argument:
 *
 *   1. resolve the category from the type
 *   2. a workspace-disabled category writes NOTHING - no row, no push
 *   3. `createNotification()` runs for every recipient, UNCONDITIONALLY
 *   4. a member's mute suppresses only the push
 *   5. the push carries a URL from the shared resolver, never a literal
 *
 * Step 3 is what makes step 4 safe. The member-facing switch is deliberately
 * push-only: the in-app feed stays a complete record, so muting a category
 * means "stop buzzing my phone", not "hide this from me". A mute that also
 * suppressed the row would make the bell count depend on preferences at read
 * time as well as write time, and would let somebody lose a rejection notice
 * they only meant to stop being paged about.
 *
 * Step 2 is the exception, and is different on purpose: a workspace switching a
 * category off is saying the category does not apply to this organisation at
 * all, so there is nothing to keep a record of.
 *
 * Takes a LIST of recipients rather than one. Fan-outs (an announcement, a new
 * approval landing in every approver's queue) would otherwise re-read the
 * workspace and the mute set once per person; this reads each exactly once.
 */
export async function notify(params: {
  userIds: string[]
  workspaceId: string | null
  /** Needed only to build the deep link; nullable for the same reason `notifications.workspace_id` is. */
  workspaceSlug?: string | null
  type: NotificationType
  title: string
  body: string
  refId?: string
  refType?: string
  /**
   * Which shell the PUSH should open. The same notification has two homes: an
   * approver tapping "New leave request" wants `/ws/:slug/approvals`, while the
   * employee tapping "Leave approved" wants their own leave screen.
   *
   * Defaults to `'me'` because most notifications go to the person the thing
   * happened to. The two approver fan-outs pass `'ws'` — omitting it there sends
   * an admin to their personal leave screen, which is a silent deep-link
   * regression the in-app row would not show (the `/ws` bell resolves its own
   * href client-side and would still be correct).
   */
  surface?: NotificationSurface
  /** Push-only extras. The URL is never one of them - it comes from `notificationHref`. */
  push?: Pick<PushPayload, 'tag' | 'requireInteraction' | 'actions'>
}): Promise<void> {
  if (params.userIds.length === 0) return

  const category = CATEGORY_OF[params.type]
  const def = CATEGORY_DEFS[category]

  // 2. Workspace switchboard. A disabled category produces no record at all.
  if (params.workspaceId) {
    const workspace = await getWorkspaceById(params.workspaceId)
    const off = parseCategoriesOff(workspace?.notification_categories_off)
    if (off.has(category)) return
  }

  // 4. Whose push is muted. An immutable category skips the query entirely -
  //    nobody can hold a mute for it, so reading is pointless work.
  let muted: Set<string> = new Set()
  if (def.memberMutable) {
    if (params.workspaceId) {
      muted = await mutedUserIdsFor(params.workspaceId, category)
    } else {
      // No workspace to key on, so resolve per member. Only reachable for an
      // account-scoped category, which today means this branch is unused by
      // `notify()` - `notifyPresence()` is the account-scoped path.
      const perUser = await Promise.all(
        params.userIds.map(async (id) => [id, await getMutedCategories(id, null)] as const),
      )
      muted = new Set(perUser.filter(([, set]) => set.has(category)).map(([id]) => id))
    }
  }

  const url = notificationHref(
    {
      type: params.type,
      ref_type: params.refType ?? null,
      ref_id: params.refId ?? null,
      workspace_slug: params.workspaceSlug ?? null,
    },
    params.surface ?? 'me',
  )

  // One `allSettled` across every recipient's row and push, matching what the
  // call sites did individually: a push service that is down must not cost
  // anybody their feed row, and one dead subscription must not abort a fan-out.
  await Promise.allSettled(
    params.userIds.flatMap((userId) => {
      const work: Promise<unknown>[] = [
        createNotification({
          userId,
          workspaceId: params.workspaceId,
          type: params.type,
          title: params.title,
          body: params.body,
          refId: params.refId,
          refType: params.refType,
        }),
      ]
      if (!muted.has(userId)) {
        work.push(
          sendPushToUser(userId, {
            title: params.title,
            body: params.body,
            tag: params.push?.tag,
            requireInteraction: params.push?.requireInteraction,
            actions: params.push?.actions,
            data: { url },
          }),
        )
      }
      return work
    }),
  )
}

/**
 * The presence ladder's send path - the 5h / 10h / 12h pushes.
 *
 * Separate from `notify()` for two structural reasons, not for convenience:
 *
 *  - It writes **no `notifications` row**. These three are the only messages in
 *    the product that are push-only, a deliberate choice: a nudge to go home is
 *    worthless an hour later, and putting it in the feed would fill the bell
 *    with things nobody will ever revisit. The accepted cost is that muting
 *    `presence` means total silence, including the auto-checkout confirmation.
 *
 *  - It has **no workspace**. `presence_events` carries no `workspace_id` and
 *    deliberately never will, so the preference has to be account-level. A
 *    member in two workspaces has one check-in session, not two.
 */
export async function notifyPresence(userId: string, payload: PushPayload): Promise<void> {
  const muted = await getMutedCategories(userId, null)
  if (muted.has('presence')) return
  await sendPushToUser(userId, payload)
}
