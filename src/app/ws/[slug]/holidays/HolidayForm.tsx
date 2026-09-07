'use client'

import { useState } from 'react'
import { Button, Field, Input, Modal } from '@/components/ui'
import { wsAdmin } from '@/locales/en/ws-settings'
import type { Holiday } from './types'

const t = wsAdmin.holidays

interface Props {
  slug: string
  open: boolean
  /** Present when editing an existing row; absent when adding a new one. */
  initial?: Holiday
  onSave: (holiday: Holiday) => void
  onClose: () => void
}

/**
 * Add / edit a holiday.
 *
 * POST creates, PATCH updates - the same two endpoints as before the re-skin.
 * A 409 `DUPLICATE` is surfaced as its own message rather than the generic
 * failure, because "you already have this one" is a different instruction to
 * the user than "try again".
 */
export function HolidayForm({ slug, open, initial, onSave, onClose }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [date, setDate] = useState(initial?.date ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!name.trim() || !date) {
      setError(t.requiredError)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const url = initial
        ? `/api/ws/${slug}/holidays/${initial.id}`
        : `/api/ws/${slug}/holidays`
      const res = await fetch(url, {
        method: initial ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), date, description: description.trim() || null }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.code === 'DUPLICATE' ? t.duplicateError : data.error ?? t.genericError)
        return
      }
      onSave(data.holiday)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      maxWidth={440}
      title={initial ? t.formEditTitle : t.formAddTitle}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>{t.cancelBtn}</Button>
          <Button size="sm" loading={saving} onClick={save}>
            {initial ? t.saveBtn : t.addSubmitBtn}
          </Button>
        </>
      }
    >
      <div className="stack">
        <Field label={t.fieldName} htmlFor="holiday-name" required>
          <Input
            id="holiday-name"
            autoFocus
            value={name}
            placeholder={t.fieldNamePlaceholder}
            invalid={!!error && !name.trim()}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label={t.fieldDate} htmlFor="holiday-date" required>
          <Input
            id="holiday-date"
            type="date"
            value={date}
            invalid={!!error && !date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label={t.fieldDescription} htmlFor="holiday-description">
          <Input
            id="holiday-description"
            value={description}
            placeholder={t.fieldDescriptionPlaceholder}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        {error && <p className="field-error" role="alert">{error}</p>}
      </div>
    </Modal>
  )
}
