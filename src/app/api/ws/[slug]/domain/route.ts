import { NextRequest, NextResponse } from 'next/server'
import { requireWsAdmin } from '@/lib/ws-admin'
import { getWorkspaceDomains, addWorkspaceDomain, isDomainVerifiedElsewhere } from '@/lib/db/queries/workspaces'
import { domainVerifyToken } from '@/lib/domain-verify'

interface Props { params: Promise<{ slug: string }> }

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i

export async function GET(request: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAdmin(request, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const domains = await getWorkspaceDomains(ctx.workspace.id)
  const withTokens = domains.map((d) => ({
    ...d,
    verifyToken: d.verified_at ? null : domainVerifyToken(ctx.workspace.id, d.domain),
  }))
  return NextResponse.json({ domains: withTokens })
}

export async function POST(request: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAdmin(request, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  let body: { domain?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const domain = (body.domain ?? '').toLowerCase().trim()
  if (!domain || !DOMAIN_RE.test(domain)) {
    return NextResponse.json({ error: 'Invalid domain format', code: 'INVALID_DOMAIN' }, { status: 400 })
  }

  const existing = await getWorkspaceDomains(ctx.workspace.id)
  if (existing.some((d) => d.domain === domain)) {
    return NextResponse.json({ error: 'Domain already added', code: 'DOMAIN_EXISTS' }, { status: 409 })
  }

  // Block domains already verified by another workspace
  const claimedElsewhere = await isDomainVerifiedElsewhere(domain, ctx.workspace.id)
  if (claimedElsewhere) {
    return NextResponse.json(
      { error: 'This domain is already verified by another workspace', code: 'DOMAIN_CLAIMED' },
      { status: 409 }
    )
  }

  const d = await addWorkspaceDomain(ctx.workspace.id, domain)
  return NextResponse.json({
    domain: d,
    verifyToken: domainVerifyToken(ctx.workspace.id, domain),
  })
}
