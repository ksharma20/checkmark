import { NextRequest, NextResponse } from 'next/server'
import { revokeApiToken } from '@/lib/db/queries/users'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const { id } = await params
  await revokeApiToken(id, userId)
  return NextResponse.json({ success: true })
}
