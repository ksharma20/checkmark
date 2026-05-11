'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import type { Holiday } from './types'

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: '36px',
  padding: '0 10px',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  fontSize: '13px',
  fontFamily: 'DM Sans, sans-serif',
  background: 'var(--surface-2)',
  color: 'var(--navy)',
  outline: 'none',
  boxSizing: 'border-box',
}

export function HolidayForm({ slug, initial, onSave, onCancel }: {
  slug: string
  initial?: Holiday
  onSave: (h: Holiday) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [date, setDate] = useState(initial?.date ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!name.trim() || !date) { setError('Name and date are required'); return }
    setSaving(true); setError(null)
    try {
      const url = initial
        ? `/api/ws/${slug}/holidays/${initial.id}`
        : `/api/ws/${slug}/holidays`
      const res = await fetch(url, {
        method: initial ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), date, description: description.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }
      onSave(data.holiday)
    } finally { setSaving(false) }
  }

  return (
    <div style={{
      background: 'var(--surface-1)',
      border: '1px solid var(--border)',
      borderRadius: '8px',
      padding: '14px',
      marginBottom: '10px',
    }}>
      <p style={{
        fontSize: '13px', fontWeight: 600,
        fontFamily: 'DM Sans, sans-serif',
        color: 'var(--navy)', margin: '0 0 10px',
      }}>
        {initial ? 'Edit holiday' : 'Add holiday'}
      </p>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Holiday name"
          value={name}
          onChange={e => setName(e.target.value)}
          style={{ ...inputStyle, flex: '2 1 150px', minWidth: 0 }}
        />
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          style={{ ...inputStyle, flex: '1 1 130px', minWidth: 0 }}
        />
        <input
          type="text"
          placeholder="Description (optional)"
          value={description}
          onChange={e => setDescription(e.target.value)}
          style={{ ...inputStyle, flex: '2 1 180px', minWidth: 0 }}
        />
      </div>

      {error && (
        <p style={{ fontSize: '12px', color: 'var(--danger)', fontFamily: 'DM Sans, sans-serif', margin: '0 0 8px' }}>
          {error}
        </p>
      )}

      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          style={{
            height: '32px', padding: '0 14px',
            background: 'var(--brand)', color: '#fff',
            border: 'none', borderRadius: '6px',
            fontSize: '13px', fontFamily: 'DM Sans, sans-serif', fontWeight: 500,
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
            display: 'flex', alignItems: 'center', gap: '5px',
          }}
        >
          <Check size={13} />
          {initial ? 'Save' : 'Add'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            height: '32px', padding: '0 12px',
            background: 'transparent', color: 'var(--text-secondary)',
            border: '1px solid var(--border)', borderRadius: '6px',
            fontSize: '13px', fontFamily: 'DM Sans, sans-serif',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
