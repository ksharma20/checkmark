import { NextRequest, NextResponse } from 'next/server'
import { requireWsMember } from '@/lib/ws-admin'
import {
  getMemberReminderPrefs,
  setMemberReminderPrefs,
} from '@/lib/db/queries/reminders'
import { parseHhMm } from '@/lib/reminders'
import { wsReminders } from '@/locales/en/ws-reminders'

/**
 * The member's own check-in / check-out reminder schedule for one workspace.
 *
 * Gated with `requireWsMember`, not `requireWsAccess`: this is the /me surface,
 * where the answer is decided by the session user alone (invariant 14). There is
 * no permission that could widen or narrow it - a member is only ever setting
 * their own times - and the user id comes from the proxy header, never from the
 * body (invariant 1). There is no `userId` parameter anywhere in this file for
 * the same reason: one cannot be accepted if it is never read.
 *
 * **The time IS the switch.** There is no enabled flag in the request or in the
 * table: a time means "remind me then", and `null` means "do not". Two
 * representations of "is this on" drift the moment one write path updates one of
 * them, and nothing can then arbitrate which is true.
 */
interface Props { params: Promise<{ slug: string }> }

export async function GET(request: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsMember(request, slug)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })

  const prefs = await getMemberReminderPrefs(ctx.userId, ctx.workspace.id)

  return NextResponse.json({
    // No row and a row holding two NULLs are different facts - never configured
    // versus deliberately turned off - but they deliver the same nothing, and a
    // settings screen has one way to paint "off". Flattened here rather than in
    // the query layer, which keeps the distinction available to anything that
    // ever needs it.
    checkinAt: prefs?.checkin_at ?? null,
    checkoutAt: prefs?.checkout_at ?? null,
    // The zone the two times above are wall-clock in. Sent rather than inferred
    // client-side: the member's device timezone is frequently NOT the
    // workspace's, and a screen that labelled '09:30' with the browser's zone
    // would be confidently wrong for every remote member.
    timezone: ctx.workspace.display_timezone,
    // A DISPLAY SEED ONLY, from the vestigial `workspaces.checkin_reminder_at` /
    // `checkout_reminder_at`. It is what the organisation used to push at
    // everybody, offered here as a sensible starting value so a member does not
    // face two empty fields with no idea what their colleagues use.
    //
    // It must NEVER become a delivery fallback. The whole point of moving the
    // schedule onto the member is that silence is the default until they ask:
    // treating this as an implicit time would push to every member of every
    // workspace that ever set an admin-side value, which is precisely the nag
    // that gets push permission revoked - and revoking it also costs them the
    // approval notifications that matter. The reminder pass does not select
    // these columns at all, which is the structural half of the same promise.
    workspaceSuggestion: {
      checkinAt: ctx.workspace.checkin_reminder_at ?? null,
      checkoutAt: ctx.workspace.checkout_reminder_at ?? null,
    },
  })
}

/**
 * Normalise one field of the PATCH body.
 *
 * Three inputs, three meanings, and they have to stay distinct:
 *   - `undefined` (key omitted)  → leave the stored value alone
 *   - `null` or `''`             → turn that kind off
 *   - 'HH:MM'                    → set it
 *
 * The empty string is folded into `null` because that is what an emptied
 * `<input type="time">` posts, and a screen should not have to convert it; a
 * stored `''` would parse as "off" in `parseHhMm` anyway, so it would be a
 * second spelling of one state sitting in the column.
 *
 * Returns `'invalid'` rather than throwing so the caller can name the field in
 * the error - the member needs to know WHICH box is wrong.
 */
function normaliseTime(
  value: unknown,
  current: string | null,
): string | null | 'invalid' {
  if (value === undefined) return current
  if (value === null || value === '') return null
  if (typeof value !== 'string') return 'invalid'
  // Validated with the same `parseHhMm` the delivery pass uses, so a value this
  // route accepts is by construction one the cron can act on. A second regex
  // here would be a second definition of a valid time, free to drift.
  return parseHhMm(value) === null ? 'invalid' : value.trim()
}

export async function PATCH(request: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsMember(request, slug)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })

  let body: { checkinAt?: unknown; checkoutAt?: unknown }
  try { body = await request.json() } catch {
    return NextResponse.json(
      { error: wsReminders.api.invalidBody, code: 'INVALID_BODY' },
      { status: 400 },
    )
  }

  // Read the current row first, so an omitted key can mean "leave it alone".
  // A PATCH that silently cleared the field it was not sent would let a screen
  // editing one time turn the other one off.
  const prefs = await getMemberReminderPrefs(ctx.userId, ctx.workspace.id)

  const checkinAt = normaliseTime(body.checkinAt, prefs?.checkin_at ?? null)
  if (checkinAt === 'invalid') {
    return NextResponse.json(
      { error: wsReminders.api.invalidReminderTime('checkinAt'), code: 'VALIDATION_ERROR' },
      { status: 400 },
    )
  }

  const checkoutAt = normaliseTime(body.checkoutAt, prefs?.checkout_at ?? null)
  if (checkoutAt === 'invalid') {
    return NextResponse.json(
      { error: wsReminders.api.invalidReminderTime('checkoutAt'), code: 'VALIDATION_ERROR' },
      { status: 400 },
    )
  }

  // Both fields are validated before either is written. A partial write - one
  // time stored and the other rejected - would leave the member looking at a
  // screen that disagrees with what was saved.
  await setMemberReminderPrefs(ctx.userId, ctx.workspace.id, { checkinAt, checkoutAt })

  // Echo the resolved state rather than the request. The caller sent a delta;
  // this is the whole answer, so a screen can render from the response without
  // re-deriving what an omitted key did.
  return NextResponse.json({ success: true, checkinAt, checkoutAt })
}
