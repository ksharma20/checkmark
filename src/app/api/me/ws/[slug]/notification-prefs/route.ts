import { NextRequest, NextResponse } from 'next/server'
import { requireWsMember } from '@/lib/ws-admin'
import { getMutedCategories, setCategoryMuted } from '@/lib/db/queries/notification-prefs'
import {
  CATEGORY_DEFS,
  isNotificationCategory,
  parseCategoriesOff,
} from '@/lib/notifications/categories'
import { meSettings } from '@/locales/en/me-settings'

const t = meSettings.settings.notifications.api

/**
 * The member's own mutes for one workspace.
 *
 * Gated with `requireWsMember`, not `requireWsAccess`: this is the /me surface,
 * where the answer is decided by the session user alone (invariant 14). There is
 * no permission that could widen or narrow it - a member is only ever setting
 * their own preferences, and the user id comes from the proxy header, never the
 * body.
 */
interface Props { params: Promise<{ slug: string }> }

export async function GET(request: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsMember(request, slug)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })

  const muted = await getMutedCategories(ctx.userId, ctx.workspace.id)

  return NextResponse.json({
    muted: [...muted],
    // What the workspace has switched off for everybody. The screen hides those
    // rows rather than showing a switch that decides nothing - but it is sent
    // rather than pre-filtered so the client can tell "off for the org" from
    // "muted by me", which are different facts.
    workspaceOff: [...parseCategoriesOff(ctx.workspace.notification_categories_off)],
  })
}

export async function PATCH(request: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsMember(request, slug)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })

  let body: { category?: unknown; muted?: unknown }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: t.invalidBody, code: 'INVALID_BODY' }, { status: 400 })
  }

  const { category, muted } = body
  if (!isNotificationCategory(category) || typeof muted !== 'boolean') {
    return NextResponse.json({ error: t.invalidBody, code: 'INVALID_BODY' }, { status: 400 })
  }

  const def = CATEGORY_DEFS[category]

  // An account-scoped category has no workspace to key a row on, so writing one
  // here would produce a preference nothing ever reads. Point at the route that
  // does own it rather than accepting it quietly.
  if (def.scope !== 'workspace') {
    return NextResponse.json(
      { error: t.wrongScopeWorkspace(category), code: 'WRONG_SCOPE' },
      { status: 400 },
    )
  }

  // Refused rather than ignored: a stored mute that the delivery path will
  // never honour is a lie the settings screen would then render back.
  if (!def.memberMutable) {
    return NextResponse.json(
      { error: t.locked(category), code: 'CATEGORY_LOCKED' },
      { status: 409 },
    )
  }

  await setCategoryMuted(ctx.userId, ctx.workspace.id, category, muted)

  return NextResponse.json({ success: true })
}
