'use client'

import { useState } from 'react'
import { Button, Field, Input, Modal, Textarea } from '@/components/ui'
import { en } from '@/locales/en'

interface Props {
  slug: string
  minDate: string
  maxDate: string
  prefillDate?: string
  onClose: () => void
  onSuccess: () => void
}

/**
 * "Request a correction" dialog.
 *
 * Built on the `Modal` primitive rather than a hand-rolled portal, so it picks
 * up the design-system scrim/panel, the Escape handler, the body scroll lock
 * and focus restoration for free. Callers still mount it conditionally, so it
 * is always rendered `open`.
 */
export default function RegularizationRequestModal({
  slug,
  minDate,
  maxDate,
  prefillDate,
  onClose,
  onSuccess,
}: Props) {
  const [date, setDate] = useState(prefillDate ?? '')
  const [requestedType, setRequestedType] = useState<'office' | 'remote'>('office')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const canSubmit = !!date && !!reason.trim() && !submitting

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

  return (
    <Modal
      open
      onClose={() => { if (!submitting) onClose() }}
      title={en.meWsRegularization.modalTitle}
      maxWidth={420}
      footer={
        success ? null : (
          <>
            <Button variant="secondary" disabled={submitting} onClick={onClose}>
              {en.meWsRegularization.cancel}
            </Button>
            <Button loading={submitting} disabled={!canSubmit} onClick={() => void submit()}>
              {submitting ? en.meWsRegularization.submitting : en.meWsRegularization.submit}
            </Button>
          </>
        )
      }
    >
      {success ? (
        <p
          role="status"
          className="t-secondary"
          style={{ color: 'var(--brand)', textAlign: 'center', padding: '20px 0', margin: 0 }}
        >
          {en.meWsRegularization.submitSuccess}
        </p>
      ) : (
        <div className="stack">
          <Field label={en.meWsRegularization.fieldDate} htmlFor="reg-date">
            <Input
              id="reg-date"
              type="date"
              value={date}
              min={minDate}
              max={maxDate}
              disabled={!!prefillDate}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>

          <Field label={en.meWsRegularization.fieldType} htmlFor="reg-type-office">
            <div role="radiogroup" style={{ display: 'flex', gap: '8px' }}>
              {(['office', 'remote'] as const).map((t) => (
                <Button
                  key={t}
                  id={`reg-type-${t}`}
                  role="radio"
                  aria-checked={requestedType === t}
                  variant={requestedType === t ? 'primary' : 'secondary'}
                  block
                  onClick={() => setRequestedType(t)}
                >
                  {t === 'office'
                    ? en.meWsRegularization.typeOffice
                    : en.meWsRegularization.typeRemote}
                </Button>
              ))}
            </div>
          </Field>

          <Field label={en.meWsRegularization.fieldReason} htmlFor="reg-reason">
            <Textarea
              id="reg-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={en.meWsRegularization.fieldReasonPlaceholder}
              rows={3}
            />
          </Field>

          {/* Submit failures belong to the request, not to any one field. */}
          {error && <p className="field-error" role="alert" style={{ margin: 0 }}>{error}</p>}
        </div>
      )}
    </Modal>
  )
}
