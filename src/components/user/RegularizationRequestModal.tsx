'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { en } from '@/locales/en'

interface Props {
  slug: string
  minDate: string
  maxDate: string
  prefillDate?: string
  onClose: () => void
  onSuccess: () => void
}

const fieldLabelStyle: React.CSSProperties = {
  display: 'block', fontSize: '12px', fontFamily: 'DM Sans, sans-serif',
  color: 'var(--text-secondary)', marginBottom: '5px',
}

const inputStyle: React.CSSProperties = {
  width: '100%', height: '44px', padding: '0 12px', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)', fontSize: '14px', fontFamily: 'DM Sans, sans-serif',
  background: 'var(--surface-2)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
}

export default function RegularizationRequestModal({ slug, minDate, maxDate, prefillDate, onClose, onSuccess }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const [date, setDate] = useState(prefillDate ?? '')
  const [requestedType, setRequestedType] = useState<'office' | 'remote'>('office')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function submit() {
    if (!date || !reason.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/me/ws/${slug}/regularizations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_date: date, requested_type: requestedType, reason: reason.trim() }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (res.ok) {
        setSuccess(true)
        onSuccess()
        setTimeout(onClose, 1600)
      } else {
        setError(body.error ?? en.meWsRegularization.submitErrorGeneric)
      }
    } catch {
      setError(en.meWsRegularization.submitErrorGeneric)
    } finally {
      setSubmitting(false)
    }
  }

  if (!mounted) return null

  return createPortal(
    <div
      role="presentation"
      style={{
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', minHeight: '100dvh',
        zIndex: 1100, background: 'rgba(13, 27, 42, 0.45)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: '16px', boxSizing: 'border-box', overflow: 'auto',
      }}
      onClick={() => { if (!submitting) onClose() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reg-request-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '420px', background: 'var(--surface-0)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: '20px', margin: 'auto',
        }}
      >
        <h2 id="reg-request-title" style={{ fontFamily: 'Syne, sans-serif', fontSize: '18px', fontWeight: 700, color: 'var(--navy)', margin: '0 0 18px' }}>
          {en.meWsRegularization.modalTitle}
        </h2>

        {success ? (
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: 'var(--brand)', textAlign: 'center', padding: '20px 0' }}>
            {en.meWsRegularization.submitSuccess}
          </p>
        ) : (
          <>
            <div style={{ marginBottom: '14px' }}>
              <label style={fieldLabelStyle}>{en.meWsRegularization.fieldDate}</label>
              <input
                type="date"
                value={date}
                min={minDate}
                max={maxDate}
                disabled={!!prefillDate}
                onChange={(e) => setDate(e.target.value)}
                style={{ ...inputStyle, opacity: prefillDate ? 0.7 : 1 }}
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={fieldLabelStyle}>{en.meWsRegularization.fieldType}</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(['office', 'remote'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setRequestedType(t)}
                    style={{
                      flex: 1, height: '42px', borderRadius: 'var(--radius-md)',
                      border: requestedType === t ? '1px solid var(--brand)' : '1px solid var(--border)',
                      background: requestedType === t ? 'color-mix(in srgb, var(--brand) 12%, transparent)' : 'var(--surface-2)',
                      color: requestedType === t ? 'var(--brand)' : 'var(--text-secondary)',
                      fontFamily: 'DM Sans, sans-serif', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    {t === 'office' ? en.meWsRegularization.typeOffice : en.meWsRegularization.typeRemote}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={fieldLabelStyle}>{en.meWsRegularization.fieldReason}</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={en.meWsRegularization.fieldReasonPlaceholder}
                rows={3}
                style={{ ...inputStyle, height: 'auto', padding: '10px 12px', resize: 'vertical' }}
              />
            </div>

            {error && (
              <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--danger)', margin: '0 0 12px' }}>
                {error}
              </p>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                disabled={submitting}
                onClick={onClose}
                style={{
                  height: '44px', padding: '0 16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                  background: 'transparent', fontFamily: 'DM Sans, sans-serif', fontSize: '14px', fontWeight: 600,
                  color: 'var(--text-secondary)', cursor: submitting ? 'default' : 'pointer',
                }}
              >
                {en.meWsRegularization.cancel}
              </button>
              <button
                type="button"
                disabled={submitting || !date || !reason.trim()}
                onClick={() => void submit()}
                style={{
                  height: '44px', padding: '0 16px', border: 'none', borderRadius: 'var(--radius-md)',
                  background: 'var(--brand)', fontFamily: 'DM Sans, sans-serif', fontSize: '14px', fontWeight: 600,
                  color: '#fff',
                  cursor: submitting || !date || !reason.trim() ? 'not-allowed' : 'pointer',
                  opacity: submitting || !date || !reason.trim() ? 0.65 : 1,
                }}
              >
                {submitting ? en.meWsRegularization.submitting : en.meWsRegularization.submit}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
