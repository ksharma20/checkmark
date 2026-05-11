import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth'
import { getWorkspaceBySlug, getWorkspaceMember } from '@/lib/db/queries/workspaces'
import { queryWorkspaceEvents } from '@/lib/signals'

interface Props {
  params: Promise<{ slug: string }>
}

export async function GET(req: NextRequest, { params }: Props) {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const { slug } = await params
  const workspace = await getWorkspaceBySlug(slug)
  if (!workspace) {
    return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const member = await getWorkspaceMember(workspace.id, user.userId)
  if (!member || member.status !== 'active') {
    return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  }

  const { searchParams } = req.nextUrl
  const start = searchParams.get('start') ?? undefined
  const end = searchParams.get('end') ?? undefined
  if (!start || !end) {
    return NextResponse.json(
      { error: 'start and end query parameters are required', code: 'VALIDATION_ERROR' },
      { status: 400 },
    )
  }

  const limit = Math.min(parseInt(searchParams.get("limit") ?? "10", 10), 500);
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10));

  const events = await queryWorkspaceEvents(workspace.id, workspace.plan, {
    startDate: start,
    endDate: end,
    userId: user.userId,
  })

  const total = events.length
  const sliced = events.slice(offset, offset + limit);

  return NextResponse.json({
    events: sliced,
    total,
    pagination: {
      offset,
      limit,
      nextOffset:
        offset + sliced.length < total ? offset + sliced.length : null,
    },
  });
}
