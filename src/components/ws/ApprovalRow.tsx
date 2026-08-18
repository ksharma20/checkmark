'use client'

import { useState } from 'react'
import { Check, X } from 'lucide-react'
import type { ApprovalItem } from '@/lib/approvals'
import { en } from '@/locales/en'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export function itemLabel(item: ApprovalItem): string {
  return item.kind === 'leave' ? item.leave_type_name : (item.requested_type === 'office' ? en.wsApprovals.markWfo : en.wsApprovals.markWfh)
}

export function itemDetail(item: ApprovalItem): string {
  if (item.kind === 'leave') return `${item.start_date} → ${item.end_date} · ${item.days}d`
  return `${item.target_date} · ${item.reason}`
}

interface Props {
  item: ApprovalItem
  busy: boolean
  declining: boolean
  onApprove: () => void
  onDeclineStart: () => void
  onDeclineCancel: () => void
  onDeclineConfirm: (reason: string) => void
}

/**
 * Renders one pending leave/regularization request with approve/decline actions.
 * Shared by the Overview widget's data, the dedicated Approvals page, and the
 * People page section - all backed by the same lib/approvals.ts source of truth,
 * so this is the single place the row UI needs to change.
 */
export function ApprovalRow({
  item, busy, declining, onApprove, onDeclineStart, onDeclineCancel, onDeclineConfirm,
}: Props) {
  const [reason, setReason] = useState('')
  const name = item.user_full_name ?? item.user_email
  const chipColor = item.kind === 'leave' ? 'var(--brand)' : 'var(--amber)'

  return (
    <div
      className="fx-spring"
      style={{
        display: 'flex', flexDirection: declining ? 'column' : 'row', alignItems: declining ? 'stretch' : 'center',
        gap: '10px', padding: '13px 20px', borderTop: '1px solid var(--border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
        <div style={{
          width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
          background: 'color-mix(in srgb, var(--brand) 16%, transparent)', color: 'var(--brand)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'DM Sans, sans-serif', fontSize: '12.5px', fontWeight: 700,
        }}>
          {initials(name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {name}
            </span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', height: '18px', padding: '0 8px',
              borderRadius: '999px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.03em',
              textTransform: 'uppercase', color: chipColor,
              background: `color-mix(in srgb, ${chipColor} 14%, transparent)`,
              border: `1px solid color-mix(in srgb, ${chipColor} 30%, transparent)`,
            }}>
              {itemLabel(item)}
            </span>
          </div>
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '11.5px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
            {itemDetail(item)}
          </p>
        </div>
      </div>

      {declining ? (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', paddingLeft: '44px' }}>
          <input
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={en.wsApprovals.declineReasonPlaceholder}
            style={{
              flex: 1, height: '34px', padding: '0 10px', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)', color: 'var(--text-primary)',
              fontFamily: 'DM Sans, sans-serif', fontSize: '12.5px', outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={onDeclineCancel}
            style={{ height: '34px', padding: '0 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
          >
            {en.wsApprovals.cancel}
          </button>
          <button
            type="button"
            disabled={busy || !reason.trim()}
            onClick={() => onDeclineConfirm(reason.trim())}
            style={{ height: '34px', padding: '0 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--danger)', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: busy || !reason.trim() ? 'default' : 'pointer', opacity: busy || !reason.trim() ? 0.6 : 1 }}
          >
            {en.wsApprovals.confirmDecline}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <button
            type="button"
            title={en.wsApprovals.decline}
            disabled={busy}
            onClick={onDeclineStart}
            style={{
              width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', flexShrink: 0,
              background: 'transparent', color: 'var(--danger)',
              border: '1px solid color-mix(in srgb, var(--danger) 35%, transparent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: busy ? 'default' : 'pointer',
            }}
          >
            <X size={15} />
          </button>
          <button
            type="button"
            title={en.wsApprovals.approve}
            disabled={busy}
            onClick={onApprove}
            style={{
              width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', flexShrink: 0,
              background: 'var(--brand)', color: '#fff', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: busy ? 'default' : 'pointer',
            }}
          >
            <Check size={15} />
          </button>
        </div>
      )}
    </div>
  )
}
