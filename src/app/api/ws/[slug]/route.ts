import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess } from '@/lib/ws-access'
import { updateWorkspace } from '@/lib/db/queries/workspaces'
import { can } from '@/lib/permissions/can'
import { Action, Resource } from '@/lib/permissions/catalogue'
import { getWorkspaceLogoMeta } from '@/lib/db/queries/workspace-logo'
import {
  isNotificationCategory,
  parseCategoriesOff,
  serialiseCategoriesOff,
} from '@/lib/notifications/categories'
import { wsReminders } from '@/locales/en/ws-reminders'
import { wsAdmin } from '@/locales/en/ws-settings'

/**
 * Strict 24-hour 'HH:MM'. The value is wall-clock in the workspace's own
 * timezone and is compared against the clock by the reminder cron, so anything
 * looser ('9:00', '25:00', '09:00:00') would silently never fire - a 400 is
 * kinder than a reminder that quietly does nothing.
 */
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/

/**
 * Sentinel for "the caller sent something unusable". A symbol rather than null
 * or undefined because both of those are legitimate answers here: undefined
 * means "key absent, leave the column as it is" and null means "clear it".
 */
const INVALID = Symbol('invalid-field')

/**
 * Normalise one reminder field. Returns `undefined` when the key is absent,
 * `null` for "turn it off" (empty string counts, because that is what an
 * emptied <input type="time"> sends), or the validated 'HH:MM' string.
 */
function readReminderTime(value: unknown): string | null | undefined | typeof INVALID {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') return INVALID
  const trimmed = value.trim()
  if (trimmed === '') return null
  return HHMM.test(trimmed) ? trimmed : INVALID
}

/**
 * Normalise the disabled-category list into the column's JSON string. Same
 * absent/present idiom as `readReminderTime`: `undefined` means the key was not
 * sent and the stored list must be left alone.
 *
 * `null` is deliberately INVALID rather than "clear it". The switchboard always
 * sends the whole array (an empty one means "everything on"), so a null here is
 * a client bug, and guessing at it would be a silent mass re-enable.
 *
 * `serialiseCategoriesOff` drops anything not `workspaceSwitchable`, so even a
 * caller past the validation below cannot store "announcements are off".
 */
function readCategoriesOff(value: unknown): string | undefined | typeof INVALID {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) return INVALID
  if (!value.every(isNotificationCategory)) return INVALID
  return serialiseCategoriesOff(value)
}

interface Props { params: Promise<{ slug: string }> }

export async function GET(request: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAccess(request, slug, Resource.Settings, Action.Read)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const logo = await getWorkspaceLogoMeta(ctx.workspace.id)

  const rawDays = ctx.workspace.working_days ?? '[1,2,3,4,5]'
  let working_days: number[]
  try { working_days = JSON.parse(rawDays) } catch { working_days = [1, 2, 3, 4, 5] }

  return NextResponse.json({
    name: ctx.workspace.name,
    display_timezone: ctx.workspace.display_timezone,
    archived_at: ctx.workspace.archived_at,
    allow_remote: !!ctx.workspace.allow_remote,
    leaves_enabled: !!ctx.workspace.leaves_enabled,
    working_days,
    leave_cutover_date: ctx.workspace.leave_cutover_date,
    checkin_reminder_at: ctx.workspace.checkin_reminder_at,
    checkout_reminder_at: ctx.workspace.checkout_reminder_at,
    // Parsed rather than passed through raw: the column is JSON TEXT and a
    // malformed one must reach the switchboard as "nothing off", not as a
    // string the client then has to guess at.
    notification_categories_off: [...parseCategoriesOff(ctx.workspace.notification_categories_off)],
    // Only the timestamp, never the bytes. It answers "is there a logo" and
    // doubles as the cache-buster on the image URL, so a replaced logo changes
    // its src and a stale copy can never be served. The bytes have their own
    // route (invariant 23 - no base64 in a JSON body).
    logo_updated_at: logo?.updated_at ?? null,
    // Archive / restore are ownership-level, so only the owner should see the
    // control. The routes enforce this independently - this flag only stops us
    // showing a button we would immediately 403 on.
    can_manage_ownership: can(ctx.role.permissions, Resource.Ownership, Action.Write),
  })
}

export async function PATCH(request: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAccess(request, slug, Resource.Settings, Action.Write)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  let body: {
    name?: string
    displayTimezone?: string
    allowRemote?: boolean
    leavesEnabled?: boolean
    workingDays?: number[]
    leaveCutoverDate?: string | null
    checkinReminderAt?: string | null
    checkoutReminderAt?: string | null
    notificationCategoriesOff?: unknown
  }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const updates: {
    name?: string
    display_timezone?: string
    allow_remote?: number
    leaves_enabled?: number
    working_days?: string
    leave_cutover_date?: string | null
    checkin_reminder_at?: string | null
    checkout_reminder_at?: string | null
    notification_categories_off?: string
  } = {}
  if (body.name?.trim()) updates.name = body.name.trim()
  if (body.displayTimezone?.trim()) updates.display_timezone = body.displayTimezone.trim()
  if (body.allowRemote !== undefined) updates.allow_remote = body.allowRemote ? 1 : 0
  if (body.leavesEnabled !== undefined) updates.leaves_enabled = body.leavesEnabled ? 1 : 0
  if (body.workingDays !== undefined) {
    if (
      !Array.isArray(body.workingDays) ||
      body.workingDays.length === 0 ||
      body.workingDays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)
    ) {
      return NextResponse.json(
        { error: 'workingDays must be a non-empty array of integers 0–6', code: 'VALIDATION_ERROR' },
        { status: 400 },
      )
    }
    updates.working_days = JSON.stringify(body.workingDays)
  }
  if ('leaveCutoverDate' in body) {
    const d = body.leaveCutoverDate
    if (d !== null && d !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      return NextResponse.json(
        { error: 'leaveCutoverDate must be YYYY-MM-DD or null', code: 'VALIDATION_ERROR' },
        { status: 400 },
      )
    }
    updates.leave_cutover_date = d ?? null
  }

  // Reminder times. Absent key = leave as-is; null or '' = turn the reminder
  // off; 'HH:MM' = set it. Anything else is a 400 rather than a silent no-op.
  const checkinReminder = readReminderTime(body.checkinReminderAt)
  if (checkinReminder === INVALID) {
    return NextResponse.json(
      { error: wsReminders.api.invalidReminderTime('checkinReminderAt'), code: 'VALIDATION_ERROR' },
      { status: 400 },
    )
  }
  if (checkinReminder !== undefined) updates.checkin_reminder_at = checkinReminder

  const checkoutReminder = readReminderTime(body.checkoutReminderAt)
  if (checkoutReminder === INVALID) {
    return NextResponse.json(
      { error: wsReminders.api.invalidReminderTime('checkoutReminderAt'), code: 'VALIDATION_ERROR' },
      { status: 400 },
    )
  }
  if (checkoutReminder !== undefined) updates.checkout_reminder_at = checkoutReminder

  // The notification switchboard. Absent key = leave the stored list alone.
  const categoriesOff = readCategoriesOff(body.notificationCategoriesOff)
  if (categoriesOff === INVALID) {
    return NextResponse.json(
      { error: wsAdmin.settings.notifInvalidCategories, code: 'VALIDATION_ERROR' },
      { status: 400 },
    )
  }
  if (categoriesOff !== undefined) updates.notification_categories_off = categoriesOff

  if (Object.keys(updates).length > 0) {
    await updateWorkspace(ctx.workspace.id, updates)
  }

  return NextResponse.json({ success: true })
}
