import { NextRequest, NextResponse } from 'next/server'
import { getMutedCategories, setCategoryMuted } from '@/lib/db/queries/notification-prefs'
import { CATEGORY_DEFS, isNotificationCategory } from '@/lib/notifications/categories'
import { meSettings } from '@/locales/en/me-settings'

const t = meSettings.settings.notifications.api

/**
 * Account-level notification mutes - the `presence` category and nothing else
 * today.
 *
 * There is no workspace in this route at all, which is the whole reason it is
 * separate from the `/api/me/ws/[slug]/...` one: a check-in session carries no
 * `workspace_id` (see CLAUDE.md), so its preference row is keyed on the member
 * alone and `workspaceId` goes to the query layer as NULL.
 *
 * The user id is the proxy-set `x-user-id` header, never the body (invariant 1).
 */

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })

  const muted = await getMutedCategories(userId, null)
  return NextResponse.json({ muted: [...muted] })
}

export async function PATCH(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })

  let body: { category?: unknown; muted?: unknown }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: t.invalidBody, code: 'INVALID_BODY' }, { status: 400 })
  }

  const { category, muted } = body
  if (!isNotificationCategory(category) || typeof muted !== 'boolean') {
    return NextResponse.json({ error: t.invalidBody, code: 'INVALID_BODY' }, { status: 400 })
  }

  const def = CATEGORY_DEFS[category]

  // A workspace-scoped category written with a NULL workspace would land in a
  // row no delivery path looks at - `notifyWorkspace` reads (user, workspace).
  if (def.scope !== 'account') {
    return NextResponse.json(
      { error: t.wrongScopeAccount(category), code: 'WRONG_SCOPE' },
      { status: 400 },
    )
  }

  if (!def.memberMutable) {
    return NextResponse.json(
      { error: t.locked(category), code: 'CATEGORY_LOCKED' },
      { status: 409 },
    )
  }

  await setCategoryMuted(userId, null, category, muted)

  return NextResponse.json({ success: true })
}
