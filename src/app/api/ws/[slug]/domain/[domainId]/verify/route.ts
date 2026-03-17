import { NextRequest, NextResponse } from 'next/server'
import { requireWsAdmin } from '@/lib/ws-admin'
import { getWorkspaceDomains, markDomainVerified } from '@/lib/db/queries/workspaces'
import { domainVerifyToken, checkDnsVerification } from '@/lib/domain-verify'

interface Props { params: Promise<{ slug: string; domainId: string }> }

export async function POST(request: NextRequest, { params }: Props) {
  const { slug, domainId } = await params
  const ctx = await requireWsAdmin(request, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const domains = await getWorkspaceDomains(ctx.workspace.id)
  const domain = domains.find((d) => d.id === domainId)
  if (!domain) return NextResponse.json({ error: 'Domain not found', code: 'NOT_FOUND' }, { status: 404 })

  if (domain.verified_at) {
    return NextResponse.json({ verified: true, alreadyVerified: true })
  }

  const token = domainVerifyToken(ctx.workspace.id, domain.domain)
  const found = await checkDnsVerification(domain.domain, token)

  if (found) {
    await markDomainVerified(domainId)
    return NextResponse.json({ verified: true })
  }

  return NextResponse.json({
    verified: false,
    message: 'TXT record not found yet. DNS changes can take up to 48 hours to propagate.',
  })
}
