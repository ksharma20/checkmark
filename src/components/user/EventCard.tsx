'use client'

import { useState } from 'react'
import type { PresenceEvent } from '@/lib/db/queries/events'
import type { MatchedBy } from '@/lib/signals'
import type { RegularizationStatus } from '@/lib/db/queries/regularizations'
import { fmtTime, durationLabel } from '@/lib/client/format-time'
import { Button, Card, Chip, Divider, Input, toneForMatchedBy } from '@/components/ui'
import RegularizationRequestModal from './RegularizationRequestModal'
import { en } from '@/locales/en'
import { meSettings } from '@/locales/en/me-settings'

interface EventCardProps {
  event: PresenceEvent & {
    matched_by?: MatchedBy
    matched_signals?: string[]
  }
  onNoteUpdate?: (id: string, note: string) => void
  /** Workspace slug - only set when a specific workspace (not "All workspaces") is selected. */
  workspaceSlug?: string | null
  /** This event's own regularization status, if a request already exists for it. */
  regularizationStatus?: RegularizationStatus
  onRegularizationSubmitted?: () => void
}

const MATCHED_LABEL: Record<MatchedBy, string> = {
  verified: en.meTimeline.matchedVerified,
  partial: en.meTimeline.matchedPartial,
  none: en.meTimeline.matchedNone,
  override: en.meTimeline.matchedOverride,
}

const REG_STATUS_LABEL: Record<RegularizationStatus, string> = {
  pending: en.meWsRegularization.statusPending,
  approved: en.meWsRegularization.statusApproved,
  rejected: en.meWsRegularization.statusRejected,
}

/** Chip tone that matches how a correction request currently stands. */
function regStatusTone(status: RegularizationStatus) {
  if (status === 'approved') return 'verified' as const
  if (status === 'rejected') return 'none' as const
  return 'partial' as const
}

/** One "Check-in" / "Checkout" line inside the expanded detail panel. */
function LocationRow({
  label,
  remote,
  lat,
  lng,
  text,
  fallback,
  danger,
}: {
  label: string
  remote: boolean
  lat: number | null
  lng: number | null
  text: string | null
  fallback: string
  danger?: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
      <span className="t-eyebrow" style={{ width: '62px', flexShrink: 0 }}>{label}</span>

      {remote ? (
        <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--amber)' }}>
          {meSettings.event.remote}
        </span>
      ) : lat !== null && lng !== null ? (
        <a
          href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=16`}
          target="_blank"
          rel="noopener noreferrer"
          title={meSettings.event.mapLinkLabel}
          style={{
            fontSize: '12.5px',
            color: 'var(--brand)',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
          }}
        >
          <span aria-hidden style={{ color: danger ? 'var(--danger)' : 'var(--teal)' }}>◉</span>
          {text ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`}
        </a>
      ) : (
        <span className="t-muted">{fallback}</span>
      )}
    </div>
  )
}

export default function EventCard({
  event,
  onNoteUpdate,
  workspaceSlug,
  regularizationStatus,
  onRegularizationSubmitted,
}: EventCardProps) {
  const geoLabel = event.location_label ?? null
  const [expanded, setExpanded] = useState(false)
  const [editingNote, setEditingNote] = useState(false)
  const [noteValue, setNoteValue] = useState(event.note ?? '')
  const [saving, setSaving] = useState(false)
  const [regModalOpen, setRegModalOpen] = useState(false)
  const isRemote = event.event_type === 'remote_checkin'
  const eventDate = event.checkin_at.slice(0, 10)
  const canRequestCorrection =
    !!workspaceSlug && (event.matched_by === 'partial' || event.matched_by === 'none')

  const trustFlags: string[] = (() => {
    try { return event.trust_flags ? JSON.parse(event.trust_flags) as string[] : [] }
    catch { return [] }
  })()
  const isOutsideRadius = trustFlags.includes('checkout_outside_radius')

  const duration = durationLabel(event.checkin_at, event.checkout_at)

  // "1:37 PM - 2:15 PM" or just "1:37 PM"
  const timeRange = event.checkout_at
    ? `${fmtTime(event.checkin_at)} - ${fmtTime(event.checkout_at)}`
    : fmtTime(event.checkin_at)

  /**
   * The note is the ONLY editable field on a presence event - the rows
   * themselves are immutable, so there is deliberately no delete affordance.
   */
  async function saveNote() {
    setSaving(true)
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: noteValue }),
      })
      if (res.ok) {
        setEditingNote(false)
        onNoteUpdate?.(event.id, noteValue)
      }
    } finally {
      setSaving(false)
    }
  }

  const hasDetail =
    !!event.matched_signals?.length ||
    event.checkout_location_mismatch != null ||
    event.gps_lat !== null ||
    !!event.checkout_at ||
    isRemote

  return (
    <Card style={{ padding: '14px 16px' }}>
      {/* Time range + duration, with the signal verdict on the right. */}
      <div className="row-between" style={{ alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '13.5px',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            {timeRange}
          </span>
          {duration && <span className="t-muted" style={{ marginLeft: '8px' }}>{duration}</span>}
        </div>

        {event.matched_by != null && (
          <Chip tone={toneForMatchedBy(event.matched_by)}>{MATCHED_LABEL[event.matched_by]}</Chip>
        )}
      </div>

      {/* Location line */}
      {(geoLabel || isRemote) && (
        <p className="t-secondary" style={{ margin: '6px 0 0' }}>
          <span aria-hidden style={{ color: isRemote ? 'var(--amber)' : 'var(--teal)' }}>◉ </span>
          {isRemote ? meSettings.event.remote : geoLabel}
        </p>
      )}

      {/* Inline note editing - PATCH /api/events/{id} */}
      <div style={{ marginTop: '8px' }}>
        {editingNote ? (
          <div style={{ display: 'flex', gap: '8px' }}>
            <Input
              type="text"
              value={noteValue}
              onChange={(e) => setNoteValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveNote()
                if (e.key === 'Escape') { setNoteValue(event.note ?? ''); setEditingNote(false) }
              }}
              autoFocus
              aria-label={meSettings.event.noteEditLabel}
              placeholder={meSettings.event.notePlaceholder}
            />
            <Button size="sm" loading={saving} onClick={saveNote}>
              {saving ? meSettings.event.noteSaving : meSettings.event.noteSave}
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditingNote(true)}
            aria-label={meSettings.event.noteEditLabel}
            className="pressable"
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
              font: 'inherit',
              fontSize: '13px',
              color: noteValue ? 'var(--text-secondary)' : 'var(--text-muted)',
            }}
          >
            {noteValue || meSettings.event.noteEmpty}
          </button>
        )}
      </div>

      {/* Footer: detail toggle + the per-event regularization entry point. */}
      {(hasDetail || canRequestCorrection || regularizationStatus) && (
        <div
          className="row-between"
          style={{ marginTop: '10px', gap: '8px', flexWrap: 'wrap' }}
        >
          {hasDetail ? (
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
              style={{ paddingLeft: 0, paddingRight: 0 }}
            >
              {expanded ? meSettings.event.detailsHide : meSettings.event.detailsShow}
            </Button>
          ) : <span />}

          {regularizationStatus ? (
            <Chip tone={regStatusTone(regularizationStatus)}>
              {en.meTimeline.correctionRequested} {REG_STATUS_LABEL[regularizationStatus]}
            </Chip>
          ) : canRequestCorrection ? (
            <Button variant="secondary" size="sm" onClick={() => setRegModalOpen(true)}>
              {en.meTimeline.requestCorrection}
            </Button>
          ) : null}
        </div>
      )}

      {/* Expandable detail panel */}
      {expanded && hasDetail && (
        <>
          <Divider style={{ margin: '12px 0' }} />
          <div className="stack-sm">
            {event.matched_signals && event.matched_signals.length > 0 && (
              <p className="t-muted" style={{ margin: 0 }}>
                {en.meTimeline.matchedSignals}: {event.matched_signals.join(', ')}
              </p>
            )}

            <LocationRow
              label={meSettings.event.checkinLabel}
              remote={isRemote}
              lat={event.gps_lat}
              lng={event.gps_lng}
              text={geoLabel}
              fallback={en.meTimeline.checkoutLocationNotCaptured}
            />

            {event.checkout_at && (
              <LocationRow
                label={meSettings.event.checkoutLabel}
                remote={isRemote}
                lat={event.checkout_gps_lat}
                lng={event.checkout_gps_lng}
                text={event.checkout_location_label}
                fallback={en.meTimeline.checkoutLocationNotCaptured}
                danger={isOutsideRadius}
              />
            )}

            {event.checkout_location_mismatch != null && (
              <Chip tone={isOutsideRadius ? 'none' : 'leave'}>
                {isOutsideRadius
                  ? meSettings.event.distanceOutside(event.checkout_location_mismatch)
                  : meSettings.event.distanceInside(event.checkout_location_mismatch)}
              </Chip>
            )}
          </div>
        </>
      )}

      {regModalOpen && workspaceSlug && (
        <RegularizationRequestModal
          slug={workspaceSlug}
          minDate={eventDate}
          maxDate={eventDate}
          prefillDate={eventDate}
          onClose={() => setRegModalOpen(false)}
          onSuccess={() => { setRegModalOpen(false); onRegularizationSubmitted?.() }}
        />
      )}
    </Card>
  )
}
