import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess, forbidden } from '@/lib/ws-access'
import { Action, Resource } from '@/lib/permissions/catalogue'
import { deleteOfficeDayOverrides } from '@/lib/db/queries/office-days'
import { wsAdmin } from '@/locales/en/ws-overview'

interface Props { params: Promise<{ slug: string; date: string }> }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export interface OfficeDayUndoResponse { date: string; removed: number }

/**
 * DELETE /api/ws/[slug]/office-days/[date] — undo one bulk office day.
 *
 * Gated on the same `approvals:write` the declaration is, because it is the
 * same act in reverse: it moves people's attendance between WFO and WFH.
 *
 * The delete is restricted to `admin_overrides.source = 'office_day'` inside
 * `deleteOfficeDayOverrides()`. That restriction is the entire reason the
 * `source` column exists: an approved regularization writes an override row on
 * the very same table, and often on an event on the very same date. Undoing an
 * office day must never quietly revoke somebody's approved correction.
 *
 * Idempotent — undoing an already-undone (or never-declared) date returns 200
 * with `removed: 0` rather than a 404. There is no office-day row to be found
 * or missed; a day IS its overrides, and zero of them is a valid answer.
 */
export async function DELETE(request: NextRequest, { params }: Props) {
  const { slug, date } = await params
  const ctx = await requireWsAccess(request, slug, Resource.Approvals, Action.Write)
  if (!ctx) return forbidden()

  if (!DATE_RE.test(date)) {
    return NextResponse.json(
      { error: wsAdmin.officeDay.errDateFormat, code: 'VALIDATION_ERROR' },
      { status: 422 },
    )
  }

  const removed = await deleteOfficeDayOverrides(
    ctx.workspace.id,
    date,
    ctx.workspace.display_timezone,
  )

  return NextResponse.json({ date, removed } satisfies OfficeDayUndoResponse)
}
