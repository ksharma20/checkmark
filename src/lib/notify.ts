import { createNotification, type NotificationType } from '@/lib/db/queries/notifications'
import { getWorkspaceById } from '@/lib/db/queries/workspaces'
import {
  getCategoryChoices,
  getMutedCategories,
  isPushMuted,
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
 * Step 4 currently resolves to nothing: no category in the catalogue is
 * `memberMutable`, so no member holds a preference and every recipient gets the
 * push. The step is kept in place, flag-driven, rather than removed - the long
 * comment at the branch itself argues why, and the rule it encodes is the one
 * thing here that is expensive to get wrong twice.
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

  // 4. Whose push is suppressed. An immutable category skips the query entirely
  //    - nobody can hold a preference for it, so reading is pointless work and
  //    its catalogue default is never consulted.
  //
  //    "Muted" is resolved, not read: a member with no row picks up the
  //    category's `defaultOn`, so the set is built by resolving each RECIPIENT
  //    rather than by listing the table's rows - a member-mutable, opt-in
  //    category's audience is precisely the people this table has no rows for.
  //    Step 3 below is unaffected either way: every recipient still gets their
  //    feed row, whatever this resolves to.
  //
  //    **This whole block is DEAD CODE today.** `def.memberMutable` is `false`
  //    for every category in the catalogue - `reminders` and `presence` left it
  //    when they became schedules rather than categories (see
  //    `lib/notifications/categories.ts`) - so `muted` is always empty and every
  //    recipient gets the push.
  //
  //    It is kept rather than deleted because it reads
  //    `CATEGORY_DEFS[category].memberMutable` rather than testing a hardcoded
  //    list of keys: a future member-mutable category revives this path by
  //    setting one flag in the catalogue, with no edit here and no chance of
  //    this file being the one place somebody forgot to update. Deleting it
  //    would mean re-deriving the resolved-default logic from scratch at the
  //    moment it is needed - rediscovering that absence is not the same as
  //    "unmuted", and that the workspace and account scopes need different
  //    reads - which is the worst possible time to get it wrong, because the
  //    failure mode is silent: a push simply arrives for somebody who asked not
  //    to receive it.
  let muted: Set<string> = new Set()
  if (def.memberMutable) {
    if (params.workspaceId) {
      const choices = await getCategoryChoices(params.workspaceId, category)
      muted = new Set(params.userIds.filter((id) => isPushMuted(choices, id)))
    } else {
      // No workspace to key on, so resolve per member. Only reachable for a
      // `scope: 'account'` category, of which there are none - doubly dead, and
      // kept for the same reason as its sibling above.
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

/*
 * `notifyPresence()` used to live here - the send path for the 5h / 10h /
 * auto-checkout ladder. It is gone, and what it did has moved rather than
 * disappeared.
 *
 * The ladder now resolves its own schedule in
 * `src/app/api/push/cron/route.ts`, against `member_presence_prefs`: the member
 * sets the hours, and **having them set IS the opt-in**. There is no longer a
 * `presence` category, so there is nothing for this file to look up - the
 * account-level mute and the "every workspace must agree" vote that
 * `notifyPresence()` encoded describe a model the product no longer has. A
 * member's own nudges about their own session are a schedule, not a class of
 * broadcast (see `lib/notifications/categories.ts`).
 *
 * Two things about it are unchanged and must stay that way. It is **push-only**:
 * the ladder writes no `notifications` row, because a nudge to go home is
 * worthless an hour later and putting it in the feed fills the bell with things
 * nobody will revisit. And it is therefore a **sanctioned exception to
 * invariant 24** - it calls `sendPushToUser()` without going through `notify()`,
 * which is legitimate precisely because there is no feed row and no category to
 * check, not because the seam is optional. The MECHANIC never depended on any of
 * this: `autoCheckoutEvent()` runs before the push and unconditionally, so
 * sessions close on time whether or not anybody is told.
 */
