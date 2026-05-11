'use client'

import type { Holiday } from './types'

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 200,
  background: 'rgba(0,0,0,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '20px',
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface-0)',
  border: '1px solid var(--border)',
  borderRadius: '12px',
  padding: '28px',
  maxWidth: '400px',
  width: '100%',
}

export function DeleteModal({ holiday, onConfirm, onCancel }: {
  holiday: Holiday
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '18px', fontWeight: 700, color: 'var(--navy)', margin: '0 0 8px' }}>
          Delete holiday
        </h2>
        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 24px' }}>
          Are you sure you want to delete{' '}
          <strong style={{ color: 'var(--navy)' }}>{holiday.name}</strong>?
          This action cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              height: '40px', padding: '0 28px',
              background: 'var(--danger)', color: '#fff',
              border: 'none', borderRadius: '8px',
              fontSize: '14px', fontFamily: 'DM Sans, sans-serif', fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Delete
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{
              height: '40px', padding: '0 20px',
              background: 'transparent', color: 'var(--text-secondary)',
              border: '1px solid var(--border)', borderRadius: '8px',
              fontSize: '14px', fontFamily: 'DM Sans, sans-serif',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export function BulkDeleteModal({ count, onConfirm, onCancel, deleting }: {
  count: number
  onConfirm: () => void
  onCancel: () => void
  deleting: boolean
}) {
  return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '18px', fontWeight: 700, color: 'var(--navy)', margin: '0 0 8px' }}>
          Delete {count} holiday{count !== 1 ? 's' : ''}
        </h2>
        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 24px' }}>
          Are you sure you want to delete{' '}
          <strong style={{ color: 'var(--navy)' }}>{count} selected holiday{count !== 1 ? 's' : ''}</strong>?
          This action cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            style={{
              height: '40px', padding: '0 28px',
              background: 'var(--danger)', color: '#fff',
              border: 'none', borderRadius: '8px',
              fontSize: '14px', fontFamily: 'DM Sans, sans-serif', fontWeight: 500,
              cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1,
            }}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            style={{
              height: '40px', padding: '0 20px',
              background: 'transparent', color: 'var(--text-secondary)',
              border: '1px solid var(--border)', borderRadius: '8px',
              fontSize: '14px', fontFamily: 'DM Sans, sans-serif',
              cursor: deleting ? 'not-allowed' : 'pointer', flexShrink: 0,
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
