import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess, forbidden } from '@/lib/ws-access'
import { Action, Resource } from '@/lib/permissions/catalogue'
import {
  listAssets,
  createAsset,
  listAssetCategories,
  getAssetStatusCounts,
  isAssetStatus,
} from '@/lib/db/queries/assets'
import { parseAssetBody } from './_validate'

interface Props { params: Promise<{ slug: string }> }

// ─── GET /api/ws/[slug]/assets ────────────────────────────────────────────────
// Optional ?category= and ?status= filters.

export async function GET(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAccess(req, slug, Resource.Assets, Action.Read)
  if (!ctx) return forbidden()

  const sp = req.nextUrl.searchParams
  const category = sp.get('category') ?? undefined
  const statusParam = sp.get('status')
  // An unrecognised status is dropped rather than 400'd: it would otherwise
  // turn a stale bookmark into an error page.
  const status = isAssetStatus(statusParam) ? statusParam : undefined

  const [assets, categories, statusCounts] = await Promise.all([
    listAssets(ctx.workspace.id, { category, status }),
    listAssetCategories(ctx.workspace.id),
    getAssetStatusCounts(ctx.workspace.id),
  ])

  return NextResponse.json({ assets, categories, statusCounts })
}

// ─── POST /api/ws/[slug]/assets ───────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAccess(req, slug, Resource.Assets, Action.Write)
  if (!ctx) return forbidden()

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const { errors, parsed } = parseAssetBody(body, { partial: false })
  if (Object.keys(errors).length > 0) {
    return NextResponse.json(
      { error: 'Validation failed', code: 'VALIDATION_ERROR', fields: errors },
      { status: 422 },
    )
  }

  const asset = await createAsset({
    workspaceId: ctx.workspace.id,
    name: parsed.name!,
    category: parsed.category,
    serial_number: parsed.serial_number,
    condition: parsed.condition,
    status: parsed.status,
    purchase_value: parsed.purchase_value,
    notes: parsed.notes,
  })

  return NextResponse.json({ asset }, { status: 201 })
}
