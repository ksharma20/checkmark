import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess, forbidden } from '@/lib/ws-access'
import { Action, Resource } from '@/lib/permissions/catalogue'
import { getAsset, updateAsset, deleteAsset } from '@/lib/db/queries/assets'
import { assets as assetsCopy } from '@/locales/en/documents'
import { parseAssetBody } from '../_validate'

interface Props { params: Promise<{ slug: string; id: string }> }

function notFound() {
  return NextResponse.json({ error: 'Asset not found', code: 'NOT_FOUND' }, { status: 404 })
}

// ─── PATCH /api/ws/[slug]/assets/[id] ─────────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: Props) {
  const { slug, id } = await params
  const ctx = await requireWsAccess(req, slug, Resource.Assets, Action.Write)
  if (!ctx) return forbidden()

  // The existence check is scoped by workspace, so an id from another
  // workspace is indistinguishable from one that does not exist.
  const existing = await getAsset(id, ctx.workspace.id)
  if (!existing) return notFound()

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const { errors, parsed } = parseAssetBody(body, { partial: true })
  if (Object.keys(errors).length > 0) {
    return NextResponse.json(
      { error: 'Validation failed', code: 'VALIDATION_ERROR', fields: errors },
      { status: 422 },
    )
  }

  if (Object.keys(parsed).length === 0) {
    return NextResponse.json(
      { error: 'At least one field is required', code: 'VALIDATION_ERROR' },
      { status: 422 },
    )
  }

  // Assignment is its own endpoint - letting a plain PATCH set status to
  // 'assigned' would produce an asset marked assigned with no holder.
  if (parsed.status === 'assigned' && !existing.assigned_employee_id) {
    return NextResponse.json(
      {
        error: 'Assign the asset to an employee instead of setting this status directly',
        code: 'ASSIGN_VIA_ENDPOINT',
      },
      { status: 409 },
    )
  }

  // ...and the mirror of it: LEAVING 'assigned' is DELETE /assign's job too.
  // A plain PATCH moves `status` and nothing else, so allowing it here would
  // strand `assigned_employee_id` / `assigned_at` on a row the register calls
  // available, repair or retired - the exact lie unassignAsset() exists to
  // prevent, and a dead end: the table offers Return only on 'assigned' and
  // assigning it to anyone else 409s ALREADY_ASSIGNED.
  //
  // Keyed on the holder rather than on `existing.status`, so a row that is
  // ALREADY in that broken state cannot be patched further sideways - DELETE
  // /assign checks the holder too, so returning it is still the way out.
  if (parsed.status !== undefined && parsed.status !== 'assigned' && existing.assigned_employee_id) {
    return NextResponse.json(
      { error: assetsCopy.errors.returnFirst, code: 'RETURN_FIRST' },
      { status: 409 },
    )
  }

  const asset = await updateAsset(id, ctx.workspace.id, parsed)
  return NextResponse.json({ asset })
}

// ─── DELETE /api/ws/[slug]/assets/[id] ────────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: Props) {
  const { slug, id } = await params
  const ctx = await requireWsAccess(req, slug, Resource.Assets, Action.Delete)
  if (!ctx) return forbidden()

  const deleted = await deleteAsset(id, ctx.workspace.id)
  if (!deleted) return notFound()

  return NextResponse.json({ success: true })
}
