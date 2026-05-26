import { NextRequest, NextResponse } from 'next/server'
import { requireWsMember } from '@/lib/ws-admin'
import { queryWorkspaceEvents } from '@/lib/signals'

interface Props {
  params: Promise<{ slug: string }>
}

export async function GET(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsMember(req, slug)
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  const { workspace, userId } = ctx

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
    userId,
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
