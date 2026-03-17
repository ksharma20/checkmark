import { NextRequest, NextResponse } from 'next/server'
import { requireWsAdmin } from '@/lib/ws-admin'
import {
  getAllMembersWithDetails,
  getWorkspaceMemberByEmail,
  upsertInvitedMember,
} from '@/lib/db/queries/workspaces'
import { sendConsentEmail } from '@/lib/email'

interface Props { params: Promise<{ slug: string }> }

export async function GET(request: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAdmin(request, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const members = await getAllMembersWithDetails(ctx.workspace.id)
  return NextResponse.json({ members })
}

export async function POST(request: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAdmin(request, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  let body: { email?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const email = (body.email ?? '').toLowerCase().trim()
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email is required', code: 'MISSING_EMAIL' }, { status: 400 })
  }

  const existing = await getWorkspaceMemberByEmail(ctx.workspace.id, email)
  if (existing?.status === 'active') {
    return NextResponse.json({ error: 'This person is already an active member', code: 'ALREADY_MEMBER' }, { status: 409 })
  }

  const consentToken = crypto.randomUUID()
  const consentTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  await upsertInvitedMember({
    workspaceId: ctx.workspace.id,
    email,
    consentToken,
    consentTokenExpiresAt,
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  await sendConsentEmail({
    to: email,
    workspaceName: ctx.workspace.name,
    consentToken,
    appUrl,
  })

  return NextResponse.json({ success: true })
}
