import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess } from '@/lib/ws-access'
import { getPendingApprovalItems, type ApprovalItem } from '@/lib/approvals'
import { Action, Resource } from '@/lib/permissions/catalogue'

interface Props { params: Promise<{ slug: string }> }

export interface ApprovalsResponse {
  items: ApprovalItem[]
  total: number
}

export async function GET(request: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAccess(request, slug, Resource.Approvals, Action.Read)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const url = new URL(request.url)
  const type = (url.searchParams.get('type') ?? 'all') as 'all' | 'leave' | 'regularization'
  const search = (url.searchParams.get('search') ?? '').trim().toLowerCase()

  const { items } = await getPendingApprovalItems(ctx.workspace.id, {
    leavesEnabled: !!ctx.workspace.leaves_enabled,
  })

  const filtered = items.filter((item) => {
    if (type !== 'all' && item.kind !== type) return false
    if (!search) return true
    const name = (item.user_full_name ?? item.user_email).toLowerCase()
    return name.includes(search) || item.user_email.toLowerCase().includes(search)
  })

  return NextResponse.json({ items: filtered, total: filtered.length } satisfies ApprovalsResponse)
}
