'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import { Check, X } from 'lucide-react'
import type { ApprovalItem } from '@/lib/approvals'
import { Avatar, Button, Chip, IconButton, Input, type ChipTone } from '@/components/ui'
import { en } from '@/locales/en'
import { wsAdmin } from '@/locales/en/ws-overview'
import { documents } from '@/locales/en/documents'

// A switch on `kind` rather than a ternary: ApprovalItem is a discriminated
// union, so adding a fourth kind becomes a compile error here instead of a row
// that silently renders the wrong fields.
export function itemLabel(item: ApprovalItem): string {
  switch (item.kind) {
    case 'leave': return item.leave_type_name
    case 'doc':   return documents.approvals.label
    default:      return item.requested_type === 'office' ? en.wsApprovals.markWfo : en.wsApprovals.markWfh
  }
}

export function itemDetail(item: ApprovalItem): string {
  switch (item.kind) {
    case 'leave': return `${item.start_date} → ${item.end_date} · ${item.days}d`
    case 'doc':   return documents.approvals.detail(item.doc_name, item.file_name)
    default:      return `${item.target_date} · ${item.reason}`
  }
}

function itemTone(item: ApprovalItem): ChipTone {
  return item.kind === 'leave' ? 'leave' : 'partial'
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
 * Renders one pending approval with its actions. Shared by the Overview
 * widget, the dedicated Approvals page and the People page section - all backed
 * by the same lib/approvals.ts source of truth, so this is the single place the
 * row UI needs to change.
 *
 * `kind: 'doc'` is deliberately NOT actionable inline: verifying a document
 * means looking at the file, so the row links into the employee record instead
 * of offering an approve button that would act on something unseen. The
 * approvals PATCH route only accepts `leave` and `regularization` for the same
 * reason.
 *
 * The workspace slug comes from the route rather than a prop: this row is only
 * ever rendered under /ws/[slug], and threading it through three unrelated
 * callers just to build one href buys nothing.
 */
export function ApprovalRow({
  item, busy, declining, onApprove, onDeclineStart, onDeclineCancel, onDeclineConfirm,
}: Props) {
  const { slug } = useParams<{ slug: string }>()
  const [reason, setReason] = useState('')
  const name = item.user_full_name ?? item.user_email

  return (
    <div
      className="fx-spring"
      style={{
        display: 'flex', gap: '10px', padding: '12px 20px',
        borderTop: '1px solid var(--border)',
        flexDirection: declining ? 'column' : 'row',
        alignItems: declining ? 'stretch' : 'center',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
        <Avatar name={name} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', margin: 0 }}>
            {name}
          </p>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px', flexWrap: 'wrap' }}>
            <Chip tone={itemTone(item)}>{itemLabel(item)}</Chip>
            <span className="t-muted">{itemDetail(item)}</span>
          </div>
        </div>
      </div>

      {declining ? (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', paddingLeft: '44px', flexWrap: 'wrap' }}>
          <Input
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={en.wsApprovals.declineReasonPlaceholder}
            style={{ flex: '1 1 200px', height: '38px' }}
          />
          <Button variant="secondary" size="sm" onClick={onDeclineCancel}>
            {en.wsApprovals.cancel}
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={busy || !reason.trim()}
            onClick={() => onDeclineConfirm(reason.trim())}
          >
            {en.wsApprovals.confirmDecline}
          </Button>
        </div>
      ) : item.kind === 'doc' ? (
        <Link
          href={`/ws/${slug}/people/${encodeURIComponent(item.employee_id)}/details?tab=documents`}
          className="btn btn-secondary btn-sm pressable"
          style={{ textDecoration: 'none', flexShrink: 0 }}
        >
          {wsAdmin.approvals.reviewDocument}
        </Link>
      ) : (
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          <IconButton
            variant="decline"
            label={en.wsApprovals.decline}
            icon={<X size={15} />}
            disabled={busy}
            onClick={onDeclineStart}
          />
          <IconButton
            variant="approve"
            label={en.wsApprovals.approve}
            icon={<Check size={15} />}
            disabled={busy}
            onClick={onApprove}
          />
        </div>
      )}
    </div>
  )
}
