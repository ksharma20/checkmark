import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth'
import { getWorkspaceBySlug, getWorkspaceMember } from '@/lib/db/queries/workspaces'
import { listHolidays } from '@/lib/db/queries/holidays'

interface Props { params: Promise<{ slug: string }> }

export async function GET(req: NextRequest, { params }: Props) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })

  const { slug } = await params
  const workspace = await getWorkspaceBySlug(slug)
  if (!workspace) return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 })

  const member = await getWorkspaceMember(workspace.id, user.userId)
  if (!member) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const yearParam = req.nextUrl.searchParams.get('year')
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear()

  const holidays = await listHolidays(workspace.id, year)
  return NextResponse.json({ holidays })
}
