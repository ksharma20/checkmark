import {
  getWorkspacesWithReminders,
  getMembersMissingCheckin,
  getMembersStillCheckedIn,
  recordReminderSent,
  type ReminderKind,
  type ReminderMember,
  type WorkspaceReminderConfig,
} from '@/lib/db/queries/reminders'
import { listHolidayDatesInRange } from '@/lib/db/queries/holidays'
import { getLeaveRequestsInRange } from '@/lib/db/queries/leaves'
import { getActiveMaternityUserIds } from '@/lib/db/queries/maternity'
import { createNotification } from '@/lib/db/queries/notifications'
import { mutedUserIdsFor } from '@/lib/db/queries/notification-prefs'
import { parseCategoriesOff } from '@/lib/notifications/categories'
import { sendPushToUser } from '@/lib/push'
import { notificationHref } from '@/lib/client/notification-href'
import { localMidnightToUtc, todayInTz } from '@/lib/timezone'
import { wsReminders } from '@/locales/en/ws-reminders'

/**
 * Scheduled check-in / check-out reminders - the *wall-clock* pass.
 *
 * The reminders that already existed are event-anchored: they start from an
 * open `presence_events` row and count elapsed hours. That design structurally
 * cannot notice somebody who never checked in, because there is no row to
 * iterate. This pass anchors on workspaces instead: for every workspace with a
 * configured reminder time, work out whether now is that time in the
 * workspace's own timezone, then find who still owes a check-in or check-out.
 *
 * Everything here is about NOT nagging. A reminder that fires on someone's
 * approved leave, on a public holiday or on a Sunday is how a user ends up
 * disabling push permanently - which would also cost them the approval
 * notifications that work today. The gates run in this order:
 *
 *   1. workspace archived            → excluded by the query
 *   1b. `reminders` switched off     → skip the whole workspace
 *   2. today not a working day       → skip the whole workspace
 *   3. today is a company holiday    → skip the whole workspace
 *   4. now is not near the set time  → skip this kind
 *   5. member on approved leave      → skip the member
 *   6. already reminded today        → skip the member (reminder_log)
 *   7. member muted `reminders`      → skip the member's PUSH only
 *
 * Gate 7 is the odd one out and deliberately so: it suppresses the push and
 * still writes the `notifications` row, because the member-facing mute is
 * push-only across the whole product (see `notify()`). Gate 1b is the opposite -
 * a workspace switching the category off is saying the category does not apply
 * here at all, so there is nothing to keep a record of. It runs before gates 2
 * and 3 because it needs no query at all: the column arrives with the workspace.
 *
 * This pass does NOT route through `notify()`, even though `notify()` implements
 * exactly gates 3b and 7. It iterates workspaces, not members, so it can read
 * the workspace row and the muted set ONCE per workspace and filter in memory;
 * `notify()` reads both per call, and the only shape that fits here is one call
 * per member - inside a loop that runs for every unchecked-in person in every
 * workspace, every thirty minutes. That is the exact round-trip explosion
 * `mutedUserIdsFor()` was written to avoid. Keeping the pair here also leaves
 * the `reminder_log` claim immediately before the send, which is the ordering
 * that makes an overlapping cron run silent rather than a second push.
 */

/**
 * How late a reminder may still be delivered, in minutes past its configured
 * wall-clock time.
 *
 * The workflow ticks at :00 and :30, so 30 minutes is the theoretical minimum,
 * but GitHub Actions cron is best-effort and routinely runs several minutes
 * late. 90 minutes absorbs a skipped tick plus that lag while still refusing to
 * deliver a 10:00 reminder in the afternoon - at which point it is no longer a
 * reminder, just a nag. `reminder_log` guarantees that even a wide window
 * produces at most one notification per person, per kind, per local day.
 */
export const REMINDER_GRACE_MIN = 90

export interface ReminderPassResult {
  workspaces: number
  sent: number
  skipped: {
    nonWorkingDay: number
    holiday: number
    onLeave: number
    alreadySent: number
    outsideWindow: number
    /** Workspaces that have switched the `reminders` category off entirely. */
    categoryOff: number
    /** Members whose push was suppressed by their own mute. Their in-app row
     *  was still written, so this is not a count of dropped notifications. */
    muted: number
  }
  errors: number
}

/** 'HH:MM' → minutes since local midnight. Returns null for anything else. */
export function parseHhMm(value: string | null | undefined): number | null {
  if (!value) return null
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim())
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

/** 'YYYY-MM-DD' → the next calendar day. Pure calendar maths, timezone-free. */
function nextLocalDate(localDate: string): string {
  const [y, mo, d] = localDate.split('-').map(Number)
  return new Date(Date.UTC(y, mo - 1, d + 1)).toISOString().slice(0, 10)
}

/** 'YYYY-MM-DD' → weekday number, 0 = Sunday, matching `workspaces.working_days`. */
function weekdayOf(localDate: string): number {
  const [y, mo, d] = localDate.split('-').map(Number)
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay()
}

function parseWorkingDays(raw: string | null): number[] {
  try {
    const parsed = JSON.parse(raw ?? '[1,2,3,4,5]')
    if (Array.isArray(parsed) && parsed.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) {
      return parsed
    }
  } catch { /* fall through to the default */ }
  return [1, 2, 3, 4, 5]
}

function emptyResult(): ReminderPassResult {
  return {
    workspaces: 0,
    sent: 0,
    skipped: {
      nonWorkingDay: 0,
      holiday: 0,
      onLeave: 0,
      alreadySent: 0,
      outsideWindow: 0,
      categoryOff: 0,
      muted: 0,
    },
    errors: 0,
  }
}

/**
 * Run the wall-clock pass over every workspace that has a reminder configured.
 * `now` is injectable so the behaviour can be exercised at an arbitrary instant.
 */
export async function runReminderPass(now: Date = new Date()): Promise<ReminderPassResult> {
  const result = emptyResult()

  const workspaces = await getWorkspacesWithReminders()
  result.workspaces = workspaces.length

  for (const ws of workspaces) {
    try {
      await processWorkspaceReminders(ws, now, result)
    } catch (err) {
      // One workspace's bad timezone string or missing member must never abort
      // the run for every other workspace - same containment as the per-event
      // loop in the cron route.
      result.errors++
      console.error(`[cron] failed to process reminders for workspace ${ws.id}:`, err)
    }
  }

  return result
}

async function processWorkspaceReminders(
  ws: WorkspaceReminderConfig,
  now: Date,
  result: ReminderPassResult,
): Promise<void> {
  const tz = ws.display_timezone || 'UTC'
  const localDate = todayInTz(tz)

  const checkinMin = parseHhMm(ws.checkin_reminder_at)
  const checkoutMin = parseHhMm(ws.checkout_reminder_at)
  // Both null means either the feature is off or the stored values are junk.
  // Either way there is nothing to send.
  if (checkinMin === null && checkoutMin === null) return

  // ── Gate 1b: has this workspace switched reminders off for everybody? ─────
  if (parseCategoriesOff(ws.notification_categories_off).has('reminders')) {
    result.skipped.categoryOff++
    return
  }

  // ── Gate 2: is today a working day for this workspace? ────────────────────
  const workingDays = parseWorkingDays(ws.working_days)
  if (!workingDays.includes(weekdayOf(localDate))) {
    result.skipped.nonWorkingDay++
    return
  }

  // ── Gate 3: is today a company holiday? ───────────────────────────────────
  const holidays = await listHolidayDatesInRange(ws.id, localDate, localDate)
  if (holidays.has(localDate)) {
    result.skipped.holiday++
    return
  }

  // The workspace-local day as a UTC window. Derived entirely from
  // localMidnightToUtc so DST and half-hour zones are handled by the one helper
  // that already gets them right - no hand-rolled offset arithmetic here.
  const dayStartUtc = localMidnightToUtc(localDate, tz)
  const dayEndUtc = localMidnightToUtc(nextLocalDate(localDate), tz)

  // Minutes elapsed since local midnight, for the same reason.
  const minutesNow = (now.getTime() - new Date(dayStartUtc).getTime()) / 60_000

  // ── Gate 5 (gathered once per workspace): members absent today ───────────
  // Two independent sources. `leave_requests` covers ordinary leave;
  // `maternity_cases` is a separate table keyed by employee_id, so the leave
  // query cannot see it. Missing the second one means reminding someone to
  // check in every working day of their maternity leave.
  //
  // ── Gate 7 (gathered once per workspace): members who muted the push ─────
  // Read here, alongside the leave sets, for the same reason: this pass walks
  // workspaces, so one query answers the question for every member of it.
  const [leaves, onMaternity, mutedPush] = await Promise.all([
    getLeaveRequestsInRange(ws.id, localDate, localDate),
    getActiveMaternityUserIds(ws.id, localDate),
    mutedUserIdsFor(ws.id, 'reminders'),
  ])
  const onLeave = new Set([...leaves.map((l) => l.user_id), ...onMaternity])

  // ── Gate 4: is now at, or shortly after, the configured time? ─────────────
  const due = (target: number | null): boolean =>
    target !== null && minutesNow >= target && minutesNow - target < REMINDER_GRACE_MIN

  if (checkinMin !== null) {
    if (due(checkinMin)) {
      const members = await getMembersMissingCheckin(ws.id, dayStartUtc, dayEndUtc)
      await notifyMembers(ws, members, 'checkin', localDate, onLeave, mutedPush, result)
    } else {
      result.skipped.outsideWindow++
    }
  }

  if (checkoutMin !== null) {
    if (due(checkoutMin)) {
      const members = await getMembersStillCheckedIn(ws.id, dayStartUtc, dayEndUtc)
      await notifyMembers(ws, members, 'checkout', localDate, onLeave, mutedPush, result)
    } else {
      result.skipped.outsideWindow++
    }
  }
}

async function notifyMembers(
  ws: WorkspaceReminderConfig,
  members: ReminderMember[],
  kind: ReminderKind,
  localDate: string,
  onLeave: Set<string>,
  mutedPush: Set<string>,
  result: ReminderPassResult,
): Promise<void> {
  const configured = kind === 'checkin' ? ws.checkin_reminder_at : ws.checkout_reminder_at
  if (!configured) return

  const title = kind === 'checkin' ? wsReminders.push.checkinTitle : wsReminders.push.checkoutTitle
  const body =
    kind === 'checkin'
      ? wsReminders.push.checkinBody(ws.name, configured)
      : wsReminders.push.checkoutBody(ws.name, configured)
  const tag = kind === 'checkin' ? wsReminders.push.checkinTag : wsReminders.push.checkoutTag
  const notifType = kind === 'checkin' ? ('checkin_reminder' as const) : ('checkout_reminder' as const)
  // The push and the in-app row are the same notification seen twice, so both
  // resolve their destination through the one resolver rather than each
  // deciding for itself.
  const url = notificationHref({ type: notifType, ref_type: 'reminder', ref_id: localDate, workspace_slug: ws.slug }, 'me')

  for (const member of members) {
    try {
      // ── Gate 5: approved leave covering today ────────────────────────────
      if (onLeave.has(member.user_id)) {
        result.skipped.onLeave++
        continue
      }

      // ── Gate 6: already reminded for this local date ─────────────────────
      // The insert IS the check. Claiming the slot before sending means two
      // overlapping cron runs cannot both get past this line, which a
      // read-then-write would allow.
      const claimed = await recordReminderSent(ws.id, member.user_id, kind, localDate)
      if (!claimed) {
        result.skipped.alreadySent++
        continue
      }

      // ── Gate 7: the member muted reminder PUSHES ─────────────────────────
      // The row is written either way. Muting is push-only across the product,
      // so the feed stays a complete record of what the workspace expected of
      // them - the same guarantee `notify()` makes at every other call site.
      const pushMuted = mutedPush.has(member.user_id)
      if (pushMuted) result.skipped.muted++

      const work: Promise<unknown>[] = [
        createNotification({
          userId: member.user_id,
          workspaceId: ws.id,
          type: notifType,
          title,
          body,
          refId: localDate,
          refType: 'reminder',
        }),
      ]
      if (!pushMuted) {
        work.push(
          sendPushToUser(member.user_id, { title, body, tag: `${tag}-${localDate}`, data: { url } }),
        )
      }
      await Promise.allSettled(work)
      result.sent++
    } catch (err) {
      result.errors++
      console.error(`[cron] failed to send ${kind} reminder to ${member.user_id} in ${ws.id}:`, err)
    }
  }
}
