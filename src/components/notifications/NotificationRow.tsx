'use client'

import type { ReactNode } from 'react'
import { Bell, CalendarDays, Clock, FileText, Mail, Megaphone } from 'lucide-react'
import type { Notification } from '@/lib/db/queries/notifications'
import { swatchColor } from '@/lib/workspace-color'
import { notificationsUi } from '@/locales/en/notifications'

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr.includes('T') ? dateStr : dateStr + 'Z').getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

/**
 * Icon by *family*, colour by *outcome* - the two axes are independent.
 *
 * The old map had exactly three arms (leave_submitted, leave_approved, and an
 * X-in-a-circle for literally everything else), so a rejected document, a
 * declined correction, a check-in reminder and a workspace announcement all
 * arrived wearing the same rejection icon. At a glance the feed was unreadable.
 *
 * Families map to shape; verdicts map to colour. That keeps the two readable at
 * once: shape says what it is about, colour says whether it went your way.
 */
function TypeIcon({ type }: { type: Notification['type'] }) {
  // One shared size/weight so the column of icons reads as a column. Declared
  // as a component rather than returning the component *value* into a render
  // scope, which would remount the icon on every render.
  const props = { size: 15, strokeWidth: 2, 'aria-hidden': true } as const
  if (type.startsWith('leave_')) return <CalendarDays {...props} />
  if (type.startsWith('regularization_')) return <Clock {...props} />
  if (type.startsWith('document_')) return <FileText {...props} />
  if (type === 'announcement') return <Megaphone {...props} />
  // An invitation is the one row that is an OFFER rather than a record of
  // something that already happened, and an envelope is the only glyph in the
  // set that reads as "somebody is waiting on you" rather than "here is what
  // occurred".
  if (type === 'invitation') return <Mail {...props} />
  // An unknown type is still a notification: a bell is the honest default.
  //
  // That fallback is what carries the retired reminder types. `checkin_reminder`
  // and `checkout_reminder` left `NotificationType` when reminders became a
  // push-only schedule, so naming them here no longer typechecks - but rows
  // written before that change are still in the database and still render
  // through this component. They landed on a bell when they were named; they
  // land on the same bell now, so nothing in the feed changed.
  return <Bell {...props} />
}

function iconColor(type: Notification['type']): string {
  // `document_verified` is the document family's "approved" - it does not end
  // in `_approved`, so it is named rather than pattern-matched.
  if (type.endsWith('_approved') || type === 'document_verified') return 'var(--teal)'
  if (type.endsWith('_rejected')) return 'var(--danger)'
  // Announcements and everything neutral stay brand blue - nothing has gone
  // wrong, and nothing has been decided in your favour either. No arm names a
  // type literal, which is why this function needed no edit when the two
  // reminder types left `NotificationType`: historical rows still carrying them
  // fall through to exactly the blue they always got.
  return 'var(--brand)'
}

/**
 * Which workspace this came from, only where that is not already obvious.
 *
 * Colour is `swatchColor(workspace_id)` - the exact helper the workspace pill
 * in the top bar uses - so the badge and the pill are the same colour for the
 * same workspace. Seeded on the id, never the slug, so a rename does not
 * recolour a workspace out from under the reader.
 */
function WorkspaceBadge({ notification }: { notification: Notification }) {
  // No workspace means an account-level event (nothing org-scoped produces
  // these today, but the column is nullable). "Personal" is deliberately
  // neutral: tinting it would invent a workspace that does not exist.
  const workspaceId = notification.workspace_id
  const personal = !workspaceId
  const color = workspaceId ? swatchColor(workspaceId) : 'var(--text-muted)'
  const label = personal
    ? notificationsUi.personalBadge
    : notification.workspace_name ?? notification.workspace_slug ?? notificationsUi.personalBadge

  return (
    <span style={{
      display: 'inline-block', maxWidth: '100%',
      fontFamily: 'var(--font-body)', fontSize: '10px',
      fontWeight: 600, lineHeight: '14px', letterSpacing: '0.02em',
      padding: '1px 7px', borderRadius: '999px',
      color, border: `1px solid ${personal ? 'var(--border)' : color}`,
      background: personal ? 'var(--surface-2)' : 'transparent',
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

interface Props {
  notification: Notification
  onClick: () => void
  /**
   * Opt-in, default false. The workspace-scoped views (the bell panel, and
   * `/me/notifications?ws=`) already say which workspace you are in, so a badge
   * there is noise repeated on every row. Only the unified view turns it on.
   */
  showWorkspace?: boolean
  /**
   * Controls that belong to this row - today, an invitation's Accept / Decline
   * or the chip that says how it was answered.
   *
   * Rendered as a SIBLING of the row button, not inside it. The row was a single
   * `<button>` wrapping everything, and a button inside a button is invalid HTML
   * that browsers resolve by silently dropping the inner one; the outer click
   * would have swallowed Accept. So the clickable area is now the content half
   * only, and this sits beneath it inside the same bordered container.
   *
   * A `ReactNode` rather than an `invitation` prop, so this component keeps
   * knowing nothing about consent: the screen that owns the endpoint owns the
   * buttons. The `/ws` bell panel passes nothing and is unchanged.
   */
  actions?: ReactNode
}

export default function NotificationRow({ notification, onClick, showWorkspace = false, actions }: Props) {
  const unread = notification.read_at === null
  return (
    <div style={{
      background: unread ? 'var(--surface-2)' : 'var(--surface-0)',
      borderBottom: '1px solid var(--border)',
      borderLeft: unread ? '3px solid var(--brand)' : '3px solid transparent',
    }}>
    <button type="button" onClick={onClick} style={{
      display: 'flex', alignItems: 'flex-start', gap: '10px',
      padding: '12px 16px', width: '100%', textAlign: 'left',
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
    }}>
      <span style={{ color: iconColor(notification.type), flexShrink: 0, marginTop: '2px' }}>
        <TypeIcon type={notification.type} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: unread ? 600 : 400, color: 'var(--navy)', lineHeight: '1.4' }}>
          {notification.title}
        </div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {notification.body}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', minWidth: 0 }}>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>
            {formatRelativeTime(notification.created_at)}
          </span>
          {showWorkspace && <WorkspaceBadge notification={notification} />}
        </div>
      </div>
      {unread && <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--brand)', flexShrink: 0, marginTop: '5px' }} />}
    </button>
    {/* Indented to the text column, so the controls line up under the title
        rather than under the icon gutter. */}
    {actions && <div style={{ padding: '0 16px 12px 41px' }}>{actions}</div>}
    </div>
  )
}
