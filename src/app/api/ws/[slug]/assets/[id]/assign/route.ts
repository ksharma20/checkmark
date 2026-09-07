import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess, forbidden } from '@/lib/ws-access'
import { Action, Resource } from '@/lib/permissions/catalogue'
import { getAsset, assignAsset, unassignAsset } from '@/lib/db/queries/assets'
import { ensureEmployeeForMember, findEmployeeByUserId } from '@/lib/db/queries/employees'
import { assets as assetsCopy, hrRecord } from '@/locales/en/documents'

interface Props { params: Promise<{ slug: string; id: string }> }

function notFound() {
  return NextResponse.json({ error: 'Asset not found', code: 'NOT_FOUND' }, { status: 404 })
}

// ─── POST /api/ws/[slug]/assets/[id]/assign ───────────────────────────────────
// Body: { user_id }  - a workspace MEMBER, not an employee record.

export async function POST(req: NextRequest, { params }: Props) {
  const { slug, id } = await params
  const ctx = await requireWsAccess(req, slug, Resource.Assets, Action.Write)
  if (!ctx) return forbidden()

  const asset = await getAsset(id, ctx.workspace.id)
  if (!asset) return notFound()

  let body: { user_id?: unknown }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 })
  }

  // A member, because most members have no HR record: `employees` is written
  // only when an admin fills in the directory form, so an employee-id body
  // could name barely anyone. The record is found or created below.
  const userId = typeof body.user_id === 'string' ? body.user_id.trim() : ''
  if (!userId) {
    return NextResponse.json(
      { error: hrRecord.errors.memberRequired, code: 'VALIDATION_ERROR' },
      { status: 422 },
    )
  }

  if (asset.status === 'retired') {
    return NextResponse.json(
      { error: assetsCopy.errors.retired, code: 'ASSET_RETIRED' },
      { status: 409 },
    )
  }

  // RETURN_FIRST: an asset with a holder can only be handed on via DELETE
  // /assign. Re-assigning it to the person already holding it stays a no-op,
  // which is why this compares records rather than rejecting outright - and it
  // reads with findEmployeeByUserId rather than ensure, so a request that is
  // about to 409 never creates an HR record as a side effect.
  if (asset.assigned_employee_id) {
    const holder = await findEmployeeByUserId(ctx.workspace.id, userId)
    if (!holder || holder.id !== asset.assigned_employee_id) {
      return NextResponse.json(
        { error: assetsCopy.errors.alreadyAssigned, code: 'ALREADY_ASSIGNED' },
        { status: 409 },
      )
    }
  }

  // Resolved against THIS workspace - the id came from the client, and an
  // active membership here is the only thing that authorises a record.
  const resolved = await ensureEmployeeForMember(ctx.workspace.id, userId)
  if (!resolved.ok) {
    return resolved.reason === 'NOT_A_MEMBER'
      ? NextResponse.json({ error: hrRecord.errors.notAMember, code: 'MEMBER_NOT_FOUND' }, { status: 404 })
      : NextResponse.json({ error: hrRecord.errors.workEmailTaken, code: 'WORK_EMAIL_TAKEN' }, { status: 409 })
  }

  const updated = await assignAsset(id, ctx.workspace.id, resolved.employee.id)
  return NextResponse.json({ asset: updated })
}

// ─── DELETE /api/ws/[slug]/assets/[id]/assign ─────────────────────────────────
// Return the asset to the pool.

export async function DELETE(req: NextRequest, { params }: Props) {
  const { slug, id } = await params
  const ctx = await requireWsAccess(req, slug, Resource.Assets, Action.Write)
  if (!ctx) return forbidden()

  const asset = await getAsset(id, ctx.workspace.id)
  if (!asset) return notFound()

  if (!asset.assigned_employee_id) {
    return NextResponse.json(
      { error: 'Asset is not currently assigned', code: 'NOT_ASSIGNED' },
      { status: 409 },
    )
  }

  const updated = await unassignAsset(id, ctx.workspace.id)
  return NextResponse.json({ asset: updated })
}
