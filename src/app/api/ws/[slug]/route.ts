import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess } from '@/lib/ws-access'
import { updateWorkspace } from '@/lib/db/queries/workspaces'
import { can } from '@/lib/permissions/can'
import { Action, Resource } from '@/lib/permissions/catalogue'

interface Props { params: Promise<{ slug: string }> }

export async function GET(request: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAccess(request, slug, Resource.Settings, Action.Read)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

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

  if (Object.keys(updates).length > 0) {
    await updateWorkspace(ctx.workspace.id, updates)
  }

  return NextResponse.json({ success: true })
}
