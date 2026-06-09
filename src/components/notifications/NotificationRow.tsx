'use client'

import type { Notification } from '@/lib/db/queries/notifications'

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr.includes('T') ? dateStr : dateStr + 'Z').getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function TypeIcon({ type }: { type: Notification['type'] }) {
  if (type === 'leave_submitted') return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/>
    </svg>
  )
  if (type === 'leave_approved') return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  )
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
    </svg>
  )
}

function iconColor(type: Notification['type']) {
  if (type === 'leave_approved') return 'var(--teal)'
  if (type === 'leave_rejected') return 'var(--danger)'
  return 'var(--brand)'
}

export default function NotificationRow({ notification, onClick }: { notification: Notification; onClick: () => void }) {
  const unread = notification.read_at === null
  return (
    <button type="button" onClick={onClick} style={{
      display: 'flex', alignItems: 'flex-start', gap: '10px',
      padding: '12px 16px', width: '100%', textAlign: 'left',
      background: unread ? 'var(--surface-2)' : 'var(--surface-0)',
      border: 'none', borderBottom: '1px solid var(--border)',
      borderLeft: unread ? '3px solid var(--brand)' : '3px solid transparent',
      cursor: 'pointer',
    }}>
      <span style={{ color: iconColor(notification.type), flexShrink: 0, marginTop: '2px' }}>
        <TypeIcon type={notification.type} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', fontWeight: unread ? 600 : 400, color: 'var(--navy)', lineHeight: '1.4' }}>
          {notification.title}
        </div>
        <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {notification.body}
        </div>
        <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
          {formatRelativeTime(notification.created_at)}
        </div>
      </div>
      {unread && <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--brand)', flexShrink: 0, marginTop: '5px' }} />}
    </button>
  )
}
